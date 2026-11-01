package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.db.generated.*;
import com.dokor.argos.services.domain.audit.UrlNormalizer;
import com.dokor.argos.services.domain.domain.DomainService;
import jakarta.inject.*;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Personal relationships, never authority to access another owner's runs. */
@Singleton
public class AccountSitesService {
    public record Site(String siteId, String hostname, long urlCount, String latestActivityAt, String latestRunStatus) {}
    public record Attempt(String runId, String status, String createdAt, String finishedAt) {}
    public record AvailableReport(String runId, String publishedAt, String expiresAt, Integer globalScore, Boolean provisional) {}
    public record SiteUrl(String siteUrlId, String auditId, String normalizedUrl, Attempt latestAttempt, AvailableReport latestAvailableReport) {}
    public record Page<T>(List<T> items, String nextCursor) {}
    public record Added(Site site, String siteUrlId, boolean created) {}
    private final AccountDao dao;
    private final AccountSessionService sessions;
    private final UrlNormalizer normalizer;
    private final DomainService domains;
    private final AuditDao audits;
    private final Clock clock;

    @Inject public AccountSitesService(AccountDao dao, AccountSessionService sessions, UrlNormalizer normalizer,
            DomainService domains, AuditDao audits, Clock clock) {
        this.dao=dao; this.sessions=sessions; this.normalizer=normalizer; this.domains=domains; this.audits=audits; this.clock=clock;
    }

    /** Caller holds the account and session locks, serializing additions for one owner. */
    public AccountSiteUrl follow(long owner, long auditId, Connection c) {
        // Current shared read: global references may have just been committed by their DAO
        // after this transaction established a snapshot. Do not upgrade the FK shared lock.
        var domainId=query(c,"SELECT domain_id FROM ARG_AUDIT WHERE id=? LOCK IN SHARE MODE",r->r.getLong(1),auditId).stream().findFirst().orElseThrow(AccountError::missing);
        var s=QAccountSite.table;
        var site=dao.transactions.selectQuery(c).select(s).from(s).where(s.ownerUserId.eq(owner),s.domainId.eq(domainId)).fetchOne();
        if(site==null) {
            site=new AccountSite(); site.setOwnerUserId(owner); site.setDomainId(domainId); site.setCreatedAt(clock.instant());
            dao.save(site,s,c);
        }
        var u=QAccountSiteUrl.table;
        var url=dao.transactions.selectQuery(c).select(u).from(u).where(u.siteId.eq(site.getId()),u.auditId.eq(auditId)).fetchOne();
        if(url==null) {
            url=new AccountSiteUrl(); url.setSiteId(site.getId()); url.setAuditId(auditId); url.setCreatedAt(clock.instant());
            dao.save(url,u,c);
        }
        return url;
    }

    public Added add(String auth, String csrf, Long siteId, String input) {
        return sessions.with(auth,csrf,true,true,(ctx,c)-> {
            Site existing=siteId==null ? null : site(c,ctx.user().getId(),siteId);
            final String normalized;
            try { normalized=normalizer.normalize(input); }
            catch(IllegalArgumentException e) { throw new AccountError(400,"url_invalid"); }
            String hostname=normalizer.extractHostname(normalized);
            if(existing!=null && !existing.hostname().equals(hostname)) throw new AccountError(400,"hostname_mismatch");
            var domain=domains.findOrCreate(hostname);
            var candidate=new Audit(); candidate.setDomainId(domain.getId()); candidate.setInputUrl(normalized);
            candidate.setNormalizedUrl(normalized); candidate.setCreatedAt(clock.instant());
            var audit=audits.findOrCreate(candidate);
            boolean exists=!query(c,"SELECT u.id FROM ARG_ACCOUNT_SITE_URL u JOIN ARG_ACCOUNT_SITE s ON s.id=u.site_id WHERE s.owner_user_id=? AND u.audit_id=?", r->r.getLong(1),ctx.user().getId(),audit.getId()).isEmpty();
            var url=follow(ctx.user().getId(),audit.getId(),c);
            return new Added(site(c,ctx.user().getId(),url.getSiteId()),url.getId().toString(),!exists);
        });
    }

