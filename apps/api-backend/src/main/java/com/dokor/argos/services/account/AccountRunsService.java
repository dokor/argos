package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.dokor.argos.services.token.TokenService;

import jakarta.inject.*;

import java.security.MessageDigest;
import java.time.*;
import java.util.*;

@Singleton
public class AccountRunsService {
    public record Created(AuditService.CreatedAudit audit, String proof) {}

    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final AuditService audits;
    private final AuditRunDao runs;
    private final AccountRunReadDao reads;
    private final ReportReadService reports;
    private final TokenService tokens;
    private final Clock clock;
    private final AccountSettings settings;
    private final AccountSitesService sites;

    @Inject
    public AccountRunsService(
            AccountDao dao,
            AccountSessionService sessions,
            AuditService audits,
            AuditRunDao runs,
            ReportReadService reports,
            TokenService tokens,
            Clock clock,
            AccountSettings settings, AccountSitesService sites, AccountRunReadDao reads) {
        this.dao = dao;
        this.sessions = sessions;
        this.audits = audits;
        this.runs = runs;
        this.reports = reports;
        this.tokens = tokens;
        this.clock = clock;
        this.settings = settings;
        this.sites = sites;
        this.reads = reads;
    }

    public Created create(String url, String authorization, String csrf) {
        return create(url,authorization,csrf,null);
    }
    public Created create(String url, String authorization, String csrf, com.dokor.argos.services.analysis.AuditScope scope) {
        return dao.transaction(
                c -> {
                    AccountSessionService.Context context =
                            authorization == null
                                    ? null
                                    : sessions.require(authorization, csrf, true, true, c);
                    var created =
                            scope == null ? audits.createAudit(url, context == null ? null : context.user().getId(), c)
                                : audits.createAudit(url, context == null ? null : context.user().getId(), c, scope);
                    if (context != null) { sites.follow(context.user().getId(),created.auditId(),c); return new Created(created, null); }
                    String secret = tokens.generateToken();
                    var claim = new AccountRunClaim();
                    claim.setRunId(created.runId());
                    claim.setProofHash(tokens.sha256(secret));
                    claim.setExpiresAt(
                            clock.instant()
                                    .plus(settings.duration("claim-ttl", Duration.ofHours(24))));
                    dao.save(claim, c);
                    return new Created(created, secret);
                });
    }

    private AuditRun owned(long id, long user, java.sql.Connection c) {
        return reads.owned(id, user, c).orElseThrow(AccountError::missing);
    }

    public List<Map<String, Object>> list(String authorization, int limit) {
        return sessions.with(authorization, null, true, true, (context, c) ->
            reads.list(context.user().getId(), limit, c).stream().map(this::status).toList());
    }

    public Map<String, Object> get(String authorization, long id) {
        return sessions.with(
                authorization,
                null,
                true,
                true,
                (context, c) -> { var run=owned(id,context.user().getId(),c); var result=status(run); result.put("siteId",sites.siteForRun(context.user().getId(),run.getAuditId(),c)); result.put("historyContext",sites.contextForRun(context.user().getId(),run.getAuditId(),c));
                    var q=QAuditReport.auditReport;
                    var report=dao.transactions.selectQuery(c).select(q.id,q.expiresAt).from(q).where(q.runId.eq(id)).fetchOne();
                    String availability=report==null ? ("COMPLETED".equals(run.getStatus()) || "FAILED".equals(run.getStatus()) ? "UNAVAILABLE" : "PENDING")
                        : report.get(q.expiresAt)!=null && !report.get(q.expiresAt).isAfter(clock.instant()) ? "EXPIRED" : "AVAILABLE";
                    result.put("reportAvailability",availability);
                    return result; });
    }

    public Object report(String authorization, long id) {
        return sessions.with(
                authorization,
                null,
                true,
                true,
                (context, c) -> {
                    owned(id, context.user().getId(), c);
                    return reports.getByRunId(id).orElseThrow(AccountError::missing);
                });
    }

    private Map<String, Object> status(AuditRun run) {
        var result = new LinkedHashMap<String, Object>();
        result.put("runId", run.getId().toString());
        result.put("status", run.getStatus());
        result.put("createdAt", run.getCreatedAt().toString());
        result.put("moduleStatuses", run.getModuleStatuses());
        result.put("startedAt", run.getStartedAt()==null ? null : run.getStartedAt().toString());
        result.put("finishedAt", run.getFinishedAt()==null ? null : run.getFinishedAt().toString());
        result.put("profileSnapshot", run.getProfileSnapshot());
        return result;
    }

    public void claim(String authorization, String csrf, long id, String proof) {
        if (!AccountCsrf.valid(proof)) throw AccountError.missing();
        sessions.with(
                authorization,
                csrf,
                true,
                true,
                (context, c) -> {
                    var run = runs.lockForPublication(id, c).orElseThrow(AccountError::missing);
                    var q = QAccountRunClaim.table;
                    var claim =
                            dao.transactions
                                    .selectQuery(c)
                                    .select(q)
                                    .from(q)
                                    .where(q.runId.eq(id))
                                    .forUpdate()
                                    .fetchOne();
                    var r = QAuditReport.auditReport;
                    var report =
                            dao.transactions
                                    .selectQuery(c)
                                    .select(r)
                                    .from(r)
                                    .where(r.runId.eq(id))
                                    .fetchOne();
                    if (claim == null
                            || !claim.getExpiresAt().isAfter(clock.instant())
                            || !MessageDigest.isEqual(tokens.sha256(proof), claim.getProofHash())
                            || "COMPLETED".equals(run.getStatus())
                                    && (report == null
                                            || report.getExpiresAt() != null
                                                    && !report.getExpiresAt()
                                                            .isAfter(clock.instant())))
                        throw AccountError.missing();
                    if (context.user().getId().equals(run.getOwnerUserId())
                            && context.user().getId().equals(claim.getConsumedBy())) return null;
                    if (run.getOwnerUserId() != null || claim.getConsumedBy() != null)
                        throw AccountError.missing();
                    dao.transactions
                            .update(QAuditRun.auditRun, c)
                            .set(QAuditRun.auditRun.ownerUserId, context.user().getId())
                            .where(
                                    QAuditRun.auditRun.id.eq(id),
                                    QAuditRun.auditRun.ownerUserId.isNull())
                            .execute();
                    sites.follow(context.user().getId(),run.getAuditId(),c);
                    run.setOwnerUserId(context.user().getId());
                    runs.usage().claimed(run,report==null ? null : report.getCreatedAt(),c);
                    claim.setConsumedBy(context.user().getId());
                    dao.save(claim, c);
                    sessions.event(
                            "run_claim",
                            "accepted",
                            context.user().getId(),
                            context.session().getId(),
                            c);
                    return null;
                });
    }

    public UsageService.Snapshot usage(String authorization) {
        return sessions.with(authorization,null,true,false,(context,c) ->
            runs.usage().snapshot(context.user().getId(),context.user().getOffer(),c));
    }
}
