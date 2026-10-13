package com.dokor.argos.services.connected;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.QAuditRun;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import java.util.HexFormat;

/** One admission transaction: session/account lock, quota, queue, personal URL and request key. */
@Singleton
public final class ConnectedAnalysesService {
    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final AccountSitesService sites;
    private final AuditService audits;
    private final UrlNormalizer normalizer;
    private final ConnectedProfiles profiles;
    private final ObjectMapper mapper;
    private final TokenService tokens;
    @Inject public ConnectedAnalysesService(AccountDao dao, AccountSessionService sessions,
            AccountSitesService sites, AuditService audits, UrlNormalizer normalizer,
            ConnectedProfiles profiles, ObjectMapper mapper, TokenService tokens) {
        this.dao=dao; this.sessions=sessions; this.sites=sites; this.audits=audits;
        this.normalizer=normalizer; this.profiles=profiles; this.mapper=mapper; this.tokens=tokens;
    }
    public SiteAnalysisAccepted create(String auth, String csrf, String key, SiteAnalysisInput input) {
        if (key==null || !key.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))
            throw new AccountError(400,"idempotency_key_invalid");
        if (input==null || input.url()==null || input.url().length()>2048)
            throw new AccountError(400,"url_invalid");
        return sessions.with(auth,csrf,true,true,(context,c)-> {
            String normalized;
            try { normalized=normalizer.normalize(input.url()); }
            catch (IllegalArgumentException e) { throw new AccountError(400,"url_invalid"); }
            var snapshot=profiles.snapshot(input.profileId());
            var fingerprint=HexFormat.of().formatHex(tokens.sha256(normalized+"\n"+input.profileId()));
            var q=QAuditRun.auditRun;
            // A current read also sees the preceding request after waiting for the account lock.
            var previous=dao.transactions.selectQuery(c).select(q).from(q)
                .where(q.ownerUserId.eq(context.user().getId()),q.idempotencyKey.eq(key)).forUpdate().fetchOne();
            if(previous!=null) {
                if(!fingerprint.equals(previous.getRequestFingerprint())) throw new AccountError(409,"idempotency_conflict");
                return new SiteAnalysisAccepted(previous.getId().toString(),AdmittedRunStatus.valueOf(previous.getStatus()));
            }
            var created=audits.createAudit(normalized,context.user().getId(),c);
            sites.follow(context.user().getId(),created.auditId(),c);
            final String json;
            try { json=mapper.writeValueAsString(snapshot); }
            catch(Exception e) { throw new IllegalStateException("Profile serialization failed",e); }
            dao.transactions.update(q,c).set(q.idempotencyKey,key).set(q.requestFingerprint,fingerprint)
                .set(q.profileSnapshot,json).where(q.id.eq(created.runId())).execute();
            return new SiteAnalysisAccepted(Long.toString(created.runId()),AdmittedRunStatus.valueOf(created.status()));
        });
    }
}
