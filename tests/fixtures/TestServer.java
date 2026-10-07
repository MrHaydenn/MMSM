// Minimal protocol fixture, NOT Minecraft. Exercises real JVM lifecycle and status polling.
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Properties;

public class TestServer {
    static int readVar(InputStream in) throws IOException {
        int result = 0;
        for (int i=0; i<5; i++) {
            int b=in.read(); if(b<0) throw new EOFException();
            result |= (b & 127) << (7*i);
            if((b & 128)==0) return result;
        }
        throw new IOException("invalid VarInt");
    }
    static void writeVar(OutputStream out, int value) throws IOException {
        do { int b=value & 127; value >>>= 7; out.write(b | (value>0 ? 128:0)); } while(value>0);
    }
    public static void main(String[] args) throws Exception {
        if(java.util.Arrays.asList(args).contains("--crash-on-start")) { System.out.println("Fixture startup failure"); System.exit(7); }
        Properties p = new Properties();
        try(InputStream in=Files.newInputStream(Path.of("server.properties"))) { p.load(in); }
        ServerSocket listener = new ServerSocket(Integer.parseInt(p.getProperty("server-port")), 50, InetAddress.getByName("127.0.0.1"));
        Thread accept = new Thread(() -> {
            while(!listener.isClosed()) try {
                Socket client=listener.accept(); client.setSoTimeout(2000);
                Thread handler = new Thread(() -> {
                    try(client) {
                        InputStream in=client.getInputStream(); OutputStream out=client.getOutputStream();
                        in.readNBytes(readVar(in)); in.readNBytes(readVar(in));
                        byte[] json="{\"version\":{\"name\":\"Fixture\",\"protocol\":767},\"players\":{\"online\":0,\"max\":20},\"description\":{\"text\":\"Test fixture\"}}".getBytes(StandardCharsets.UTF_8);
                        ByteArrayOutputStream payload=new ByteArrayOutputStream();payload.write(0);writeVar(payload,json.length);payload.write(json);
                        writeVar(out,payload.size());payload.writeTo(out);out.flush();
                    } catch(IOException ignored) {}
                });handler.setDaemon(true);handler.start();
            } catch(IOException ignored) {}
        });accept.setDaemon(true);accept.start();
        System.out.println("Done! JVM fixture ready");System.out.flush();
        BufferedReader console=new BufferedReader(new InputStreamReader(System.in));
        String line;
        while((line=console.readLine())!=null) {
            if(line.equals("stop") && !java.util.Arrays.asList(args).contains("--ignore-stop")) { Files.writeString(Path.of("world-saved.txt"),"saved"); break; }
            System.out.println("Command: "+line);System.out.flush();
        }
        listener.close();
    }
}
