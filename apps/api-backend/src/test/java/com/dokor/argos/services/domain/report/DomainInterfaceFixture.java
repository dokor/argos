package com.dokor.argos.services.domain.report;

import static org.mockito.Mockito.*;

import com.coreoz.plume.jersey.security.permission.PermissionFeature;
import com.dokor.argos.db.dao.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.analysis.scoring.DefaultScorePolicy;
import com.dokor.argos.services.connected.ConnectedProfiles;
import com.dokor.argos.services.connected.batch.*;
import com.dokor.argos.services.connected.discovery.*;
import com.dokor.argos.services.connected.summary.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.domain.DomainService;
import com.dokor.argos.webservices.api.account.*;
import com.typesafe.config.ConfigFactory;

import org.glassfish.jersey.server.ResourceConfig;

import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.Map;

/**
 * Test-classpath wiring only: real sessions, CSRF, discovery, admission, quota, summaries and
 * reports.
 */
final class DomainInterfaceFixture {
    static final String CSRF = "c".repeat(43);
    final AccountDao accounts;
    final AccountSettings settings;
    final AccountSessionService sessions;
    final UsageService usage;
    final Clock clock = Clock.systemUTC();
    final MariaDbReportFixture fixture;
    DiscoveryWorker worker;
    String jwt;
    String adminJwt;

    DomainInterfaceFixture(MariaDbReportFixture fixture, AccountDao accounts) throws Exception {
        this.fixture = fixture;
        this.accounts = accounts;
        settings =
                new AccountSettings(
                        ConfigFactory.parseMap(
                                Map.of(
                                        "account.enabled",
                                        true,
                                        "account.origin",
                                        "http://127.0.0.1:3000",
                                        "account.jwt-secret",
                                        "s".repeat(64))));
        sessions =
                new AccountSessionService(
                        accounts,
                        new AccountSessionSigner(settings, fixture.mapper, clock),
                        fixture.tokens,
                        settings,
                        clock);
        usage =
                new UsageService(
                        accounts.transactions, new UsagePolicy(ConfigFactory.empty()), clock);
        fixture.sql(
                "INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,created_at)"
                        + " VALUES(70,'domain-fixture@example.com','Domain"
                        + " fixture','ACTIVE',CURRENT_TIMESTAMP)");
        jwt =
                accounts.transaction(
                        c -> sessions.create(accounts.user(70, c, false), CSRF, c).jwt());
        fixture.sql(
                "INSERT INTO ARG_ACCOUNT_USER(id,email,display_name,state,role,created_at)"
                        + " VALUES(71,'admin-fixture@example.com','Admin"
                        + " fixture','ACTIVE','USER',CURRENT_TIMESTAMP)");
        accounts.transaction(
                c -> {
                    var identity = new com.dokor.argos.db.generated.AccountIdentity();
                    identity.setUserId(71L);
                    identity.setProvider("password");
                    identity.setSubject("71");
                    identity.setPasswordHash(
                            new AccountPasswords(settings)
                                    .hash("a long synthetic fixture passphrase"));
                    identity.setCreatedAt(clock.instant());
                    accounts.save(identity, c);
                    return null;
                });
        try (var c = fixture.source.getConnection()) {
            com.dokor.argos.operations.FirstAdminBootstrap.execute(c, c.getCatalog(), 71, true);
        }
        adminJwt =
                accounts.transaction(
                        c -> {
                            var issued = sessions.create(accounts.user(71, c, false), CSRF, c);
                            issued.context().session().setAuthenticatedAt(Instant.EPOCH);
                            accounts.save(issued.context().session(), c);
                            return issued.jwt();
                        });
    }

