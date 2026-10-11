package com.dokor.argos.jersey;

import jakarta.inject.Inject;
import jakarta.inject.Provider;
import jakarta.inject.Singleton;

import org.glassfish.jersey.server.ResourceConfig;

import com.coreoz.plume.jersey.errors.WsResultExceptionMapper;
import com.coreoz.plume.jersey.java8.TimeParamProvider;
import com.coreoz.plume.jersey.security.permission.PublicApi;
import com.coreoz.plume.jersey.security.permission.RequireExplicitAccessControlFeature;
import com.coreoz.plume.jersey.security.size.ContentSizeLimitFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Jersey configuration
 */
@Singleton
public class JerseyConfigProvider implements Provider<ResourceConfig> {

    private final ResourceConfig config;

    public JerseyConfigProvider(ObjectMapper objectMapper) {
        config = new ResourceConfig();

        // this package will be scanned by Jersey to discover web-service classes
        config.packages("com.dokor.argos.webservices");

        // filters configuration
        // handle errors and exceptions
        config.register(WsResultExceptionMapper.class);
        // Limit request body size to 500kb
        config.register(ContentSizeLimitFeature.class);
        // require explicit access control on API
        config.register(RequireExplicitAccessControlFeature.accessControlAnnotations(PublicApi.class, com.dokor.argos.webservices.api.account.AccountAccess.class));
        // to debug web-service requests
//        config.register(LoggingFeature.class);

        // java 8
        config.register(TimeParamProvider.class);

        // WADL is like swagger for jersey
        // by default it should be disabled to prevent leaking API documentation
        config.property("jersey.config.server.wadl.disableWadl", true);

        // Disable automatique relative location URI resolution
        // By default it transform a relative location to an absolute location
        config.property("jersey.config.server.headers.location.relative.resolution.disabled", true);

        // jackson mapper configuration
        SafeJsonProvider jacksonProvider = new SafeJsonProvider();
        jacksonProvider.setMapper(objectMapper);
        config.register(jacksonProvider);
    }
    @Inject
    public JerseyConfigProvider(ObjectMapper mapper,com.dokor.argos.webservices.api.account.AccountPermissionProvider provider,
                                com.dokor.argos.services.account.AccountSessionService sessions) {
        this(mapper);
        config.register(com.dokor.argos.webservices.api.account.AccountContextFactory.binding(sessions));
        config.register(new com.coreoz.plume.jersey.security.permission.PermissionFeature<>(
            provider,com.dokor.argos.webservices.api.account.AccountAccess.class,
            com.dokor.argos.webservices.api.account.AccountAccess::value));
    }

    @Override
    public ResourceConfig get() {
        return config;
    }

}
