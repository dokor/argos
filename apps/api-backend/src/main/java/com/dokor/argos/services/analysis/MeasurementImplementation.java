package com.dokor.argos.services.analysis;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.zip.ZipFile;

/** Hash executable collector code, including hard-coded thresholds, without build timestamps. */
final class MeasurementImplementation {
    static final String FINGERPRINT = fingerprint();
    private MeasurementImplementation() {}

    private static String fingerprint() {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            digest.update(Runtime.version().toString().getBytes(StandardCharsets.UTF_8));
            classes(digest, MeasurementImplementation.class, "com/dokor/argos/");
            classes(digest, org.jsoup.Jsoup.class, "org/jsoup/");
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception unavailable) {
            // Collection remains usable; comparison must not invent an implementation identity.
            return null;
        }
    }

    private static void classes(MessageDigest digest, Class<?> type, String prefix) throws Exception {
        Path location = Path.of(type.getProtectionDomain().getCodeSource().getLocation().toURI());
        int count = 0;
        if (Files.isDirectory(location)) {
            try (var files = Files.walk(location.resolve(prefix))) {
                for (Path file : files.filter(p -> p.toString().endsWith(".class")).sorted().toList()) {
                    add(digest, location.relativize(file).toString().replace('\\', '/'), Files.readAllBytes(file));
                    count++;
                }
            }
        } else {
            try (var jar = new ZipFile(location.toFile())) {
                for (var entry : jar.stream().filter(e -> e.getName().startsWith(prefix)
                        && e.getName().endsWith(".class")).sorted(java.util.Comparator.comparing(java.util.zip.ZipEntry::getName)).toList()) {
                    try (var input = jar.getInputStream(entry)) { add(digest, entry.getName(), input.readAllBytes()); }
                    count++;
                }
            }
        }
        if (count == 0) throw new IOException("No collector implementation evidence");
    }

    private static void add(MessageDigest digest, String name, byte[] code) {
        digest.update(name.getBytes(StandardCharsets.UTF_8));
        digest.update((byte) 0);
        digest.update(code);
    }
}
