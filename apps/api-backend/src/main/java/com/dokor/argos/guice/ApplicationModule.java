package com.dokor.argos.guice;

import com.coreoz.plume.db.querydsl.guice.GuiceQuerydslModule;
import com.dokor.argos.services.analysis.JavaHttpUrlAuditAnalyzer;
import com.dokor.argos.services.analysis.UrlAuditAnalyzer;
import jakarta.inject.Singleton;
import org.glassfish.jersey.server.ResourceConfig;

import com.dokor.argos.jersey.JerseyConfigProvider;

import com.coreoz.plume.conf.guice.GuiceConfModule;
import com.coreoz.plume.jersey.guice.GuiceJacksonModule;
import com.google.inject.AbstractModule;

/**
 * Group the Guice modules to install in the application
 */
public class ApplicationModule extends AbstractModule {

    @Override
    protected void configure() {
        install(new GuiceConfModule());
        install(new GuiceJacksonModule());
        // Database & Querydsl installation
        install(new GuiceQuerydslModule());

        // Prepare Jersey configuration
        bind(ResourceConfig.class).toProvider(JerseyConfigProvider.class);

        bind(UrlAuditAnalyzer.class)
            .to(JavaHttpUrlAuditAnalyzer.class)
            .in(Singleton.class);
    }

}
