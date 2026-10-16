package com.dokor.argos.services.analysis;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Bump when collector semantics/configuration change; independent of scoring weights. */
public final class MeasurementContract {
    public static final String VERSION = "analysis-measurements-v3";
    private MeasurementContract() {}
    public static String fingerprint(String profileSnapshot) {
        return digest(VERSION + "\n" + (profileSnapshot == null ? "default" : profileSnapshot));
    }
    public static String scope(String requested, String destination) {
        return destination == null ? null : digest(requested + "\n" + destination);
    }
    public static String scope(String requested, String destination, AuditScope scope) {
        if (!scope.partial()) return scope(requested,destination);
        return destination == null ? null : digest(requested + "\n" + destination + "\n" + scope.kind() + "\n" + scope.target());
    }
    private static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
