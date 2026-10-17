package com.dokor.argos.services.analytics;

import com.dokor.argos.services.security.AdminReadAccess;
import com.typesafe.config.Config;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.Clock;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Singleton
public class AccountJourneyService {
    private static final Logger LOG = LoggerFactory.getLogger(AccountJourneyService.class);
    private static final Set<String> METHODS = Set.of("password", "google", "github", "linkedin");
    private final boolean enabled;
    private final AccountJourneyDao dao;
    private final AdminReadAccess access;
    private final Clock clock;

    @Inject
    public AccountJourneyService(Config config, AccountJourneyDao dao, AdminReadAccess access, Clock clock) {
        enabled = config.hasPath("product-analytics.enabled") && config.getBoolean("product-analytics.enabled");
        this.dao = dao; this.access = access; this.clock = clock;
    }

    public void record(AccountJourneyEvent event, Long subject, Long user, String method, String language,
                       String credential) {
        if (!enabled || subject == null || user == null || credential == null) return;
        try {
            access.require(credential);
            boolean authentication = event == AccountJourneyEvent.REGISTERED || event == AccountJourneyEvent.AUTHENTICATED;
            if (authentication ? !METHODS.contains(method) : !"none".equals(method)) return;
            dao.record(event, subject, user, method, "en".equals(language) ? "en" : "fr", clock.instant());
        } catch (RuntimeException unavailable) {
            // No request, identifier, provider response or exception text is logged.
            LOG.debug("Account measurement omitted");
        }
    }

    public void authenticated(long session, long user, String method, String language, String credential) {
        record(AccountJourneyEvent.AUTHENTICATED, session, user, method, language, credential);
        record(AccountJourneyEvent.ACTIVITY, user, user, "none", language, credential);
    }
}
