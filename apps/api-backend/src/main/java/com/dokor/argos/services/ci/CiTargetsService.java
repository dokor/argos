package com.dokor.argos.services.ci;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.*;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import static com.dokor.argos.services.ci.CiAccountOperations.fail;

@Singleton
public class CiTargetsService {
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
    public record View(String id, String origin, String method, String state, String verifiedAt,
                       String validUntil, String nextCheckAt, String challengeExpiresAt) {}
    public record Challenge(View target, String path, String content) {
        @Override public String toString() { return "CiTargetChallenge[redacted]"; }
    }
    public record Grant(String id, String origin, long authorizationEpoch) {}
    private final AccountDao dao;
    private final CiAccountOperations accounts;
    private final CiPolicy policy;
    private final CiEntitlementService entitlement;
    private final HttpsTargetProofClient proofs;
    private final TokenService tokens;
    private final Clock clock;
    @Inject public CiTargetsService(AccountDao dao, CiAccountOperations accounts, CiPolicy policy,
            CiEntitlementService entitlement, HttpsTargetProofClient proofs, TokenService tokens, Clock clock) {
        this.dao=dao; this.accounts=accounts; this.policy=policy; this.entitlement=entitlement;
        this.proofs=proofs; this.tokens=tokens; this.clock=clock;
    }
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
    public record Page(List<View> items,String nextCursor) {}
    public Page list(String auth, long after) {
        if(after<0) throw fail(CiErrorCode.CONFIG_INVALID);
        return accounts.read(auth,(ctx,c) -> { var rows=dao.transactions.selectQuery(c).select(QCiTarget.table).from(QCiTarget.table)
            .where(QCiTarget.table.ownerUserId.eq(ctx.user().getId()),QCiTarget.table.id.gt(after))
            .orderBy(QCiTarget.table.id.asc()).limit(101).fetch();
            var shown=rows.stream().limit(100).toList();
            return new Page(shown.stream().map(this::view).toList(),rows.size()>100 ? shown.getLast().getId().toString() : null);
        });
    }
    public Challenge create(String auth, String csrf, String origin, String remote) {
        return accounts.change(auth,csrf,true,"ci-target",remote,(ctx,c) -> {
            final String canonical;
            try { canonical=CiOrigin.parse(origin); } catch(Exception invalid) { throw fail(CiErrorCode.TARGET_REJECTED); }
            var q=QCiTarget.table;
            var existing=dao.transactions.selectQuery(c).select(q).from(q)
                .where(q.ownerUserId.eq(ctx.user().getId()),q.origin.eq(canonical)).forUpdate().fetchOne();
            if(existing!=null) throw fail(CiErrorCode.IDEMPOTENCY_CONFLICT); // Explicit renew, never silently invalidate a proof.
            var limits=policy.limits().orElseThrow();
            if(limits.verifiedTargets().isPresent() && dao.transactions.selectQuery(c).select(q.id).from(q)
                .where(q.ownerUserId.eq(ctx.user().getId()),q.state.ne("REVOKED")).fetch().size()>=limits.verifiedTargets().getAsInt())
                throw fail(CiErrorCode.QUOTA_EXCEEDED);
            var target=new CiTarget(); target.setPublicId(UUID.randomUUID().toString()); target.setOwnerUserId(ctx.user().getId());
            target.setOrigin(canonical); target.setMethod("HTTPS_FILE"); target.setCreatedAt(clock.instant());
            target.setGeneration(0L); target.setAuthorizationEpoch(1L);
            return challenge(target,c);
        });
    }
    public Challenge renew(String auth,String csrf,String id,String remote) {
        return accounts.change(auth,csrf,true,"ci-target",remote,(ctx,c) -> challenge(target(ctx.user().getId(),id,c),c));
    }
    private Challenge challenge(CiTarget t,Connection c) {
        String content="argos-ci-v1="+tokens.generateToken();
        t.setChallengeHash(tokens.sha256(content)); t.setGeneration(t.getGeneration()+1);
        t.setState("PENDING"); t.setValidUntil(null); t.setChallengeExpiresAt(clock.instant().plus(Duration.ofDays(1)));
        t.setNextCheckAt(clock.instant()); dao.save(t,QCiTarget.table,c);
        return new Challenge(view(t),HttpsTargetProofClient.path(t.getPublicId()),content);
    }
    public View revoke(String auth,String csrf,String id,String remote) {
        return accounts.change(auth,csrf,false,"ci-target",remote,(ctx,c) -> {
            var t=target(ctx.user().getId(),id,c);
            if(!"REVOKED".equals(t.getState())) { t.setAuthorizationEpoch(t.getAuthorizationEpoch()+1); t.setGeneration(t.getGeneration()+1); }
            t.setState("REVOKED"); t.setChallengeHash(null); t.setValidUntil(null); dao.save(t,QCiTarget.table,c);return view(t);
        });
    }
    public View verify(String auth,String csrf,String id,String remote) {
        var candidate=accounts.change(auth,csrf,true,"ci-target",remote,(ctx,c) -> claim(target(ctx.user().getId(),id,c),c));
        boolean matched=proofs.matches(candidate.getOrigin(),candidate.getPublicId(),candidate.getChallengeHash());
        return accounts.change(auth,csrf,true,"ci-target",remote,(ctx,c) -> complete(candidate,matched,c));
    }
    private CiTarget claim(CiTarget t,Connection c) {
        Instant now=clock.instant();
        if("REVOKED".equals(t.getState()) || t.getChallengeHash()==null || !"VERIFIED".equals(t.getState()) && !t.getChallengeExpiresAt().isAfter(now))
            throw fail(CiErrorCode.TARGET_VERIFICATION_REQUIRED);
        if(t.getNextCheckAt().isAfter(now)) throw new jakarta.ws.rs.WebApplicationException(CiErrors.response(CiErrorCode.RATE_LIMITED,
            Math.max(1,Duration.between(now,t.getNextCheckAt()).getSeconds())));
        // Persistent multi-instance lease. No account/target/connection held during network I/O.
        t.setNextCheckAt(now.plusSeconds(60)); t.setGeneration(t.getGeneration()+1); dao.save(t,QCiTarget.table,c); return t;
    }
    private View complete(CiTarget observed,boolean matched,Connection c) {
        var t=target(observed.getOwnerUserId(),observed.getPublicId(),c);
        if(!t.getGeneration().equals(observed.getGeneration()) || "REVOKED".equals(t.getState()))
            throw fail(CiErrorCode.TARGET_VERIFICATION_REQUIRED);
        var now=clock.instant();
        if(!"VERIFIED".equals(t.getState()) && !t.getChallengeExpiresAt().isAfter(now)) matched=false;
        t.setState(matched || "VERIFIED".equals(t.getState()) ? "VERIFIED" : "PENDING");
        if(matched) t.setVerifiedAt(now);
        t.setValidUntil(matched ? now.plus(Duration.ofDays(7)) : null);
        t.setNextCheckAt(now.plus(matched ? Duration.ofDays(1) : Duration.ofMinutes(5)));
        dao.save(t,QCiTarget.table,c); return view(t);
    }
    private View view(CiTarget t) {
        String state="VERIFIED".equals(t.getState()) && (t.getValidUntil()==null || !t.getValidUntil().isAfter(clock.instant())) ? "EXPIRED"
            : "PENDING".equals(t.getState()) && !t.getChallengeExpiresAt().isAfter(clock.instant()) ? "EXPIRED" : t.getState();
        return new View(t.getPublicId(),t.getOrigin(),t.getMethod(),state,iso(t.getVerifiedAt()),iso(t.getValidUntil()),iso(t.getNextCheckAt()),iso(t.getChallengeExpiresAt()));
    }
    private static String iso(Instant instant) { return instant==null ? null : instant.toString(); }
    public CiTarget target(long owner,String id,Connection c) {
        if(id==null || !id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        var q=QCiTarget.table;
        var t=dao.transactions.selectQuery(c).select(q).from(q).where(q.ownerUserId.eq(owner),q.publicId.eq(id)).forUpdate().fetchOne();
        if(t==null) throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);return t;
    }
    /** Caller holds the account lock. Exact target IDs are copied into a key, never expanded later. */
    public List<Grant> grants(long owner,List<String> ids,Connection c) {
        if(ids==null || ids.isEmpty() || ids.size()>CiOrigin.MAX_ORIGINS || new HashSet<>(ids).size()!=ids.size()) throw fail(CiErrorCode.CONFIG_INVALID);
        var result=new ArrayList<Grant>();
        for(String id:ids.stream().sorted().toList()) {
            var t=target(owner,id,c);
            if(!"VERIFIED".equals(view(t).state())) throw fail(CiErrorCode.TARGET_VERIFICATION_REQUIRED);
            result.add(new Grant(t.getPublicId(),t.getOrigin(),t.getAuthorizationEpoch()));
        }
        return List.copyOf(result);
    }
    public void requireGrants(long owner,List<Grant> grants,String url,Connection c) {
        if(grants==null || grants.isEmpty()) throw fail(CiErrorCode.TARGET_VERIFICATION_REQUIRED);
        for(var grant:grants) {
            var t=target(owner,grant.id(),c);
            if(!"VERIFIED".equals(view(t).state()) || !t.getOrigin().equals(grant.origin()) || t.getAuthorizationEpoch()!=grant.authorizationEpoch())
                throw fail(CiErrorCode.TARGET_VERIFICATION_REQUIRED);
        }
        try { CiOrigin.require(grants.stream().map(Grant::origin).toList(),url); }
        catch(Exception denied) { throw fail(CiErrorCode.TARGET_REJECTED); }
    }
    public record GrantState(String origin,String state,boolean authorizedForKey) {}
    /** Read-only doctor projection; no DNS, verification, lease or challenge mutation. */
    public List<GrantState> inspect(long owner,List<Grant> grants,Connection c) {
        return grants.stream().map(grant->{
            var t=target(owner,grant.id(),c);var state=view(t).state();
            return new GrantState(grant.origin(),state,"VERIFIED".equals(state) && t.getOrigin().equals(grant.origin()) && t.getAuthorizationEpoch()==grant.authorizationEpoch());
        }).toList();
    }
    /** Two proofs per tick, bounded network time, no work while the CI kill switch is closed. */
    public void tick() {
        if(policy.limits().isEmpty()) return;
        var q=QCiTarget.table;
        var user=QAccountUser.table; var right=QAccountCiEntitlement.table;
        var candidates=dao.transactions.selectQuery().select(q).from(q)
            .join(user).on(user.id.eq(q.ownerUserId)).join(right).on(right.id.eq(q.ownerUserId))
            .where(q.state.eq("VERIFIED"),q.nextCheckAt.loe(clock.instant()),user.state.eq("ACTIVE"),user.offer.eq("PREMIUM"),
                right.ciAccess.isTrue(),right.validUntil.gt(clock.instant()))
            .orderBy(q.nextCheckAt.asc()).limit(2).fetch();
        for(var candidate:candidates) {
            try {
                var claimed=dao.transaction(c -> { entitlement.requireNewAccess(candidate.getOwnerUserId(),c);return claim(target(candidate.getOwnerUserId(),candidate.getPublicId(),c),c); });
                boolean matched=proofs.matches(claimed.getOrigin(),claimed.getPublicId(),claimed.getChallengeHash());
                dao.transaction(c -> { entitlement.requireNewAccess(claimed.getOwnerUserId(),c);return complete(claimed,matched,c); });
            } catch(Exception rejected) { /* No raw DNS/URL/proof/SQL data in logs; expired proofs remain closed. */ }
        }
    }
}
