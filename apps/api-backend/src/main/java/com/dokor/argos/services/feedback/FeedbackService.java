package com.dokor.argos.services.feedback;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.domain.report.*;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.*;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;

/** Private annotations. No update to the audit, report JSON, evidence or scoring policy. */
@Singleton
public class FeedbackService {
 public static final Set<String> TYPES=Set.of("BUG","SUGGESTION","FALSE_POSITIVE");
 public static final Set<String> STATUSES=Set.of("OPEN","PENDING","CONFIRMED","REJECTED","RESOLVED");
 public record Submission(String type,String description,String page,String expected,String observed,String steps,
                          String reportToken,String runId,String findingKey,String website,String urls) {
  public Submission(String type,String description,String page,String expected,String observed,String steps,String reportToken,String runId,String findingKey,String website) { this(type,description,page,expected,observed,steps,reportToken,runId,findingKey,website,null); }
  @Override public String toString() {return "FeedbackSubmission";}
 }
 public record Treatment(String status,String expectedStatus) {}
 public record Page(List<Map<String,Object>> items,String nextCursor) {}
 private final AccountDao accounts;
 private final FeedbackDao dao;
 private final AccountSessionService sessions;
 private final AuditReportDao reportDao;
 private final ReportReadService reports;
 private final TokenService tokens;
 private final Clock clock;
 @Inject public FeedbackService(AccountDao accounts,FeedbackDao dao,AccountSessionService sessions,
 AuditReportDao reportDao,ReportReadService reports,TokenService tokens,Clock clock) {
  this.accounts=accounts;this.dao=dao;this.sessions=sessions;this.reportDao=reportDao;this.reports=reports;this.tokens=tokens;this.clock=clock;
 }
 private Instant cutoff() {return clock.instant().minus(Duration.ofDays(90));}
 private static String text(String value,int max,boolean required) {
  if(value==null) {if(required) throw new AccountError(400,"payload_invalid");return null;}
  if(value.length()>max || value.chars().anyMatch(ch->Character.isISOControl(ch)&&ch!='\n'&&ch!='\r'&&ch!='\t')) throw new AccountError(400,"payload_invalid");
  value=value.strip();
  if(value.isEmpty()) {if(required) throw new AccountError(400,"payload_invalid");return null;}
  return value;
 }
 public static Submission validate(Submission b) {
  if(b==null || !TYPES.contains(Objects.toString(b.type(),"")) || b.website()!=null && !b.website().isEmpty()) throw new AccountError(400,"payload_invalid");
  if(b.page()!=null && !Set.of("PUBLIC","ACCOUNT","SITES","DOMAINS","HISTORY","USAGE","ADMIN","REPORT","OTHER").contains(b.page())) throw new AccountError(400,"payload_invalid");
  String description=text(b.description(),4000,true),expected=text(b.expected(),1000,false),observed=text(b.observed(),1000,false),steps=text(b.steps(),1000,false);
  if(!"BUG".equals(b.type()) && (expected!=null || observed!=null || steps!=null)) throw new AccountError(400,"payload_invalid");
  if(b.reportToken()!=null && (!b.reportToken().matches("[A-Za-z0-9_-]{20,512}") || b.runId()!=null)) throw new AccountError(400,"payload_invalid");
  if(b.runId()!=null) AdminService.id(b.runId());
  String key=text(b.findingKey(),200,false);
  if("FALSE_POSITIVE".equals(b.type())) {
   if(key==null || b.reportToken()==null && b.runId()==null) throw new AccountError(400,"payload_invalid");
  } else if(key!=null) throw new AccountError(400,"payload_invalid");
  return new Submission(b.type(),description,b.page(),expected,observed,steps,b.reportToken(),b.runId(),key,null,urls(b.urls()));
 }
 private static String urls(String value) {
  value=text(value,5000,false); if(value==null) return null;
  var lines=value.lines().map(String::strip).filter(line->!line.isEmpty()).toList();
  if(lines.size()>5) throw new AccountError(400,"payload_invalid");
  var normalized=new ArrayList<String>();
  for(String line:lines) {
   try {
    var uri=new java.net.URI(line).normalize();
    if(line.length()>2048 || uri.getHost()==null || uri.getUserInfo()!=null || !Set.of("http","https").contains(uri.getScheme()) || line.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException();
    normalized.add(uri.toASCIIString());
   } catch(Exception invalid) {throw new AccountError(400,"payload_invalid");}
  }
  return normalized.isEmpty()?null:String.join("\n",normalized);
 }
 public Map<String,Object> submit(String auth,String csrf,Submission raw) {
  Submission b=validate(raw);
  if(!AccountCsrf.valid(csrf)) throw AccountError.forbidden("csrf_invalid");
  return accounts.transaction(c->{
   AccountSessionService.Context ctx=auth==null?null:sessions.require(auth,csrf,false,true,c);
   Long runId=null;ReportDto report=null;
   if(b.reportToken()!=null) {
    report=reports.getByToken(b.reportToken()).orElseThrow(AccountError::missing);
    runId=reportDao.findByTokenHash(tokens.sha256(b.reportToken())).orElseThrow(AccountError::missing).getRunId();
   } else if(b.runId()!=null) {
    if(ctx==null || !"ACTIVE".equals(ctx.user().getState())) throw AccountError.missing();
    runId=AdminService.id(b.runId());
    var t=QAuditRun.auditRun;
    var run=accounts.transactions.selectQuery(c).select(t).from(t).where(t.id.eq(runId),t.ownerUserId.eq(ctx.user().getId())).fetchOne();
    if(run==null) throw AccountError.missing();
    report=reports.getByRunId(runId).orElseThrow(AccountError::missing);
   }
   if("FALSE_POSITIVE".equals(b.type())) requireFinding(report,b.findingKey());
   var row=new Feedback();row.setType(b.type());row.setStatus("OPEN");row.setDescription(b.description());row.setPage(b.page());
   row.setExpected(b.expected());row.setObserved(b.observed());row.setSteps(b.steps());row.setRunId(runId);row.setFindingKey(b.findingKey());
   row.setUrls(b.urls());row.setCreatedAt(clock.instant());row.setUpdatedAt(row.getCreatedAt());dao.save(row,c);
   return Map.of("accepted",true,"receipt",row.getId().toString());
  });
 }
 public static void requireFinding(ReportDto report,String key) {
  if(report==null || report.issues()==null || report.issues().stream().noneMatch(issue->key.equals(issue.id()))) throw AccountError.missing();
 }
 private <T> T admin(String auth,String csrf,BiFunction<AccountSessionService.Context,Connection,T> work) {
  return sessions.with(auth,csrf,true,csrf!=null,(ctx,c)->{AdminService.requireAdmin(ctx);return work.apply(ctx,c);});
 }
 public Page list(String auth,String type,String status,int limit,String cursor) {
  return admin(auth,null,(ctx,c)->{
   if(type!=null && !TYPES.contains(type) || status!=null && !STATUSES.contains(status) || limit<1 || limit>100) throw new AccountError(400,"filter_invalid");
   var rows=new ArrayList<>(dao.list(type,status,limit,cursor==null?null:AdminService.id(cursor),cutoff(),c));
   boolean more=rows.size()>limit;if(more)rows.removeLast();
   return new Page(rows.stream().map(row->view(row,false)).toList(),more?rows.getLast().getId().toString():null);
  });
 }
 public Map<String,Object> detail(String auth,long id) {
  return admin(auth,null,(ctx,c)->{
   var row=dao.get(id,cutoff(),c,false);if(row==null)throw AccountError.missing();
   var result=view(row,true);
   result.put("events",dao.events(id,c).stream().map(event->Map.of("actorId",event.getActorId().toString(),"oldStatus",event.getOldStatus(),"newStatus",event.getNewStatus(),"createdAt",event.getCreatedAt().toString())).toList());
   return result;
  });
 }
 public Map<String,Object> treat(String auth,String csrf,long id,Treatment b) {
  if(!AccountCsrf.valid(csrf))throw AccountError.forbidden("csrf_invalid");
  return admin(auth,csrf,(ctx,c)->{
   if(b==null || !STATUSES.contains(Objects.toString(b.status(),"")) || !STATUSES.contains(Objects.toString(b.expectedStatus(),"")))throw new AccountError(400,"payload_invalid");
   var row=dao.get(id,cutoff(),c,true);if(row==null)throw AccountError.missing();
   if(!row.getStatus().equals(b.expectedStatus()))throw new AccountError(409,"feedback_conflict");
   if(row.getStatus().equals(b.status()))return Map.of("changed",false);
   var event=new FeedbackEvent();event.setFeedbackId(id);event.setActorId(ctx.user().getId());event.setOldStatus(row.getStatus());event.setNewStatus(b.status());event.setCreatedAt(clock.instant());
   row.setStatus(b.status());row.setUpdatedAt(clock.instant());dao.save(row,c);dao.event(event,c);
   return Map.of("changed",true);
  });
 }
 private static Map<String,Object> view(Feedback row,boolean detail) {
  var out=new LinkedHashMap<String,Object>();out.put("id",row.getId().toString());out.put("type",row.getType());out.put("status",row.getStatus());out.put("createdAt",row.getCreatedAt().toString());out.put("updatedAt",row.getUpdatedAt().toString());
  if(detail) {out.put("description",row.getDescription());out.put("urls",row.getUrls());out.put("page",row.getPage());out.put("expected",row.getExpected());out.put("observed",row.getObserved());out.put("steps",row.getSteps());out.put("runId",row.getRunId()==null?null:row.getRunId().toString());out.put("findingKey",row.getFindingKey());}
  return out;
 }
 public void purge() {accounts.transaction(c->dao.purge(cutoff(),c));}
}
