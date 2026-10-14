package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.domain.report.ReportReadService;
import com.dokor.argos.services.analysis.AuditModule;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.function.BiFunction;

/** Account administration. Every entry point rechecks the current role in its transaction. */
@Singleton
public class AdminService {
 public record Page(List<Map<String,Object>> items, String nextCursor) {}
 public record Entitlement(String offer, Long monthlyLimit, boolean confirmed) {}
 private final AccountDao dao;
 private final AccountSessionService sessions;
 private final UsageService usage;
 private final UsagePolicy policy;
 private final ReportReadService reports;
 private final ObjectMapper mapper;
 private final Clock clock;
 @Inject public AdminService(AccountDao dao,AccountSessionService sessions,UsageService usage,UsagePolicy policy,
 ReportReadService reports,ObjectMapper mapper,Clock clock) {
  this.dao=dao;this.sessions=sessions;this.usage=usage;this.policy=policy;this.reports=reports;this.mapper=mapper;this.clock=clock;
 }
 private <T> T read(String auth,BiFunction<AccountSessionService.Context,Connection,T> work) {
  return sessions.with(auth,null,true,false,(ctx,c)->{requireAdmin(ctx);return work.apply(ctx,c);});
 }
 public static void requireAdmin(AccountSessionService.Context ctx) {
  if(!"ACTIVE".equals(ctx.user().getState()) || !"ADMIN".equals(ctx.user().getRole())) throw AccountError.forbidden("admin_required");
 }
 public static long id(String value) {
  try { if(value==null || !value.matches("[1-9][0-9]{0,18}")) throw new IllegalArgumentException();return Long.parseLong(value); }
  catch(IllegalArgumentException e) {throw new AccountError(400,"filter_invalid");}
 }
 private static void page(int limit,String cursor,List<Object> args,StringBuilder sql,String column) {
  if(limit<1 || limit>100) throw new AccountError(400,"limit_invalid");
  if(cursor!=null) {sql.append(" AND ").append(column).append("<?");args.add(id(cursor));}
  sql.append(" ORDER BY ").append(column).append(" DESC LIMIT ?");args.add(limit+1);
 }
 private static void choice(String value,Set<String> allowed) {
  if(value!=null && !allowed.contains(value)) throw new AccountError(400,"filter_invalid");
 }
 private static void equal(StringBuilder sql,List<Object> args,String column,Object value) {
  if(value!=null) {sql.append(" AND ").append(column).append("=?");args.add(value);}
 }
 private static List<Map<String,Object>> query(Connection c,String sql,List<Object> args) {
  try(var s=c.prepareStatement(sql)) {
   for(int i=0;i<args.size();i++) s.setObject(i+1,args.get(i));
   try(var r=s.executeQuery()) {
    var rows=new ArrayList<Map<String,Object>>();var meta=r.getMetaData();
    while(r.next()) {
     var row=new LinkedHashMap<String,Object>();
     for(int i=1;i<=meta.getColumnCount();i++) {
      String key=meta.getColumnLabel(i);Object value=r.getObject(i);
      if(value instanceof Timestamp t) value=t.toInstant().toString();
      if(key.equals("id") || key.endsWith("Id")) value=value==null?null:value.toString();
      row.put(key,value);
     }
     rows.add(row);
    }
    return rows;
   }
  } catch(SQLException e) {throw new IllegalStateException("Administration query failed",e);}
 }
 private static Page result(List<Map<String,Object>> rows,int limit) {
  boolean more=rows.size()>limit;if(more) rows.removeLast();
  return new Page(rows,more ? rows.getLast().get("id").toString() : null);
 }
 public Page users(String auth,String search,String state,String offer,int limit,String cursor) {
  return read(auth,(ctx,c)->{
   choice(state,Set.of("ACTIVE","PENDING","ARCHIVED"));
   if(offer!=null && !policy.offers().contains(offer)) throw new AccountError(400,"filter_invalid");
   var sql=new StringBuilder("SELECT id,email,display_name AS displayName,state,role,offer,created_at AS createdAt FROM ARG_ACCOUNT_USER WHERE 1=1");
   var args=new ArrayList<Object>();
   if(search!=null && !search.isBlank()) {
    if(search.length()>100) throw new AccountError(400,"filter_invalid");
    sql.append(" AND (LOCATE(LOWER(?),LOWER(display_name))>0 OR LOCATE(LOWER(?),LOWER(email))>0)");
    args.add(search.strip());args.add(search.strip());
   }
   equal(sql,args,"state",state);equal(sql,args,"offer",offer);page(limit,cursor,args,sql,"id");
   return result(query(c,sql.toString(),args),limit);
  });
 }
 public Map<String,Object> user(String auth,long id) {
  return read(auth,(ctx,c)->{
   var rows=query(c,"SELECT id,email,display_name AS displayName,state,role,offer,created_at AS createdAt FROM ARG_ACCOUNT_USER WHERE id=?",List.of(id));
   if(rows.isEmpty()) throw AccountError.missing();
   var row=rows.getFirst();row.put("usage",usage.readSnapshot(id,c));
   row.put("monthlyLimit",usage.readOverride(id,c));row.put("offers",policy.offers());return row;
  });
 }
 public Map<String,Object> entitlement(String auth,String csrf,long id,Entitlement body) {
  if(csrf==null) throw AccountError.forbidden("csrf_invalid");
  return sessions.with(auth,csrf,true,true,(ctx,c)->{
   requireAdmin(ctx);sessions.recent(ctx);
   if(body==null || !body.confirmed() || body.offer()==null || !policy.offers().contains(body.offer()) || body.monthlyLimit()!=null && (body.monthlyLimit()<0 || body.monthlyLimit()>9007199254740991L))
    throw new AccountError(400,"payload_invalid");
   // Session takes actor lock first. Lock targets consistently by rejecting edits of other admins.
   // Roles are provisioned out of band, never through this API.
   var target=dao.user(id,c,false);
   if(target==null) throw AccountError.missing();
   if("ADMIN".equals(target.getRole()) && !ctx.user().getId().equals(id)) throw AccountError.forbidden("admin_target");
   target=dao.user(id,c,true);
   if(target==null) throw AccountError.missing();
   if("ARCHIVED".equals(target.getState())) throw AccountError.forbidden("account_archived");
   usage.lock(id,c);
   Long oldLimit=usage.override(id,c);
   if(Objects.equals(target.getOffer(),body.offer()) && Objects.equals(oldLimit,body.monthlyLimit())) return Map.of("changed",false);
   var event=new AdminEvent();event.setActorId(ctx.user().getId());event.setTargetId(id);
   event.setOldOffer(target.getOffer());event.setNewOffer(body.offer());event.setOldLimit(oldLimit);event.setNewLimit(body.monthlyLimit());event.setCreatedAt(clock.instant());
   target.setOffer(body.offer());dao.save(target,c);
   usage.setOverride(id,body.monthlyLimit(),c);
   dao.save(event,QAdminEvent.table,c);
   dao.transactions.delete(QAdminEvent.table,c).where(QAdminEvent.table.createdAt.lt(clock.instant().minus(Duration.ofDays(90)))).execute();
   return Map.of("changed",true);
  });
 }
 public Map<String,Object> queue(String auth) {
  return read(auth,(ctx,c)->query(c,"SELECT COUNT(CASE WHEN status='QUEUED' THEN 1 END) AS queued,COUNT(CASE WHEN status='RUNNING' THEN 1 END) AS running FROM ARG_AUDIT_RUN WHERE status IN ('QUEUED','RUNNING')",List.of()).getFirst());
 }
 private static final String RUNS="SELECT r.id,r.owner_user_id AS userId,d.hostname AS site,r.status,r.created_at AS createdAt,r.started_at AS startedAt,r.finished_at AS finishedAt,r.attempt_count AS attempts,EXISTS(SELECT 1 FROM ARG_AUDIT_REPORT p WHERE p.run_id=r.id AND (p.expires_at IS NULL OR p.expires_at>UTC_TIMESTAMP(3))) AS reportAvailable FROM ARG_AUDIT_RUN r JOIN ARG_AUDIT a ON a.id=r.audit_id LEFT JOIN ARG_DOMAIN d ON d.id=a.domain_id WHERE 1=1";
 public Page runs(String auth,String user,String site,String status,String from,String until,int limit,String cursor) {
  return read(auth,(ctx,c)->{
   choice(status,Set.of("QUEUED","RUNNING","COMPLETED","FAILED"));
   var sql=new StringBuilder(RUNS);var args=new ArrayList<Object>();
   if("anonymous".equals(user)) sql.append(" AND r.owner_user_id IS NULL");else if(user!=null) equal(sql,args,"r.owner_user_id",id(user));
   if(site!=null) {if(site.length()>253 || !site.matches("[a-zA-Z0-9.:-]+")) throw new AccountError(400,"filter_invalid");equal(sql,args,"d.hostname",site.toLowerCase(Locale.ROOT));}
   equal(sql,args,"r.status",status);
   try {
    Instant start=from==null?null:LocalDate.parse(from).atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant end=until==null?null:LocalDate.parse(until).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    if(start!=null && end!=null && !start.isBefore(end)) throw new IllegalArgumentException();
    if(start!=null) {sql.append(" AND r.created_at>=?");args.add(Timestamp.from(start));}
    if(end!=null) {sql.append(" AND r.created_at<?");args.add(Timestamp.from(end));}
   } catch(java.time.DateTimeException | IllegalArgumentException e) {throw new AccountError(400,"filter_invalid");}
   page(limit,cursor,args,sql,"r.id");return result(query(c,sql.toString(),args),limit);
  });
 }
 public Map<String,Object> run(String auth,long id) {
  return read(auth,(ctx,c)->{
   var rows=query(c,RUNS+" AND r.id=?",List.of(id));if(rows.isEmpty()) throw AccountError.missing();
   var row=rows.getFirst();
   var extra=query(c,"SELECT module_statuses AS modules FROM ARG_AUDIT_RUN WHERE id=?",List.of(id)).getFirst();
   var modules=new LinkedHashMap<String,String>();
   try {
    var node=mapper.readTree(Objects.toString(extra.get("modules"),"{}"));
    for(var module:AuditModule.ordered()) {
     String key=module.id();
     String state=node.path(key).asText();
     if(node.isArray()) for(var item:node) if(key.equals(item.path("id").asText())) {state=item.path("status").asText();break;}
     if(Set.of("PENDING","RUNNING","COMPLETED","FAILED","SKIPPED","TIMEOUT").contains(state)) modules.put(key,state);
    }
   } catch(Exception ignored) { /* Legacy invalid progress must never expose its raw contents. */ }
   row.put("modules",modules);row.put("failureCode","FAILED".equals(row.get("status"))?"analysis_failed":null);return row;
  });
 }
 public Object report(String auth,long id) {
  return read(auth,(ctx,c)->reports.getByRunId(id).orElseThrow(AccountError::missing));
 }
 public Page events(String auth,int limit,String cursor) {
  return read(auth,(ctx,c)->{
   var sql=new StringBuilder("SELECT id,actor_id AS actorId,target_id AS targetId,old_offer AS oldOffer,new_offer AS newOffer,old_limit AS oldLimit,new_limit AS newLimit,created_at AS createdAt FROM ARG_ADMIN_EVENT WHERE created_at>=?");
   var args=new ArrayList<Object>();args.add(Timestamp.from(clock.instant().minus(Duration.ofDays(90))));
   page(limit,cursor,args,sql,"id");return result(query(c,sql.toString(),args),limit);
  });
 }
}
