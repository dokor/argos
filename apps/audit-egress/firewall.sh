#!/bin/sh
set -eu
# Set policies BEFORE listening. A failure keeps the gateway unhealthy and workers stopped.
# Collector UID 1001 can only reach the local proxy and local DevTools (Lighthouse).
# Proxy UID 1000 has DNS and public web egress. No worker has NET_ADMIN.
for tool in iptables ip6tables; do
  "$tool" -P OUTPUT DROP
  "$tool" -F OUTPUT
  "$tool" -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
done
iptables -A OUTPUT -m owner --uid-owner 0 -d 127.0.0.1 -p tcp --dport 3128 -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner 1001 -d 127.0.0.1 -p tcp -m multiport --dports 3128,9222,3016,3017 -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner 1000 -d 127.0.0.11 -p udp -j ACCEPT
iptables -A OUTPUT -m owner --uid-owner 1000 -d 127.0.0.11 -p tcp -j ACCEPT
# Defense in depth against a proxy regression. Include all conservative policy IPv4 ranges.
for range in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 168.63.129.16/32 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.88.99.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4; do
  iptables -A OUTPUT -d "$range" -j REJECT
done
iptables -A OUTPUT -m owner --uid-owner 1000 -p tcp -m multiport --dports 80,443 -j ACCEPT
for range in 2001::/23 2001:db8::/32 2002::/16 3fff::/20; do
  ip6tables -A OUTPUT -d "$range" -j REJECT
done
ip6tables -A OUTPUT -m owner --uid-owner 1000 -d 2000::/3 -p tcp -m multiport --dports 80,443 -j ACCEPT
# Drop root/capabilities from the serving process after installing the namespace policy.
exec setpriv --reuid=1000 --regid=1000 --clear-groups --bounding-set=-all --no-new-privs node /app/server.mjs
