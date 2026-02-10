package com.dokor.argos.guice;

import com.coreoz.plume.db.querydsl.guice.GuiceQuerydslModule;
import com.dokor.argos.services.analysis.JavaHttpUrlAuditAnalyzer;
import com.dokor.argos.services.analysis.UrlAuditAnalyzer;
import com.dokor.argos.services.analysis.model.AuditModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.html.HtmlModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.http.HttpModuleAnalyzer;
import com.dokor.argos.services.analysis.modules.tech.TechModuleAnalyzer;
import com.dokor.argos.services.analysis.scoring.ScoreEnricherService;
import com.dokor.argos.services.analysis.scoring.ScorePolicy;
import com.dokor.argos.services.analysis.scoring.ScorePolicyV1;
import com.dokor.argos.services.analysis.scoring.ScoreService;
import com.google.inject.multibindings.Multibinder;
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

        Multibinder<AuditModuleAnalyzer> multibinder
            = Multibinder.newSetBinder(binder(), AuditModuleAnalyzer.class);
        multibinder.addBinding().to(HtmlModuleAnalyzer.class);
        multibinder.addBinding().to(TechModuleAnalyzer.class);
        multibinder.addBinding().to(HttpModuleAnalyzer.class);


        bind(ScorePolicy.class)
            .to(ScorePolicyV1.class)
            .in(Singleton.class);
    }
}