    void register(
            ResourceConfig config, AuditDao audits, AuditRunDao runDao, AuditService auditService)
            throws Exception {
        var domains = new DomainService(new DomainDao(accounts.transactions));
        var sites =
                new AccountSitesService(
                        accounts, sessions, new UrlNormalizer(), domains, audits, clock);
        var personal =
                new AccountRunsService(
                        accounts,
                        sessions,
                        auditService,
                        runDao,
                        fixture.reader,
                        fixture.tokens,
                        clock,
                        settings,
                        sites);
        var csrf = new AccountCsrf(settings);
        var auth =
                new AccountAuthService(
                        accounts,
                        new AccountPasswords(settings),
                        sessions,
                        fixture.tokens,
                        settings,
                        mock(AccountMail.class),
                        clock);
        config.register(
                new AccountAuthWs(
                        auth,
                        sessions,
                        mock(AccountOAuthService.class),
                        csrf,
                        new AccountRateLimiter(accounts, fixture.tokens, clock, settings),
                        fixture.tokens,
                        settings));
        config.register(
                new AdminWs(
                        new AdminService(
                                accounts,
                                sessions,
                                usage,
                                new UsagePolicy(ConfigFactory.empty()),
                                fixture.reader,
                                fixture.mapper,
                                clock),
                        csrf));
        var discoveryDao = new DiscoveryDao(accounts.transactions);
        var policy = new DiscoveryPolicy(ConfigFactory.empty());
        var transport = mock(DiscoveryTransport.class);
        // Restrict the adapter to the exact public surrogate; no third-party network requests.
        doAnswer(
                        call -> {
                            controlled(call.getArgument(0));
                            return null;
                        })
                .when(transport)
                .validate(anyString(), any());
        var client = HttpClient.newHttpClient();
        when(transport.get(anyString(), anyInt(), any()))
                .thenAnswer(
                        call -> {
                            var uri = controlled(call.getArgument(0));
                            var local =
                                    URI.create(
                                            "http://127.0.0.1:3020"
                                                    + (uri.getRawPath().isEmpty()
                                                            ? "/"
                                                            : uri.getRawPath()));
                            var result =
                                    client.send(
                                            HttpRequest.newBuilder(local)
                                                    .timeout(Duration.ofSeconds(10))
                                                    .GET()
                                                    .build(),
                                            HttpResponse.BodyHandlers.ofString());
                            return new DiscoveryTransport.Response(
                                    result.statusCode(),
                                    result.headers().firstValue("content-type").orElse("text/html"),
                                    result.headers().firstValue("location").orElse(null),
                                    result.body());
                        });
        var discovery =
                new DiscoveryService(
                        accounts,
                        sessions,
                        discoveryDao,
                        domains,
                        policy,
                        transport,
                        fixture.mapper,
                        fixture.tokens,
                        clock);
        worker =
                new DiscoveryWorker(
                        discoveryDao,
                        policy,
                        new DomainCrawler(policy, transport),
                        discovery,
                        clock);
        var batchDao = new BatchDao(accounts.transactions, fixture.tokens);
        var profiles = new ConnectedProfiles(new DefaultScorePolicy());
        var batches =
                new BatchService(
                        accounts,
                        sessions,
                        batchDao,
                        discoveryDao,
                        transport,
                        audits,
                        fixture.runs,
                        runDao,
                        sites,
                        profiles,
                        fixture.mapper,
                        fixture.tokens,
                        clock);
        var summaries =
                new DomainSummaryService(
                        accounts,
                        sessions,
                        new DomainSummaryDao(accounts.transactions),
                        new ConnectedDomainDao(accounts.transactions),
                        batchDao,
                        fixture.mapper,
                        clock);
        config.register(
                        new PermissionFeature<>(
                                new AccountPermissionProvider(sessions),
                                AccountAccess.class,
                                AccountAccess::value))
                .register(AccountContextFactory.binding(sessions))
                .register(new com.dokor.argos.webservices.api.account.ReportAccessWs(
                        new ReportSharingService(accounts, sessions, fixture.reader, fixture.tokens, clock), csrf))
                .register(
                        new AccountWs(
                                accounts,
                                sessions,
                                auth,
                                personal,
                                csrf,
                                new AccountRateLimiter(accounts, fixture.tokens, clock, settings),
                                sites,
                                new AccountHistoryService(
                                        accounts, sessions, fixture.mapper, clock)))
                .register(new ConnectedProfilesWs(sessions, profiles))
                .register(new DomainDiscoveriesWs(discovery, csrf))
                .register(new DomainBatchesWs(batches, csrf))
                .register(new DomainSummariesWs(summaries))
                .register(
                        new AccountOverviewWs(
                                new AccountOverviewService(
                                        accounts,
                                        sessions,
                                        new AccountOverviewDao(),
                                        usage,
                                        clock)))
                .register(new DomainBatchProgressWs(batches, csrf, summaries));
    }

    private static URI controlled(String value) {
        var uri = URI.create(value);
        if (!"8.8.8.8".equals(uri.getHost())
                || !java.util.Set.of("http", "https").contains(uri.getScheme())
                || uri.getPort() != -1)
            throw new IllegalArgumentException("Controlled origin only");
        return uri;
    }
}
