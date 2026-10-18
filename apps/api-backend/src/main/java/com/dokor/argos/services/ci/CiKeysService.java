package com.dokor.argos.services.ci;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.ci.errors.CiErrorCode;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.*;
import java.sql.Connection;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.BiFunction;
import static com.dokor.argos.services.ci.CiAccountOperations.fail;

@Singleton
public class CiKeysService {
    public static final Set<String> SCOPES=Set.of("audits:write","results:read","usage:read");
    public record Input(String name,List<String> scopes,List<String> targetIds,String integrationId,String expiresAt) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record View(String id,String integrationId,int slot,String name,List<String> scopes,List<CiTargetsService.Grant> targets,
                       String createdAt,String expiresAt,String lastUsedAt,String revokedAt,String overlapUntil) {}
    public record IntegrationView(String id,int slot,boolean canReplace) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Page(List<View> items,List<IntegrationView> integrations,String nextCursor) {}
    public record Issued(View key,String credential) {
        @Override public String toString() {return "CiKeyIssued[redacted]";}
    }
    /** Server-only identity; never accept owner/integration/scopes from an API request body. */
    public record Context(long owner,long integrationId,String integrationPublicId,String keyId,
                          Set<String> scopes,List<CiTargetsService.Grant> targets) {}
    private static final class InvalidCredential extends RuntimeException {}
    private final AccountDao dao; private final CiAccountOperations accounts; private final CiTargetsService targets;
    private final CiPolicy policy; private final CiAuthLimiter limiter; private final AccountSessionService sessions;
    private final TokenService tokens; private final ObjectMapper mapper; private final Clock clock;
    @Inject public CiKeysService(AccountDao dao,CiAccountOperations accounts,CiTargetsService targets,CiPolicy policy,
            CiAuthLimiter limiter,AccountSessionService sessions,TokenService tokens,ObjectMapper mapper,Clock clock) {
        this.dao=dao;this.accounts=accounts;this.targets=targets;this.policy=policy;this.limiter=limiter;
        this.sessions=sessions;this.tokens=tokens;this.mapper=mapper;this.clock=clock;
    }
    public boolean enabled() {return policy.limits().isPresent();}
    public Page list(String auth,long after) {
        if(after<0) throw fail(CiErrorCode.CONFIG_INVALID);
        return accounts.read(auth,(ctx,c)->{
            var integrations=integrations(ctx.user().getId(),c);
            var byId=new HashMap<Long,CiIntegration>();integrations.forEach(i->byId.put(i.getId(),i));
            var q=QCiApiKey.table;var i=QCiIntegration.table;
            var rows=dao.transactions.selectQuery(c).select(q).from(q).join(i).on(i.id.eq(q.integrationId))
                .where(i.ownerUserId.eq(ctx.user().getId()),q.id.gt(after)).orderBy(q.id.asc()).limit(6).fetch();
            // Five snapshots of 100 origins stay below the BFF's 256 KiB response budget.
            var shown=rows.stream().limit(5).toList();
            return new Page(shown.stream().map(key->view(key,byId.get(key.getIntegrationId()))).toList(),
                integrations.stream().map(integration->new IntegrationView(integration.getPublicId(),integration.getSlot(),live(integration.getId(),c).isEmpty())).toList(),
                rows.size()>5?shown.getLast().getId().toString():null);
        });
    }
    public Issued create(String auth,String csrf,Input input,String remote) {
        return accounts.change(auth,csrf,true,"ci-key",remote,(ctx,c)->{
            validate(input);
            var limits=policy.limits().orElseThrow();
            var all=integrations(ctx.user().getId(),c);
            CiIntegration integration;
            if(input.integrationId()!=null) {
                integration=integration(ctx.user().getId(),input.integrationId(),c);
                if(integration.getSlot()>limits.activeKeys()) throw fail(CiErrorCode.QUOTA_EXCEEDED);
                if(!live(integration.getId(),c).isEmpty()) throw fail(CiErrorCode.IDEMPOTENCY_CONFLICT);
            } else {
                if(all.size()>=limits.activeKeys()) throw fail(CiErrorCode.QUOTA_EXCEEDED);
                int slot=1;var used=all.stream().map(CiIntegration::getSlot).toList();while(used.contains(slot)) slot++;
                integration=new CiIntegration();integration.setPublicId(UUID.randomUUID().toString());integration.setOwnerUserId(ctx.user().getId());
                integration.setSlot(slot);integration.setCreatedAt(now());dao.save(integration,QCiIntegration.table,c);
            }
            var grants=targets.grants(ctx.user().getId(),input.targetIds(),c);
            var issued=issue(integration,input.name(),input.scopes().stream().sorted().toList(),grants,expiry(input.expiresAt()),c);
            sessions.event("CI_KEY_CREATED","SUCCESS",ctx.user().getId(),ctx.session().getId(),c);
            return issued;
        });
    }
    public Issued rotate(String auth,String csrf,String publicId,String remote) {
        return accounts.change(auth,csrf,true,"ci-key",remote,(ctx,c)->{
            var key=ownedKey(ctx.user().getId(),publicId,c);
            var integration=integrationById(ctx.user().getId(),key.getIntegrationId(),c);
            if(integration.getSlot()>policy.limits().orElseThrow().activeKeys()) throw fail(CiErrorCode.QUOTA_EXCEEDED);
            if(!active(key) || key.getOverlapUntil()!=null) throw fail(CiErrorCode.IDEMPOTENCY_CONFLICT);
            var grants=grants(key);targets.requireGrants(ctx.user().getId(),grants,grants.getFirst().origin(),c);
            for(var old:live(integration.getId(),c)) if(!old.getId().equals(key.getId())) {old.setRevokedAt(now());dao.save(old,QCiApiKey.table,c);}
            var overlap=now().plus(Duration.ofMinutes(15));key.setOverlapUntil(overlap.isBefore(key.getExpiresAt())?overlap:key.getExpiresAt());
            dao.save(key,QCiApiKey.table,c);
            var issued=issue(integration,key.getName(),scopes(key),grants,expiry(null),c);
            sessions.event("CI_KEY_ROTATED","SUCCESS",ctx.user().getId(),ctx.session().getId(),c);
            return issued;
        });
    }
    public View revoke(String auth,String csrf,String publicId,String remote) {
        return accounts.change(auth,csrf,false,"ci-key",remote,(ctx,c)->{
            var key=ownedKey(ctx.user().getId(),publicId,c);
            if(key.getRevokedAt()==null) {
                key.setRevokedAt(now());dao.save(key,QCiApiKey.table,c);
                sessions.event("CI_KEY_REVOKED","SUCCESS",ctx.user().getId(),ctx.session().getId(),c);
            }
            return view(key,integrationById(ctx.user().getId(),key.getIntegrationId(),c));
        });
    }
    /** Common machine gate. Admission handlers must additionally recheck entitlement and target grants on c. */
    public <T> T withCredential(String authorization,String peer,String requiredScope,BiFunction<Context,Connection,T> work) {
        return CiAccountOperations.boundary(()->{
            if(!enabled()) throw fail(CiErrorCode.AUTHENTICATION_FAILED);
            String credential=CiKeyMaterial.credential(authorization);
            // A malicious caller behind a shared proxy must not lock out a valid credential.
            // Ingress and authenticated budgets separately bound storage/traffic costs.
            if(credential==null && limiter.blocked(peer)) throw fail(CiErrorCode.AUTHENTICATION_FAILED);
            try {
                return dao.transaction(c->{
                    var q=QCiApiKey.table;var i=QCiIntegration.table;
                    String id=credential==null?"":credential.substring(9,41);
                    var candidate=credential==null?null:dao.transactions.selectQuery(c).select(i.ownerUserId,q.secretHash).from(q).join(i).on(i.id.eq(q.integrationId)).where(q.publicId.eq(id)).fetchOne();
                    // Reject a wrong secret before taking any account/key lock. The same values
                    // are rechecked below under lock, so revocation cannot race this preliminary read.
                    if(!CiKeyMaterial.matches(tokens,credential,candidate==null?null:candidate.get(q.secretHash)))throw new InvalidCredential();
                    Long owner=candidate.get(i.ownerUserId);
                    var user=dao.user(owner,c,true);
                    var key=dao.transactions.selectQuery(c).select(q).from(q).where(q.publicId.eq(id)).forUpdate().fetchOne();
                    boolean secretMatches=CiKeyMaterial.matches(tokens,credential,key==null?null:key.getSecretHash());
                    if(!secretMatches || user==null || !"ACTIVE".equals(user.getState()) || key==null || !active(key)) throw new InvalidCredential();
                    var integration=integrationById(owner,key.getIntegrationId(),c);
                    var scopes=Set.copyOf(scopes(key));
                    if(requiredScope!=null && !scopes.contains(requiredScope)) throw fail(CiErrorCode.PERMISSION_DENIED);
                    var context=new Context(owner,integration.getId(),integration.getPublicId(),key.getPublicId(),scopes,List.copyOf(grants(key)));
                    var result=work.apply(context,c);
                    key.setLastUsedAt(now());dao.save(key,QCiApiKey.table,c);return result;
                });
            } catch(InvalidCredential rejected) {if(!limiter.blocked(peer))limiter.failed(peer);throw fail(CiErrorCode.AUTHENTICATION_FAILED);}
        });
    }
    private Issued issue(CiIntegration integration,String name,List<String> scopes,List<CiTargetsService.Grant> grants,Instant expires,Connection c) {
        var created=now();if(!expires.isAfter(created)) throw fail(CiErrorCode.CONFIG_INVALID);
        var material=CiKeyMaterial.generate(tokens);var key=new CiApiKey();
        key.setPublicId(material.publicId());key.setSecretHash(material.hash());key.setIntegrationId(integration.getId());key.setName(name.strip());
        key.setScopesJson(json(scopes));key.setTargetsJson(json(grants));key.setCreatedAt(created);key.setExpiresAt(expires);
        dao.save(key,QCiApiKey.table,c);return new Issued(view(key,integration),material.credential());
    }
    private void validate(Input input) {
        if(input==null || input.name()==null || input.name().isBlank() || input.name().length()>80 || input.name().codePoints().anyMatch(Character::isISOControl)
            || input.scopes()==null || input.scopes().isEmpty() || input.scopes().size()>SCOPES.size()
            || input.scopes().stream().anyMatch(Objects::isNull)
            || !SCOPES.containsAll(input.scopes()) || new HashSet<>(input.scopes()).size()!=input.scopes().size()
            || input.targetIds()==null || input.targetIds().isEmpty() || input.targetIds().size()>CiOrigin.MAX_ORIGINS
            || input.targetIds().stream().anyMatch(Objects::isNull)) throw fail(CiErrorCode.CONFIG_INVALID);
    }
    private Instant expiry(String requested) {
        try {
            var cap=policy.limits().orElseThrow().keyExpiresAt(now());
            var expires=requested==null?cap:Instant.parse(requested).truncatedTo(ChronoUnit.MILLIS);
            if(!expires.isAfter(now()) || expires.isAfter(cap)) throw new IllegalArgumentException();return expires;
        }catch(Exception invalid){throw fail(CiErrorCode.CONFIG_INVALID);}
    }
    private boolean active(CiApiKey key) {
        return key.getRevokedAt()==null && key.getExpiresAt().isAfter(clock.instant())
            && (key.getOverlapUntil()==null || key.getOverlapUntil().isAfter(clock.instant()));
    }
    private List<CiApiKey> live(long integration,Connection c) {
        var q=QCiApiKey.table;
        return dao.transactions.selectQuery(c).select(q).from(q).where(q.integrationId.eq(integration),q.revokedAt.isNull(),q.expiresAt.gt(clock.instant()),
            q.overlapUntil.isNull().or(q.overlapUntil.gt(clock.instant()))).orderBy(q.id.asc()).forUpdate().fetch();
    }
    private List<CiIntegration> integrations(long owner,Connection c) {
        var i=QCiIntegration.table;return dao.transactions.selectQuery(c).select(i).from(i).where(i.ownerUserId.eq(owner)).orderBy(i.slot.asc()).fetch();
    }
    private CiIntegration integration(long owner,String id,Connection c) {
        if(id==null || !id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        var i=QCiIntegration.table;var integration=dao.transactions.selectQuery(c).select(i).from(i).where(i.ownerUserId.eq(owner),i.publicId.eq(id)).forUpdate().fetchOne();
        if(integration==null) throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);return integration;
    }
    private CiIntegration integrationById(long owner,long id,Connection c) {
        var i=QCiIntegration.table;var integration=dao.transactions.selectQuery(c).select(i).from(i).where(i.ownerUserId.eq(owner),i.id.eq(id)).forUpdate().fetchOne();
        if(integration==null) throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);return integration;
    }
    private CiApiKey ownedKey(long owner,String id,Connection c) {
        if(id==null || !id.matches("[a-f0-9]{32}")) throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        var q=QCiApiKey.table;var i=QCiIntegration.table;
        var key=dao.transactions.selectQuery(c).select(q).from(q).join(i).on(i.id.eq(q.integrationId))
            .where(i.ownerUserId.eq(owner),q.publicId.eq(id)).forUpdate().fetchOne();
        if(key==null) throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);return key;
    }
    private List<String> scopes(CiApiKey key) {
        try {var values=mapper.readValue(key.getScopesJson(),new TypeReference<List<String>>(){});
            if(values==null || values.isEmpty() || !SCOPES.containsAll(values) || new HashSet<>(values).size()!=values.size()) throw new IllegalArgumentException();return List.copyOf(values);
        }catch(Exception invalid){throw fail(CiErrorCode.INTERNAL_ERROR);}
    }
    private List<CiTargetsService.Grant> grants(CiApiKey key) {
        try {var grants=mapper.readValue(key.getTargetsJson(),new TypeReference<List<CiTargetsService.Grant>>(){});
            CiOrigin.scope(grants.stream().map(CiTargetsService.Grant::origin).toList());return List.copyOf(grants);
        }catch(Exception invalid){throw fail(CiErrorCode.INTERNAL_ERROR);}
    }
    private String json(Object value) {try{return mapper.writeValueAsString(value);}catch(Exception invalid){throw fail(CiErrorCode.INTERNAL_ERROR);}}
    private View view(CiApiKey key,CiIntegration integration) {return new View(key.getPublicId(),integration.getPublicId(),integration.getSlot(),key.getName(),scopes(key),grants(key),
        iso(key.getCreatedAt()),iso(key.getExpiresAt()),iso(key.getLastUsedAt()),iso(key.getRevokedAt()),iso(key.getOverlapUntil()));}
    private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MILLIS);}
    private static String iso(Instant value){return value==null?null:value.toString();}
}
