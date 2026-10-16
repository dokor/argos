package com.dokor.argos.services.domain.report;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.dao.ReportSharingDao;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.account.AccountSessionService;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;

/** Sharing policy and transaction orchestration; SQL belongs to ReportSharingDao. */
@Singleton
public class ReportSharingService {
    public record Link(String token, String expiresAt) {}
    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final ReportReadService reports;
    private final TokenService tokens;
    private final Clock clock;
    private final ReportSharingDao shares;

    @Inject
    public ReportSharingService(AccountDao dao, AccountSessionService sessions, ReportReadService reports,
                                TokenService tokens, Clock clock, ReportSharingDao shares) {
        this.dao = dao;
        this.sessions = sessions;
        this.reports = reports;
        this.tokens = tokens;
        this.clock = clock;
        this.shares = shares;
    }

    public Link create(String auth, String csrf, long run, int days) {
        if (days != 7 && days != 30 && days != 0) throw AccountError.forbidden("payload_invalid");
        return sessions.with(auth, csrf, true, true, (context, connection) -> {
            if (!shares.lockOwnedRun(connection, run, context.user().getId())) throw AccountError.missing();
            reports.getByRunId(run).orElseThrow(AccountError::missing);
            String token = tokens.generateToken();
            var expiry = days == 0 ? null : clock.instant().plus(Duration.ofDays(days));
            if (!shares.replace(connection, run, tokens.sha256(token), expiry)) throw AccountError.missing();
            return new Link(token, expiry == null ? null : expiry.toString());
        });
    }

    public void revoke(String auth, String csrf, long run) {
        sessions.with(auth, csrf, true, true, (context, connection) -> {
            if (!shares.lockOwnedRun(connection, run, context.user().getId())) throw AccountError.missing();
            shares.replace(connection, run, null, null);
            return null;
        });
    }

    public Optional<ReportDto> shared(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) return Optional.empty();
        return dao.transaction(connection -> shares.findActiveRun(connection, tokens.sha256(token), clock.instant()))
            .flatMap(reports::getByRunId);
    }

    public ReportDto details(String auth, String token, boolean shared) {
        sessions.with(auth, null, true, true, (context, connection) -> null);
        return (shared ? shared(token) : reports.getByToken(token)).orElseThrow(AccountError::missing);
    }
}
