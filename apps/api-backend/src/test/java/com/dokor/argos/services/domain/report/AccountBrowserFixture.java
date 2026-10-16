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
    /** Local test-classpath control; never registered by the production application. */
    @Path("/__test/usage") @PublicApi @Produces(MediaType.APPLICATION_JSON)
    public static class UsageControl {
        final AccountBrowserFixture fixture;
        final AuditRunDao runs;
        final AuditDao audits;
        UsageControl(AccountBrowserFixture fixture, AuditRunDao runs, AuditDao audits) {this.fixture=fixture;this.runs=runs;this.audits=audits;}
        @POST @Path("/{id}/{action}")
        public Map<String,Boolean> finish(@PathParam("id") long id,@PathParam("action") String action) {
            if(!java.util.List.of("publish","fail").contains(action)) throw new NotFoundException();
            var token=fixture.runs.claim(id).orElseThrow(NotFoundException::new);
            var run=runs.findById(id);
            if(action.equals("fail")) fixture.runs.fail(id,"SYNTHETIC_FAILURE",token);
            else fixture.publisher.completeAndPublish(id,audits.findById(run.getAuditId()),mock(com.dokor.argos.services.analysis.model.AuditReportJson.class),"{}",token);
            return Map.of("accepted",true);
        }
    }
    @Path("/__test/mail")
    @PublicApi
    @Produces(MediaType.APPLICATION_JSON)
    public static class MailCapture implements AccountMail {
        final Map<String, String> messages = new ConcurrentHashMap<>();

        @Override
        public void send(String recipient, AccountEmail.Message message) {
            messages.put(recipient, message.text());
        }

        @GET
        @Path("/{email}")
        public Map<String, String> last(@PathParam("email") String email) {
            String text = messages.get(email);
            if (text == null || !text.contains("#token=")) throw new NotFoundException();
            int start = text.indexOf("http://localhost:3000/");
            return Map.of("token", text.substring(text.indexOf("#token=") + 7).split("\\s", 2)[0],
                    "url", start < 0 ? "" : text.substring(start).split("\\s", 2)[0]);
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
        String limit=System.getProperty("argos.usage.fixture-limit");
        var usage=new UsageService(transactions,new UsagePolicy(ConfigFactory.parseString(limit==null ? "" : "usage.offers.FREE.monthly-limit="+Long.parseLong(limit))),clock);
        var runDao=new AuditRunDao(transactions,usage);
        fixture.runs=new AuditRunService(runDao,fixture.tokens,fixture.mapper);
        var composer=mock(PublicReportComposer.class);var summary=mock(AiReportSummaryService.class);
        when(composer.compose(any())).thenReturn(fixture.mapper.readValue("""
            {"generatedAt":"%s","domain":"example.com","url":"https://example.com/admin-test",
             "scores":{"global":0,"globalAvailable":false,"completeness":0,"byCategory":[],
               "coverage":{"version":"fixture","threshold":0.8,"global":{"key":"global","measuredWeight":0,"expectedWeight":100,"ratio":0,"available":false,"sufficient":false},"domains":[],"checks":[],"provisional":true}},
             "summary":{"oneLiner":"low","priorities":[]},"issues":[]}
            """.formatted(clock.instant()).replace("\"issues\":[]",Boolean.getBoolean("argos.feedback.browser.fixture")
                ? "\"issues\":[{\"id\":\"http.hsts\",\"categoryKey\":\"security\",\"categoryKeys\":[\"security\"],\"module\":\"http\",\"severity\":\"important\",\"title\":\"Controlled HSTS fixture\",\"impact\":\"Synthetic finding\",\"effort\":\"S\"}]" : "\"issues\":[]"),ReportDto.class));
        when(summary.enrich(any())).thenAnswer(call->call.getArgument(0));
        fixture.publisher=new ReportPublishService(transactions,runDao,fixture.reports,composer,summary,mock(AhrefsDomainRatingClient.class),fixture.mapper);
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
                        runDao,
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
                        .register(new UsageControl(fixture,runDao,auditDao))
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
                                        new AccountRateLimiter(dao, fixture.tokens, clock, settings), new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),new AuditDao(dao.transactions),clock), new AccountHistoryService(dao,sessions,fixture.mapper,clock)))
                        .register(
                                new com.dokor.argos.webservices.api.report.ReportsWs(
                                        fixture.reader, fixture.runs));
        var connectedProfiles=new com.dokor.argos.services.connected.ConnectedProfiles(new com.dokor.argos.services.analysis.scoring.DefaultScorePolicy());
        config.register(new UsageHistoryWs(new UsageHistoryService(sessions,new UsagePolicy(ConfigFactory.empty()),clock)));
        config.register(new ConnectedProfilesWs(sessions,connectedProfiles));
        config.register(new ConnectedAnalysesWs(new com.dokor.argos.services.connected.ConnectedAnalysesService(dao,sessions,
            new AccountSitesService(dao,sessions,new UrlNormalizer(),new DomainService(new DomainDao(dao.transactions)),auditDao,clock),audits,new UrlNormalizer(),connectedProfiles,fixture.mapper,fixture.tokens),new AccountCsrf(settings)));
        config.register(new AdminWs(new AdminService(dao,sessions,usage,new UsagePolicy(ConfigFactory.empty()),fixture.reader,fixture.mapper,clock),new AccountCsrf(settings)));
        var feedback=new com.dokor.argos.services.feedback.FeedbackService(dao,new FeedbackDao(dao),sessions,fixture.reports,fixture.reader,fixture.tokens,clock);
        config.register(new com.dokor.argos.webservices.api.feedback.FeedbackWs(feedback,new AccountCsrf(settings),new AccountRateLimiter(dao,fixture.tokens,clock,settings)));
        config.register(new com.dokor.argos.webservices.api.feedback.FeedbackAdminWs(feedback,new AccountCsrf(settings)));
        if(Boolean.getBoolean("argos.admin.browser.fixture")) {
            auth.register("admin@example.com","a long synthetic fixture passphrase","Admin fixture");
            auth.verify(mail.last("admin@example.com").get("token"));
            fixture.sql("UPDATE ARG_ACCOUNT_USER SET role='ADMIN' WHERE email='admin@example.com'");
            for(int i=1;i<=24;i++) {
                var user=new com.dokor.argos.db.generated.AccountUser();
                user.setEmail("user"+i+"@example.com");user.setDisplayName("User "+i);user.setState("ACTIVE");
                user.setRole("USER");user.setOffer("FREE");user.setCreatedAt(clock.instant());
                dao.transaction(c->dao.save(user,c));
            }
        }
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
