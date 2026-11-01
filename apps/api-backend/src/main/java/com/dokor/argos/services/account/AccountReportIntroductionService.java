package com.dokor.argos.services.account;

import com.dokor.argos.services.domain.report.*;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.*;
import java.sql.*;
import java.time.Clock;

@Singleton
public class AccountReportIntroductionService {
    public record Editor(ReportIntroduction introduction) {}
    private final AccountSessionService sessions;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final TokenService tokens;
    private final ReportRetentionPolicy retention;
    public AccountReportIntroductionService(AccountSessionService sessions, ObjectMapper mapper, Clock clock, TokenService tokens) {
        this(sessions, mapper, clock, tokens, ReportRetentionPolicy.defaults());
    }
    @Inject public AccountReportIntroductionService(AccountSessionService sessions, ObjectMapper mapper, Clock clock, TokenService tokens, ReportRetentionPolicy retention) {
        this.sessions = sessions; this.mapper = mapper; this.clock = clock; this.tokens = tokens; this.retention = retention;
    }
    public Editor read(String auth, String token) { return access(auth, null, token, null, false); }
    public Editor publish(String auth, String csrf, String token, ReportIntroduction input) {
        if (input == null) throw new AccountError(400, "introduction_invalid");
        return access(auth, csrf, token, input, true);
    }
    public Editor revoke(String auth, String csrf, String token) { return access(auth, csrf, token, null, true); }
    private Editor access(String auth, String csrf, String token, ReportIntroduction input, boolean write) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{20,512}")) throw AccountError.missing();
        if (write && (csrf == null || csrf.isBlank())) throw AccountError.forbidden("csrf_invalid");
        return sessions.with(auth, csrf, true, true, (ctx, c) -> {
            try (var statement = c.prepareStatement("""
                SELECT p.id,p.report_json,p.introduction_json,p.created_at,p.expires_at FROM ARG_AUDIT_REPORT p
                JOIN ARG_AUDIT_RUN r ON r.id=p.run_id
                WHERE r.ci_navigation_origins IS NULL AND r.owner_user_id=? AND p.token_hash=? AND (p.expires_at IS NULL OR p.expires_at>?)
                """ + (write ? " FOR UPDATE" : ""))) {
                statement.setLong(1, ctx.user().getId()); statement.setBytes(2, tokens.sha256(token));
                statement.setTimestamp(3, Timestamp.from(clock.instant()));
                long id; String json, existing;
                try (var row = statement.executeQuery()) {
                    if (!row.next()) throw AccountError.missing();
                    id = row.getLong(1); json = row.getString(2); existing = row.getString(3);
                    var entity = new com.dokor.argos.db.generated.AuditReport();
                    var created = row.getTimestamp(4); var expires = row.getTimestamp(5);
                    entity.setCreatedAt(created == null ? null : created.toInstant());
                    entity.setExpiresAt(expires == null ? null : expires.toInstant());
                    if (retention.expired(entity, clock.instant())) throw AccountError.missing();
                }
                if (!write) return new Editor(existing == null ? null : mapper.readValue(existing, ReportIntroduction.class));
                var note = input == null ? null : ReportIntroduction.prepare(input, mapper.readValue(json, ReportDto.class), clock.instant().toString());
                try (var update = c.prepareStatement("UPDATE ARG_AUDIT_REPORT SET introduction_json=? WHERE id=?")) {
                    update.setString(1, note == null ? null : mapper.writeValueAsString(note)); update.setLong(2, id); update.executeUpdate();
                }
                sessions.event("report_introduction", note == null ? "revoked" : "published", ctx.user().getId(), ctx.session().getId(), c);
                return new Editor(note);
            } catch (java.io.IOException | SQLException e) { throw new IllegalStateException("Report introduction operation failed", e); }
        });
    }
}
