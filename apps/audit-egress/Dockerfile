FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends iptables util-linux \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY policy.mjs proxy.mjs server.mjs firewall.sh ./
RUN chmod 755 firewall.sh
EXPOSE 3128
ENTRYPOINT ["/app/firewall.sh"]
