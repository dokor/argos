package com.dokor.argos.services.analysis;

/** A fresh standalone measurement. No earlier report is read or recomposed. */
public record AuditScope(String kind, String target) {
    public AuditScope {
        if (!java.util.Set.of("full", "category", "check").contains(kind == null ? "" : kind))
            throw new IllegalArgumentException("Invalid analysis scope");
        if ("full".equals(kind) ? target != null : target == null || target.isBlank() || target.length() > 160)
            throw new IllegalArgumentException("Invalid analysis scope target");
    }
    public static AuditScope full() { return new AuditScope("full", null); }
    public boolean partial() { return !"full".equals(kind); }
}
