package com.dokor.argos.webservices.internal;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import com.dokor.argos.services.configuration.ConfigurationService;

import com.coreoz.plume.jersey.security.basic.BasicAuthenticator;

@Singleton
public class InternalApiAuthenticator {
    private final BasicAuthenticator<String> basicAuthenticator;

    @Inject
    public InternalApiAuthenticator(ConfigurationService configurationService) {
        this.basicAuthenticator = BasicAuthenticator.fromSingleCredentials(
            configurationService.internalApiAuthUsername(),
            configurationService.internalApiAuthPassword(),
            "API api-backend"
        );
    }

    public BasicAuthenticator<String> get() {
        return this.basicAuthenticator;
    }
}