    private static final String SITE_SELECT="""
        SELECT s.id,d.hostname,
          (SELECT COUNT(*) FROM ARG_ACCOUNT_SITE_URL u WHERE u.site_id=s.id) url_count,
          r.created_at activity,r.status
        FROM ARG_ACCOUNT_SITE s JOIN ARG_DOMAIN d ON d.id=s.domain_id
        LEFT JOIN ARG_AUDIT_RUN r ON r.id=(
          SELECT x.id FROM ARG_AUDIT_RUN x JOIN ARG_ACCOUNT_SITE_URL u ON u.audit_id=x.audit_id
          WHERE x.ci_navigation_origins IS NULL AND u.site_id=s.id AND x.owner_user_id=s.owner_user_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
        """;
    private Site readSite(ResultSet r) throws SQLException {
        return new Site(r.getString("id"),r.getString("hostname"),r.getLong("url_count"),date(r,"activity"),r.getString("status"));
    }
    private Site site(Connection c,long owner,long id) {
        return query(c,SITE_SELECT+" WHERE s.owner_user_id=? AND s.id=?",this::readSite,owner,id).stream().findFirst().orElseThrow(AccountError::missing);
    }
    public Site get(String auth,long id) {
        return sessions.with(auth,null,true,true,(ctx,c)->site(c,ctx.user().getId(),id));
    }
    public Page<Site> list(String auth,int limit,String cursor) { return list(auth,limit,cursor,null); }
    public Page<Site> list(String auth,int limit,String cursor,String search) {
        String term=search(search);
        int size=limit(limit); long after=cursor(cursor);
        return sessions.with(auth,null,true,true,(ctx,c)->{
            if(after>0) site(c,ctx.user().getId(),after);
            var rows=query(c,SITE_SELECT+" WHERE s.owner_user_id=? AND s.id>? AND LOCATE(LOWER(?),LOWER(d.hostname))>0 ORDER BY s.id LIMIT ?",this::readSite,ctx.user().getId(),after,term,size+1);
            return page(rows,size, rows.size()>size ? rows.get(size-1).siteId() : null);
        });
    }
    public Page<SiteUrl> urls(String auth,long id,int limit,String cursor) { return urls(auth,id,limit,cursor,null); }
    public Page<SiteUrl> urls(String auth,long id,int limit,String cursor,String search) {
        String term=search(search);
        int size=limit(limit); long after=cursor(cursor);
        return sessions.with(auth,null,true,true,(ctx,c)-> {
            site(c,ctx.user().getId(),id);
            if(after>0 && query(c,"SELECT id FROM ARG_ACCOUNT_SITE_URL WHERE site_id=? AND id=?",r->r.getLong(1),id,after).isEmpty())
                throw new AccountError(400,"cursor_invalid");
            var rows=query(c,"""
                SELECT u.id,u.audit_id,a.normalized_url,r.id attempt_id,r.status,r.created_at attempt_at,r.finished_at,
                  p.run_id report_run,p.created_at published_at,p.expires_at,p.global_score,
                  p.provisional
                FROM ARG_ACCOUNT_SITE_URL u JOIN ARG_ACCOUNT_SITE s ON s.id=u.site_id JOIN ARG_AUDIT a ON a.id=u.audit_id
                LEFT JOIN ARG_AUDIT_RUN r ON r.id=(
                  SELECT x.id FROM ARG_AUDIT_RUN x WHERE x.ci_navigation_origins IS NULL AND x.audit_id=u.audit_id AND x.owner_user_id=s.owner_user_id
                  ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
                LEFT JOIN ARG_AUDIT_REPORT p ON p.id=(
                  SELECT b.id FROM ARG_AUDIT_REPORT b JOIN ARG_AUDIT_RUN x ON x.id=b.run_id
                  WHERE x.ci_navigation_origins IS NULL AND x.audit_id=u.audit_id AND x.owner_user_id=s.owner_user_id AND (b.expires_at IS NULL OR b.expires_at>?)
                  ORDER BY b.created_at DESC,b.id DESC LIMIT 1)
                WHERE s.owner_user_id=? AND u.site_id=? AND u.id>? AND LOCATE(LOWER(?),LOWER(a.normalized_url))>0 ORDER BY u.id LIMIT ?
                """,r->new SiteUrl(r.getString("id"),r.getString("audit_id"),r.getString("normalized_url"),
                    r.getObject("attempt_id")==null ? null : new Attempt(r.getString("attempt_id"),r.getString("status"),date(r,"attempt_at"),date(r,"finished_at")),
                    r.getObject("report_run")==null ? null : new AvailableReport(r.getString("report_run"),date(r,"published_at"),date(r,"expires_at"),
                        r.getObject("global_score")==null ? null : r.getInt("global_score"),
                        r.getString("provisional")==null ? null : Set.of("1","true").contains(r.getString("provisional")))),
                    Timestamp.from(clock.instant()),ctx.user().getId(),id,after,term,size+1);
            return page(rows,size,rows.size()>size ? rows.get(size-1).siteUrlId() : null);
        });
    }
    public String siteForRun(long owner,long auditId,Connection c) {
        return query(c,"SELECT s.id FROM ARG_ACCOUNT_SITE s JOIN ARG_ACCOUNT_SITE_URL u ON u.site_id=s.id WHERE s.owner_user_id=? AND u.audit_id=?",r->r.getString(1),owner,auditId).stream().findFirst().orElse(null);
    }
    public AccountHistoryService.Context contextForRun(long owner,long auditId,Connection c) {
        return query(c,"SELECT s.id,u.id,a.normalized_url FROM ARG_ACCOUNT_SITE s JOIN ARG_ACCOUNT_SITE_URL u ON u.site_id=s.id JOIN ARG_AUDIT a ON a.id=u.audit_id WHERE s.owner_user_id=? AND u.audit_id=?",r->new AccountHistoryService.Context(r.getString(1),r.getString(2),r.getString(3)),owner,auditId).stream().findFirst().orElse(null);
    }
    private static String search(String value) {
        if(value!=null && (value.length()>200 || value.chars().anyMatch(Character::isISOControl))) throw new AccountError(400,"filter_invalid");
        return value==null ? "" : value.trim();
    }
    static int limit(int n) { if(n<1 || n>100) throw new AccountError(400,"limit_invalid"); return n; }
    static long cursor(String raw) {
        if(raw==null) return 0;
        try { if(!raw.matches("[1-9][0-9]{0,18}")) throw new IllegalArgumentException(); return Long.parseLong(raw); }
        catch(IllegalArgumentException e) { throw new AccountError(400,"cursor_invalid"); }
    }
    private static <T> Page<T> page(List<T> rows,int size,String next) { return new Page<>(List.copyOf(rows.subList(0,Math.min(size,rows.size()))),next); }
    private static String date(ResultSet r,String column) throws SQLException { var value=r.getTimestamp(column); return value==null ? null : value.toInstant().toString(); }
    private interface Reader<T> { T read(ResultSet r) throws SQLException; }
    private static <T> List<T> query(Connection c,String sql,Reader<T> reader,Object... params) {
        try(var s=c.prepareStatement(sql)) {
            for(int i=0;i<params.length;i++) s.setObject(i+1,params[i]);
            try(var r=s.executeQuery()) { var rows=new ArrayList<T>(); while(r.next()) rows.add(reader.read(r)); return rows; }
        } catch(SQLException e) { throw new IllegalStateException("Personal site query failed",e); }
    }
}
