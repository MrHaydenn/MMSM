"""Minecraft status protocol and public-port proxy with wake-on-ping."""
import contextlib
import json
import select
import socket
import struct
import threading
import time
from .store import Problem


def varint(value):
    value &= 0xffffffff
    result = bytearray()
    while True:
        b = value & 127
        value >>= 7
        result.append(b | (128 if value else 0))
        if not value:
            return bytes(result)


def exact(sock, n):
    result = b''
    while len(result) < n:
        part = sock.recv(n - len(result))
        if not part:
            raise EOFError()
        result += part
    return result


def read_varint(sock):
    result = 0
    for i in range(5):
        b = exact(sock, 1)[0]
        result |= (b & 127) << (7 * i)
        if not b & 128:
            return result
    raise ValueError('Invalid VarInt')


def packet(payload):
    return varint(len(payload)) + payload


def string(value):
    data = value.encode()
    return varint(len(data)) + data


def read_packet(sock):
    size = read_varint(sock)
    if size < 1 or size > 1024 * 1024:
        raise ValueError('Invalid packet size')
    return exact(sock, size)


class Buffer:
    def __init__(self, data):
        self.data = data
    def recv(self, n):
        result, self.data = self.data[:n], self.data[n:]
        return result


def status(port):
    with socket.create_connection(('127.0.0.1', port), timeout=1.5) as s:
        s.sendall(packet(b'\0' + varint(767) + string('localhost') + struct.pack('>H', port) + b'\1') + packet(b'\0'))
        buf = Buffer(read_packet(s))
        if read_varint(buf) != 0:
            raise ValueError('Invalid status response')
        return json.loads(exact(buf, read_varint(buf)).decode())


class Proxy:
    def __init__(self, manager, sid, port, host='0.0.0.0'):
        self.manager, self.sid = manager, sid
        self.closed = threading.Event()
        self.sockets = set()
        self.lock = threading.Lock()
        self.capacity = threading.BoundedSemaphore(128)
        self.rx = self.tx = 0
        self.listener = socket.socket()
        self.listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            self.listener.bind((host, port))
            self.listener.listen(64)
            self.listener.settimeout(1)
        except Exception:
            self.listener.close()
            raise
        self.accept_thread = threading.Thread(target=self.accept, daemon=True)
        self.accept_thread.start()

    def accept(self):
        while not self.closed.is_set():
            try:
                client, _ = self.listener.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            if not self.capacity.acquire(blocking=False):
                client.close()
                continue
            with self.lock:
                self.sockets.add(client)
            threading.Thread(target=self.handle, args=(client,), daemon=True).start()

    def handle(self, client):
        upstream = None
        try:
            server = self.manager.store.server(self.sid)
            if server['archived'] or self.closed.is_set():
                return
            state = self.manager.state(self.sid)
            if state['status'] == 'running':
                upstream = socket.create_connection(('127.0.0.1', server['internal_port']), timeout=3)
                with self.lock:
                    self.sockets.add(upstream)
                client.settimeout(30)
                upstream.settimeout(30)
                while not self.closed.is_set():
                    ready, _, _ = select.select([client, upstream], [], [], 1)
                    for source in ready:
                        data = source.recv(65536)
                        if not data:
                            return
                        target = upstream if source is client else client
                        target.sendall(data)
                        with self.lock:
                            if source is client:
                                self.rx += len(data)
                            else:
                                self.tx += len(data)
                return
            client.settimeout(4)
            handshake = Buffer(read_packet(client))
            if read_varint(handshake) != 0:
                return
            protocol = read_varint(handshake)
            length = read_varint(handshake)
            if length > 1024:
                return
            exact(handshake, length + 2)
            intent = read_varint(handshake)
            if intent not in (1, 2):
                return
            if intent == 1 and read_packet(client) != b'\0':
                return
            if server['sleep'] and not server.get('manual_stop') and state['status'] in ('sleeping', 'stopped'):
                if intent == 2 or server.get('wake_mode','join') == 'ping':
                    self.manager.wake(self.sid, reason='Minecraft join handshake' if intent == 2 else 'Minecraft server-list ping', source_ip=client.getpeername()[0])
                    message = 'MMSM • Starting the server. Please wait a moment, then try joining again.'
                else:
                    message = 'MMSM • Sleeping. Join the server to start it.'
            elif state['status'] in ('starting', 'waking'):
                message = 'MMSM • Starting the server. Please wait a moment, then try joining again.'
            else:
                message = 'MMSM • Server is offline.'
            if intent == 1:
                body = json.dumps({'version': {'name': 'MMSM', 'protocol': protocol},
                                   'players': {'max': 0, 'online': 0}, 'description': {'text': message}})
                client.sendall(packet(b'\0' + string(body)))
                ping = read_packet(client)
                if len(ping) == 9 and ping[0] == 1:
                    client.sendall(packet(ping))
            else:
                client.sendall(packet(b'\0' + string(json.dumps({'text': message}))))
        except (OSError, EOFError, ValueError, KeyError, Problem):
            pass
        finally:
            with self.lock:
                self.sockets.discard(client)
                if upstream:
                    self.sockets.discard(upstream)
            client.close()
            if upstream:
                upstream.close()
            self.capacity.release()

    def close(self):
        self.closed.set()
        with contextlib.suppress(OSError):
            self.listener.shutdown(socket.SHUT_RDWR)
        self.listener.close()
        self.accept_thread.join(timeout=2)
        with self.lock:
            for s in list(self.sockets):
                with contextlib.suppress(OSError):
                    s.shutdown(socket.SHUT_RDWR)
                s.close()
            self.sockets.clear()
