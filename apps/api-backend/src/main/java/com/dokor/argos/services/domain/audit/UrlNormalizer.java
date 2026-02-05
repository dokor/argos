package com.dokor.argos.services.domain.audit;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.net.URI;

@Singleton
public class UrlNormalizer {

    @Inject
    public UrlNormalizer(
    ) {
        // TODO document why this constructor is empty
    }

    public String normalize(String inputUrl) {
        URI uri = URI.create(inputUrl.trim());
        return uri.normalize().toString();
    }

    public String extractHostname(String normalizedUrl) {
        return URI.create(normalizedUrl).getHost();
    }
}
