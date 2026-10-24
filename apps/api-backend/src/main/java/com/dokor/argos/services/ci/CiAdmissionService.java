package com.dokor.argos.services.ci;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.ci.errors.*;
import com.dokor.argos.services.connected.discovery.*;
import com.dokor.argos.services.domain.audit.*;
import com.dokor.argos.services.domain.report.ReportRetentionPolicy;
import com.dokor.argos.services.token.TokenService;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.*;
import jakarta.inject.*;
import java.net.URI;
import java.security.MessageDigest;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import static com.dokor.argos.services.ci.CiAccountOperations.fail;

/** No client owner, grants, quota overrides, credentials of a target, or disabled server controls. */
@Singleton
public class CiAdmissionService {
    public record Input(String url,int samples,String profileId) {}
    public record Admission(int apiVersion,String id,String profileId,int samples,String createdAt,List<CiRequestDao.Run> runs) {}
    public record Creation(Admission admission,boolean created) {}
    public record Usage(int apiVersion,CiQuotaService.Snapshot usage) {}
    public record Preflight(int apiVersion,boolean newAccessAllowed,List<String> scopes,List<CiTargetsService.GrantState> targets,CiQuotaService.Snapshot usage) {}
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Report(int apiVersion,String kind,String runId,Integer globalScore,Integer scoringVersion,Integer criticalCount,Integer importantCount,
                         String completeness,String generatedAt,String expiresAt) {}
    public record ArtifactPolicy(String visibility,int retentionDays,int diagnosticRetentionDays,boolean automaticUpload) {}
    public record PublicIssue(String title,String body) {}
    public record Export(int apiVersion,String kind,Report summary,String reportPath,CiExportProjection details,ArtifactPolicy artifactPolicy,PublicIssue publicIssue) {}
    public record Deletion(int apiVersion,String runId,boolean deleted) {}
    public static final ArtifactPolicy ARTIFACT_POLICY=new ArtifactPolicy("private",7,1,false);
    public static final PublicIssue PUBLIC_ISSUE=new PublicIssue("Argos audit: review required",
        "An Argos CI audit requires an authenticated review. Open Argos with your own account. Findings are available only through authenticated access.");
    private final ReportRetentionPolicy retention;
    private final CiKeysService keys;private final CiTargetsService targets;private final CiEntitlementService entitlement;
    private final CiQuotaService quotas;private final CiRequestDao requests;private final AuditRunService runs;
    private final AccountDao dao;private final DiscoveryTransport transport;private final ObjectMapper mapper;private final TokenService tokens;private final Clock clock;
    @Inject public CiAdmissionService(CiKeysService keys,CiTargetsService targets,CiEntitlementService entitlement,CiQuotaService quotas,
            CiRequestDao requests,AuditRunService runs,AccountDao dao,DiscoveryTransport transport,ObjectMapper mapper,TokenService tokens,Clock clock,ReportRetentionPolicy retention) {
        this.keys=keys;this.targets=targets;this.entitlement=entitlement;this.quotas=quotas;this.requests=requests;this.runs=runs;
        this.dao=dao;this.transport=transport;this.mapper=mapper;this.tokens=tokens;this.clock=clock;
        this.retention=retention;
    }
    public static Input input(JsonNode json) {
        if(json==null || !json.isObject() || json.size()!=3 || !json.path("url").isTextual() || !json.path("samples").isInt()
            || !json.path("profileId").isTextual() || !"standard-v1".equals(json.path("profileId").asText())
            || json.path("samples").intValue()<1 || json.path("samples").intValue()>2)throw fail(CiErrorCode.CONFIG_INVALID);
        return canonical(new Input(json.path("url").asText(),json.path("samples").intValue(),json.path("profileId").asText()));
    }
    private static Input canonical(Input input) {
        if(input==null || input.samples()<1 || input.samples()>2 || !"standard-v1".equals(input.profileId()))throw fail(CiErrorCode.CONFIG_INVALID);
        try {
            var uri=URI.create(input.url());
            if(!"https".equalsIgnoreCase(uri.getScheme()) || uri.getRawQuery()!=null || uri.getRawFragment()!=null)throw new IllegalArgumentException();
            String url=UrlNormalizer.normalizeSyntax(input.url());CiOrigin.ofUrl(url);return new Input(url,input.samples(),input.profileId());
        }catch(Exception rejected){throw fail(CiErrorCode.TARGET_REJECTED);}
    }
    private static String uuid(String value) {
        try {if(!UUID.fromString(value).toString().equals(value))throw new IllegalArgumentException();return value;}
        catch(Exception invalid){throw fail(CiErrorCode.CONFIG_INVALID);}
    }
    private byte[] intention(String key){return tokens.sha256("ci-request-v1:"+uuid(key));}
    private byte[] fingerprint(Input input){return tokens.sha256("ci-admission-v1\u0000"+input.url()+"\u0000"+input.profileId()+"\u0000"+input.samples());}
    public Creation create(String auth,String peer,String key,Input raw) {
        var input=canonical(raw);byte[] intent=intention(key),fingerprint=fingerprint(input);
        // Existing intentions and denied targets never cause another DNS request.
        var previous=keys.withCredential(auth,peer,"audits:write",(identity,c)->{
            var row=requests.byKey(identity,intent,c);
            if(row!=null)return recover(identity,row,fingerprint,c);
            entitlement.requireNewAccess(identity.owner(),c);targets.requireGrants(identity.owner(),identity.targets(),input.url(),c);return null;
        });
        if(previous!=null)return previous;
        try {transport.validate(input.url(),new DiscoveryBudget(Duration.ofSeconds(4),()->false));}
        catch(DiscoveryStop stopped){
            if(Set.of("DNS_BUSY","RESPONSE_TIMEOUT","TIME_LIMIT","TRANSPORT_ERROR").contains(stopped.code))throw CiRateService.limited(CiErrorCode.UPSTREAM_UNAVAILABLE,5);
            throw fail(CiErrorCode.TARGET_REJECTED);
        }
        catch(RuntimeException unavailable){throw CiRateService.limited(CiErrorCode.UPSTREAM_UNAVAILABLE,5);}
        return keys.withCredential(auth,peer,"audits:write",(identity,c)->{
            var existing=requests.byKey(identity,intent,c);if(existing!=null)return recover(identity,existing,fingerprint,c);
            entitlement.requireNewAccess(identity.owner(),c);targets.requireGrants(identity.owner(),identity.targets(),input.url(),c);
            // Existing identities are read without UPDATE locks; new metadata rolls back with the admission.
            long audit=requests.audit(input.url(),clock.instant(),c);
            String origin=CiOrigin.ofUrl(input.url());quotas.admit(identity,origin,input.samples(),c);
            var row=new CiRequest();row.setPublicId(UUID.randomUUID().toString());row.setOwnerUserId(identity.owner());row.setIntegrationId(identity.integrationId());
            row.setIdempotencyHash(intent);row.setRequestFingerprint(fingerprint);row.setProfileId(input.profileId());row.setSamples(input.samples());row.setCreatedAt(clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
            var origins=CiOrigin.scope(identity.targets().stream().map(CiTargetsService.Grant::origin).toList());row.setNavigationOrigins(json(origins));requests.save(row,c);
            for(int n=1;n<=input.samples();n++) {
                var run=runs.createCiQueuedRun(audit,clock.instant(),identity.owner(),c,origins);quotas.attribute(run,identity,origin,row.getPublicId(),n,c);
            }
            return new Creation(view(row,c),true);
        });
    }
    private Creation recover(CiKeysService.Context identity,CiRequest row,byte[] fingerprint,Connection c) {
        visible(identity,row);
        if(!MessageDigest.isEqual(row.getRequestFingerprint(),fingerprint))throw fail(CiErrorCode.IDEMPOTENCY_CONFLICT);
        return new Creation(view(row,c),false);
    }
    public Admission byKey(String auth,String peer,String key){return keys.withCredential(auth,peer,"results:read",(identity,c)->{
        var row=requests.byKey(identity,intention(key),c);visible(identity,row);return view(row,c);
    });}
    public Admission get(String auth,String peer,String id){return keys.withCredential(auth,peer,"results:read",(identity,c)->{
        var row=requests.byId(identity,uuid(id),c);visible(identity,row);return view(row,c);
    });}
    public CiRequestDao.Run run(String auth,String peer,long id){return keys.withCredential(auth,peer,"results:read",(identity,c)->{
        var row=requests.forRun(identity,id,c);visible(identity,row);return requests.runs(row,c).stream().filter(run->run.id().equals(Long.toString(id))).findFirst().orElseThrow(()->fail(CiErrorCode.RESOURCE_NOT_AVAILABLE));
    });}
    public Report report(String auth,String peer,long id){return keys.withCredential(auth,peer,"results:read",(identity,c)->{
        var row=requests.forRun(identity,id,c);visible(identity,row);
        return report(id,c);
    });}
    private Report report(long id,Connection c) {
        var q=QAuditReport.auditReport;
        var r=QAuditRun.auditRun;
        var result=dao.transactions.selectQuery(c).select(q.globalScore,q.scoringVersion,q.criticalCount,q.importantCount,q.measurementCompleteness,q.createdAt,q.expiresAt)
            .from(q).join(r).on(r.id.eq(q.runId)).where(q.runId.eq(id),r.status.eq("COMPLETED"),r.ciNavigationOrigins.isNotNull()).fetchOne();
        if(result==null || retention.ciExpired(result.get(q.createdAt),result.get(q.expiresAt),clock.instant()))throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        String completeness=result.get(q.measurementCompleteness);
        if(!Set.of("FULL","PARTIAL","UNKNOWN").contains(completeness))throw fail(CiErrorCode.INTERNAL_ERROR);
        var score=result.get(q.globalScore);
        if(score!=null && (score<0 || score>100) || java.util.stream.Stream.of(result.get(q.scoringVersion),result.get(q.criticalCount),result.get(q.importantCount)).anyMatch(value->value!=null && value<0))
            throw fail(CiErrorCode.INTERNAL_ERROR);
        return new Report(1,"summary-v1",Long.toString(id),result.get(q.globalScore),result.get(q.scoringVersion),result.get(q.criticalCount),result.get(q.importantCount),
            completeness,iso(result.get(q.createdAt)),iso(result.get(q.expiresAt)==null || retention.ciExpiresAt(result.get(q.createdAt)).isBefore(result.get(q.expiresAt))
                ?retention.ciExpiresAt(result.get(q.createdAt)):result.get(q.expiresAt)));
    }
    public Export export(String auth,String peer,long id){return keys.withCredential(auth,peer,"results:read",(identity,c)->{
        visible(identity,requests.forRun(identity,id,c));var summary=report(id,c);
        var q=QAuditReport.auditReport;
        var json=dao.transactions.selectQuery(c).select(q.ciExportJson).from(q).where(q.runId.eq(id),
            com.querydsl.core.types.dsl.Expressions.numberTemplate(Integer.class,"OCTET_LENGTH({0})",q.ciExportJson).loe(CiExportProjection.MAX_BYTES)).fetchOne();
        // No fallback to report_json or result_json, including legacy/missing snapshots.
        if(json==null)throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        try {
            var details=CiExportProjection.read(json,mapper);
            var value=new Export(1,"details-v1",summary,"/api/ci/v1/runs/"+id+"/report",details,ARTIFACT_POLICY,PUBLIC_ISSUE);
            if(mapper.writeValueAsBytes(value).length>65536)throw new IllegalArgumentException();
            return value;
        }catch(Exception invalid){throw fail(CiErrorCode.INTERNAL_ERROR);}
    });}
    /** Idempotent deletion keeps the run/intention and accounting ledger, never launches a rerun. */
    public Deletion deleteReport(String auth,String peer,long id){return keys.withCredential(auth,peer,"audits:write",(identity,c)->{
        if(!identity.scopes().contains("results:read"))throw fail(CiErrorCode.PERMISSION_DENIED);
        visible(identity,requests.forRun(identity,id,c));
        var r=QAuditRun.auditRun;var q=QAuditReport.auditReport;
        String status=dao.transactions.selectQuery(c).select(r.status).from(r).where(r.id.eq(id),r.ciNavigationOrigins.isNotNull()).forUpdate().fetchOne();
        if(status==null || !Set.of("COMPLETED","FAILED","CANCELED").contains(status))throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        dao.transactions.delete(q,c).where(q.runId.eq(id)).execute();
        dao.transactions.update(r,c).set(r.resultJson,(String)null).set(r.lastError,(String)null).set(r.moduleStatuses,(String)null)
            .set(r.claimToken,(String)null).set(r.reportTokenHash,(byte[])null).where(r.id.eq(id)).execute();
        return new Deletion(1,Long.toString(id),true);
    });}
    public Usage usage(String auth,String peer){return keys.withCredential(auth,peer,"usage:read",(identity,c)->new Usage(1,quotas.snapshot(identity,c)));}
    public Preflight preflight(String auth,String peer){return keys.withCredential(auth,peer,"usage:read",(identity,c)->{
        boolean allowed=true;
        try {entitlement.requireNewAccess(identity.owner(),c);}catch(CiEntitlementService.Denied denied){allowed=false;}
        var proofs=targets.inspect(identity.owner(),identity.targets(),c);
        return new Preflight(1,allowed,identity.scopes().stream().sorted().toList(),proofs,quotas.snapshot(identity,c));
    });}
    private void visible(CiKeysService.Context identity,CiRequest row) {
        if(row==null || row.getOwnerUserId()!=identity.owner() || row.getIntegrationId()!=identity.integrationId())throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        try {
            var origins=CiOrigin.scope(mapper.readValue(row.getNavigationOrigins(),new TypeReference<List<String>>(){}));
            if(!identity.targets().stream().map(CiTargetsService.Grant::origin).toList().containsAll(origins))throw fail(CiErrorCode.RESOURCE_NOT_AVAILABLE);
        }catch(jakarta.ws.rs.WebApplicationException rejected){throw rejected;}
        catch(Exception invalid){throw fail(CiErrorCode.INTERNAL_ERROR);}
    }
    private Admission view(CiRequest row,Connection c){return new Admission(1,row.getPublicId(),row.getProfileId(),row.getSamples(),iso(row.getCreatedAt()),requests.runs(row,c));}
    private String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception failed){throw fail(CiErrorCode.INTERNAL_ERROR);}}
    private static String iso(Instant value){return value==null?null:value.toString();}
}
