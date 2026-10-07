package com.dokor.argos.webservices.internal;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import com.dokor.argos.services.configuration.ConfigurationService;

import com.coreoz.plume.jersey.security.basic.BasicAuthenticator;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

@Singleton
public class InternalApiAuthenticator {
    private final BasicAuthenticator<String> basicAuthenticator;

    @Inject
    public InternalApiAuthenticator(ConfigurationService configurationService) {
        byte[] expectedUsername = configurationService.internalApiAuthUsername().getBytes(StandardCharsets.UTF_8);
        byte[] expectedPassword = configurationService.internalApiAuthPassword().getBytes(StandardCharsets.UTF_8);
        this.basicAuthenticator = new BasicAuthenticator<>(credentials -> null, "API api-backend") {
            @Override
            public String requireAuthentication(ContainerRequestContext context) {
                String header = context.getHeaderString(HttpHeaders.AUTHORIZATION);
                if (header == null || !header.startsWith("Basic ")) throw unauthorized();
                try {
                    String decoded = new String(Base64.getDecoder().decode(header.substring(6)), StandardCharsets.UTF_8);
                    int separator = decoded.indexOf(':');
                    if (separator < 0 || decoded.indexOf(':', separator + 1) >= 0) throw unauthorized();
                    byte[] username = decoded.substring(0, separator).getBytes(StandardCharsets.UTF_8);
                    byte[] password = decoded.substring(separator + 1).getBytes(StandardCharsets.UTF_8);
                    if (MessageDigest.isEqual(expectedUsername, username)
                        && MessageDigest.isEqual(expectedPassword, password)) return "Basic user";
                } catch (IllegalArgumentException invalidBase64) {
                    throw unauthorized();
                }
                throw unauthorized();
            }
        };
    }

    private static ClientErrorException unauthorized() {
        return new ClientErrorException(Response.status(Response.Status.UNAUTHORIZED)
            .header(HttpHeaders.WWW_AUTHENTICATE, "Basic realm=\"API api-backend\", charset=\"UTF-8\"")
            .build());
    }

    public BasicAuthenticator<String> get() {
        return this.basicAuthenticator;
    }
}
