package com.dokor.argos.webservices.api.audits;

import com.dokor.argos.services.configuration.ConfigurationService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.NotAuthorizedException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Server-to-server credential; browser cookies are never trusted by Java. */
@Singleton
public class AdminReadAccess {
    private final byte[] expected;

    @Inject
    public AdminReadAccess(ConfigurationService configuration) {
        String token = configuration.adminApiToken();
        expected = token == null || token.isBlank() ? null : token.getBytes(StandardCharsets.UTF_8);
    }

    public void require(String authorization) {
        if (expected == null || authorization == null || !authorization.startsWith("Bearer ")
            || !MessageDigest.isEqual(expected, authorization.substring(7).getBytes(StandardCharsets.UTF_8))) {
            throw new NotAuthorizedException("Bearer realm=\"argos-admin\"");
        }
    }
}
