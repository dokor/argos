package com.dokor.argos.services.domain;


import jakarta.inject.Singleton;

import java.net.URI;

@Singleton
public class UrlNormalizer {

    public String normalize(String inputUrl) {
        URI uri = URI.create(inputUrl.trim());
        return uri.normalize().toString();
    }

    public String extractHostname(String normalizedUrl) {
        return URI.create(normalizedUrl).getHost();
    }
}
