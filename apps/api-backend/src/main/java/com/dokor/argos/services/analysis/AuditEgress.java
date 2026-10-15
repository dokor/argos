package com.dokor.argos.services.analysis;

import java.net.*;
import java.io.IOException;
import java.util.List;

/** Applies only to target collection, never DB/internal/API clients. No direct fallback. */
public final class AuditEgress extends ProxySelector {
    private final String endpoint;
    public AuditEgress(String endpoint) { this.endpoint = endpoint; }
    public static ProxySelector configured() { return new AuditEgress(System.getenv("AUDIT_EGRESS_PROXY")); }
    @Override public List<Proxy> select(URI target) {
        if (endpoint == null || endpoint.isBlank()) throw new IllegalStateException("Audit egress proxy is required");
        URI proxy = URI.create(endpoint);
        if (!"http".equals(proxy.getScheme()) || proxy.getHost() == null || proxy.getUserInfo() != null
            || proxy.getPort() < 1 || proxy.getRawQuery() != null || proxy.getRawFragment() != null
            || proxy.getPath() != null && !proxy.getPath().isEmpty())
            throw new IllegalStateException("Invalid audit egress configuration");
        return List.of(new Proxy(Proxy.Type.HTTP, new InetSocketAddress(proxy.getHost(), proxy.getPort())));
    }
    @Override public void connectFailed(URI target, SocketAddress address, IOException error) { /* Never retry direct. */ }
}
