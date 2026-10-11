package com.dokor.argos.services.domain.report;

import static org.mockito.Mockito.*;

import com.coreoz.plume.jersey.security.permission.*;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.domain.DomainService;
import com.dokor.argos.webservices.api.account.*;
import com.typesafe.config.ConfigFactory;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Test-classpath-only HTTP fixture, guarded against non-local or non-fixture databases. */
public class AccountBrowserFixture extends MariaDbReportFixture {
    @Path("/__test/mail")
    @PublicApi
    @Produces(MediaType.APPLICATION_JSON)
    public static class MailCapture implements AccountMail {
        final Map<String, String> messages = new ConcurrentHashMap<>();

        @Override
        public void send(String recipient, String subject, String text) {
            messages.put(recipient, text);
        }

        @GET
        @Path("/{email}")
        public Map<String, String> last(@PathParam("email") String email) {
            String text = messages.get(email);
            if (text == null || !text.contains("#token=")) throw new NotFoundException();
            return Map.of("token", text.substring(text.indexOf("#token=") + 7));
        }
    }

    public static void main(String[] args) throws Exception {
        if (!Boolean.getBoolean("argos.account.browser.fixture"))
            throw new IllegalStateException("Explicit local fixture flag required");
        connect();
        var fixture = new AccountBrowserFixture();
        fixture.migrateHistoricalRows();
        var settings =
                new AccountSettings(
                        ConfigFactory.parseMap(
                                Map.of(
                                        "account.enabled",
                                        true,
                                        "account.origin",
                                        "http://localhost:3000",
                                        "account.jwt-secret",
                                        "s".repeat(64))));
        var clock = Clock.systemUTC();
        var mail = new MailCapture();
        var transactions =
                new com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl(
                        source,
                        new com.querydsl.sql.Configuration(
                                com.querydsl.sql.MySQLTemplates.DEFAULT));
        var dao = new AccountDao(transactions);
        var sessions =
                new AccountSessionService(
                        dao,
                        new AccountSessionSigner(settings, fixture.mapper, clock),
                        fixture.tokens,
                        settings,
                        clock);
        var auth =
                new AccountAuthService(
                        dao,
                        new AccountPasswords(settings),
                        sessions,
                        fixture.tokens,
                        settings,
                        mail,
                        clock);
        var auditDao = new AuditDao(transactions);
        var audits =
                new AuditService(
                        auditDao,
                        fixture.runs,
                        new UrlNormalizer(),
                        new DomainService(new DomainDao(transactions)));
        var personal =
                new AccountRunsService(
                        dao,
                        sessions,
                        audits,
                        new AuditRunDao(transactions),
                        fixture.reader,
                        fixture.tokens,
                        clock,
                        settings, new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock));
        var oauth =
                new AccountOAuthService(
                        dao,
                        sessions,
                        new AccountOAuthClient(settings, fixture.mapper),
                        auth,
                        fixture.tokens,
                        clock,
                        settings);
        var json = new com.dokor.argos.jersey.SafeJsonProvider();
        json.setMapper(fixture.mapper);
        var config =
                new org.glassfish.jersey.server.ResourceConfig()
                        .register(json)
                        .register(mail)
                        .register(com.coreoz.plume.jersey.errors.WsResultExceptionMapper.class)
                        .register(
                                RequireExplicitAccessControlFeature.accessControlAnnotations(
                                        PublicApi.class, AccountAccess.class))
                        .register(
                                new PermissionFeature<>(
                                        new AccountPermissionProvider(sessions),
                                        AccountAccess.class,
                                        AccountAccess::value))
                        .register(AccountContextFactory.binding(sessions))
                        .register(new AccountFailureAuditFilter(dao, sessions))
                        .register(
                                new AccountAuthWs(
                                        auth,
                                        sessions,
                                        oauth,
                                        new AccountCsrf(settings),
                                        new AccountRateLimiter(
                                                dao, fixture.tokens, clock, settings),
                                        fixture.tokens,
                                        settings))
                        .register(
                                new AccountWs(
                                        dao,
                                        sessions,
                                        auth,
                                        personal,
                                        new AccountCsrf(settings),
                                        new AccountRateLimiter(dao, fixture.tokens, clock, settings), new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock)))
                        .register(
                                new com.dokor.argos.webservices.api.report.ReportsWs(
                                        fixture.reader, fixture.runs));
        var admin = mock(com.dokor.argos.services.configuration.ConfigurationService.class);
        when(admin.adminApiToken()).thenReturn("synthetic-server-credential");
        config.register(
                new com.dokor.argos.webservices.api.audits.AuditsWs(
                        audits,
                        new AuditQueryService(auditDao, fixture.runs, fixture.mapper),
                        new com.dokor.argos.webservices.api.audits.AdminReadAccess(admin),
                        fixture.reader,
                        null,
                        personal,
                        settings,
                        new AccountCsrf(settings)));
        var server =
                org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory.createHttpServer(
                        java.net.URI.create("http://127.0.0.1:33317/api/"), config, false);
        for (var listener : server.getListeners()) {
            listener.getTransport().setSelectorRunnersCount(1);
            listener.getTransport()
                    .setWorkerThreadPoolConfig(
                            org.glassfish.grizzly.threadpool.ThreadPoolConfig.defaultConfig()
                                    .setCorePoolSize(2)
                                    .setMaxPoolSize(6));
        }
        server.start();
        Runtime.getRuntime().addShutdownHook(new Thread(server::shutdownNow));
        System.out.println("Local account fixture ready on 127.0.0.1:33317");
        new java.util.concurrent.CountDownLatch(1).await();
    }
}
