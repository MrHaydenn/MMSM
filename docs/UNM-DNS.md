# UNM delegated DNS integration

All values below are examples. `example.com` is an example domain and `203.0.113.10` is a documentation-only IP; replace them with your own domain and public address. Do not enter the example IP as a live MMSM public address.

1. Set up your own UNM service with authoritative DNS enabled for a delegated zone, for example `minecraft.example.com`. Follow UNM's current installation documentation for its service/firewall configuration.
2. At your DNS provider, create a DNS-only A record for `ns1.example.com` pointing to your DNS server's real public IP. Delegate `minecraft.example.com` using an NS record pointing to that nameserver. Keep the parent domain's registrar nameservers unchanged. Move any necessary existing records into the delegated zone before switching. Review conflicting records/DS records and arrange redundant authoritative DNS if needed.
3. Ensure authoritative DNS is reachable over both UDP and TCP port 53. Generic diagnostic examples:

   ```sh
   dig @203.0.113.10 minecraft.example.com SOA +norecurse
   dig +tcp @203.0.113.10 minecraft.example.com SOA +norecurse
   ```

4. In UNM, generate an integration key for that delegated zone. Store it privately.
5. In MMSM wrapper Settings, select **UNM**, enter your UNM HTTPS URL (for example `https://network.example.com:8787`) and integration token, and set DNS zone and base domain to your delegated zone. Enter the real public Minecraft entry-point IP, enable automatic DNS publishing, save, and test the connection.
6. Assign a label such as `survival` in the server's Public address section. MMSM publishes the server's owned A/SRV pair and shows its address, such as `survival.minecraft.example.com`.

Forwarding and server availability are separate from DNS. DNS caches can retain changes until TTL expiry. MMSM retries publishing and cleans up its owned records when addresses change or servers are deleted; it does not take over unrelated records. The integration token stays on the MMSM host and is not returned by the settings API.

UNM integration requires a separately installed compatible UNM service; MMSM does not install a nameserver or change registrar delegation for you.
