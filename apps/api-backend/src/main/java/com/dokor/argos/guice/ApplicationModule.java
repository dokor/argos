package com.dokor.argos.guice;

import com.coreoz.plume.db.querydsl.guice.GuiceQuerydslModule;
import com.dokor.argos.services.analysis.DomainAnalysisService;
import com.dokor.argos.services.analysis.scoring.ScorePolicy;
import com.dokor.argos.services.analysis.scoring.DefaultScorePolicy;
import com.dokor.argos.services.domain.domain.DomainService;
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
        bind(java.time.Clock.class).toInstance(java.time.Clock.systemUTC());
        bind(com.dokor.argos.services.ci.CiPolicy.class).asEagerSingleton();
        bind(com.dokor.argos.services.billing.BillingSettings.class).asEagerSingleton();
        bind(com.dokor.argos.services.billing.StripeGateway.class).to(com.dokor.argos.services.billing.StripeHttpClient.class);
        bind(com.dokor.argos.services.account.AccountSessionSigner.class).in(Singleton.class);
        bind(com.dokor.argos.webservices.api.account.AccountPermissionProvider.class).in(Singleton.class);
        bind(com.dokor.argos.services.account.AccountMail.class).to(com.dokor.argos.services.account.SmtpAccountMail.class);
        // Database & Querydsl installation
        install(new GuiceQuerydslModule());

        // Prepare Jersey configuration
        bind(ResourceConfig.class).toProvider(JerseyConfigProvider.class);

        bind(ScorePolicy.class)
            .to(DefaultScorePolicy.class)
            .in(Singleton.class);

        // Domain-level services
        bind(DomainService.class).in(Singleton.class);
        bind(DomainAnalysisService.class).in(Singleton.class);
    }
}
