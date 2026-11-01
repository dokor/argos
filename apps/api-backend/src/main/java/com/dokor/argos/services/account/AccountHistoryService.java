package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.AccountDao;
import com.dokor.argos.services.domain.report.AuditComparisonService;
import com.dokor.argos.services.domain.report.ReportDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.*;
import java.sql.*;
import java.time.Clock;
import java.util.*;

/** Owner-scoped history. Shared audit/domain identifiers never grant access. */
@Singleton
public class AccountHistoryService {
    public record Context(String siteId, String siteUrlId, String normalizedUrl) {}
    public record Item(String runId, String status, String createdAt, String finishedAt,
                       boolean reportAvailable, String publishedAt, String expiresAt,
                       Integer globalScore, Integer scoringVersion, Double coverage, Boolean provisional,
                       AuditComparisonService.Comparison comparison) {}
    public record History(Context context, List<Item> items, String nextCursor) {}
    private record Row(String id, String status, String created, String finished, String published,
                       String expires, ReportDto report) {}
    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final ObjectMapper mapper;
    private final Clock clock;

    @Inject public AccountHistoryService(AccountDao dao, AccountSessionService sessions, ObjectMapper mapper, Clock clock) {
        this.dao=dao; this.sessions=sessions; this.mapper=mapper; this.clock=clock;
    }

    public History history(String auth, long urlId, int limit, String cursor) {
        int size=AccountSitesService.limit(limit); long before=AccountSitesService.cursor(cursor);
        return sessions.with(auth,null,true,true,(ctx,c)-> {
            long owner=ctx.user().getId();
            Context context; long audit;
            try(var s=c.prepareStatement("SELECT s.id,u.id,a.id,a.normalized_url FROM ARG_ACCOUNT_SITE_URL u JOIN ARG_ACCOUNT_SITE s ON s.id=u.site_id JOIN ARG_AUDIT a ON a.id=u.audit_id WHERE s.owner_user_id=? AND u.id=?")) {
                s.setLong(1,owner); s.setLong(2,urlId);
                try(var r=s.executeQuery()) { if(!r.next()) throw AccountError.missing(); audit=r.getLong(3); context=new Context(r.getString(1),r.getString(2),r.getString(4)); }
            } catch(SQLException e) { throw failure(e); }
            Timestamp anchor=null;
            if(before>0) {
                try(var s=c.prepareStatement("SELECT created_at FROM ARG_AUDIT_RUN WHERE ci_navigation_origins IS NULL AND owner_user_id=? AND audit_id=? AND id=?")) {
                    s.setLong(1,owner);s.setLong(2,audit);s.setLong(3,before);
                    try(var r=s.executeQuery()) { if(!r.next()) throw new AccountError(400,"cursor_invalid"); anchor=r.getTimestamp(1); }
                } catch(SQLException e) { throw failure(e); }
            }
            var rows=new ArrayList<Row>();
            // Only the requested bounded page and one predecessor are read. No tokens/results leave this service.
            String boundary=before>0 ? " AND (r.created_at<? OR (r.created_at=? AND r.id<?))" : "";
            try(var s=c.prepareStatement("""
                SELECT r.id,r.status,r.created_at,r.finished_at,p.created_at published,p.expires_at,
                  IF(JSON_VALID(p.report_json),JSON_OBJECT('url',JSON_EXTRACT(p.report_json,'$.url'),
                    'scores',JSON_EXTRACT(p.report_json,'$.scores')),NULL) report_json
                FROM ARG_AUDIT_RUN r LEFT JOIN ARG_AUDIT_REPORT p ON p.run_id=r.id AND (p.expires_at IS NULL OR p.expires_at>?)
                WHERE r.ci_navigation_origins IS NULL AND r.owner_user_id=? AND r.audit_id=?
                """+boundary+" ORDER BY r.created_at DESC,r.id DESC LIMIT ?")) {
                int n=1;s.setTimestamp(n++,Timestamp.from(clock.instant()));s.setLong(n++,owner);s.setLong(n++,audit);
                if(before>0){s.setTimestamp(n++,anchor);s.setTimestamp(n++,anchor);s.setLong(n++,before);}
                s.setInt(n,size+1);
                try(var r=s.executeQuery()) {while(r.next()) rows.add(new Row(r.getString("id"),r.getString("status"),date(r,"created_at"),date(r,"finished_at"),date(r,"published"),date(r,"expires_at"),parse(r.getString("report_json"))));}
            } catch(SQLException e) {throw failure(e);}
            var items=new ArrayList<Item>();
            for(int i=0;i<Math.min(size,rows.size());i++) {
                var row=rows.get(i);var report=row.report();var scores=report==null ? null : report.scores();
                var coverage=scores==null ? null : scores.coverage();
                // Adjacent attempts only: a failed/expired/unavailable measurement creates an explicit gap.
                var previous=i+1<rows.size() ? rows.get(i+1).report() : null;
                items.add(new Item(row.id(),row.status(),row.created(),row.finished(),row.published()!=null,row.published(),row.expires(),
                    scores==null || Boolean.FALSE.equals(scores.globalAvailable()) ? null : scores.global(),
                    scores==null || scores.calculation()==null ? null : scores.calculation().scoringVersion(),
                    coverage==null || coverage.global()==null || !coverage.global().available() ? null : coverage.global().ratio(),
                    coverage==null ? null : coverage.provisional(),AuditComparisonService.compare(previous,report)));
            }
            return new History(context,List.copyOf(items),rows.size()>size ? rows.get(size-1).id() : null);
        });
    }

    /** A public capability locates one report, but only its authenticated owner gets navigation. */
    public Context reportContext(String auth, String token) {
        if(token==null || !token.matches("[A-Za-z0-9_-]{20,512}")) throw AccountError.missing();
        return sessions.with(auth,null,true,true,(ctx,c)-> {
            try(var s=c.prepareStatement("""
                SELECT s.id,u.id,a.normalized_url FROM ARG_AUDIT_REPORT p
                JOIN ARG_AUDIT_RUN r ON r.id=p.run_id JOIN ARG_AUDIT a ON a.id=r.audit_id
                JOIN ARG_ACCOUNT_SITE s ON s.owner_user_id=r.owner_user_id
                JOIN ARG_ACCOUNT_SITE_URL u ON u.site_id=s.id AND u.audit_id=r.audit_id
                WHERE r.ci_navigation_origins IS NULL AND r.owner_user_id=? AND p.token_hash=? AND (p.expires_at IS NULL OR p.expires_at>?)
                """)) {
                s.setLong(1,ctx.user().getId());s.setBytes(2,new com.dokor.argos.services.token.TokenService().sha256(token));s.setTimestamp(3,Timestamp.from(clock.instant()));
                try(var r=s.executeQuery()) {if(!r.next()) throw AccountError.missing();return new Context(r.getString(1),r.getString(2),r.getString(3));}
            } catch(SQLException e){throw failure(e);}
        });
    }
    private ReportDto parse(String json) {try{return json==null ? null : mapper.readValue(json,ReportDto.class);}catch(Exception malformed){return null;}}
    private static String date(ResultSet r,String key)throws SQLException {var t=r.getTimestamp(key);return t==null ? null : t.toInstant().toString();}
    private static IllegalStateException failure(SQLException e){return new IllegalStateException("Personal history query failed",e);}
}
