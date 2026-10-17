package com.dokor.argos.services.analytics;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.*;
import java.time.*;
import java.util.*;
@Singleton
public class ProductAnalyticsDao {
    private final TransactionManagerQuerydsl transactions;
    @Inject public ProductAnalyticsDao(TransactionManagerQuerydsl transactions) { this.transactions=transactions; }
    public boolean collectionEnabled() {
        return transactions.executeAndReturn(connection -> {
            try(var query=connection.prepareStatement("SELECT enabled FROM ARG_PRODUCT_SETTING WHERE id=1");var row=query.executeQuery()) { return row.next() && row.getBoolean(1); }
            catch(SQLException e){throw new IllegalStateException("Measurement state unavailable");}
        });
    }
    private static Calendar utc() { return Calendar.getInstance(TimeZone.getTimeZone("UTC")); }
    // The row lock serializes collection with disable across all backend instances.
    static Instant collectionWindow(Connection connection) throws SQLException {
        try (var query=connection.prepareStatement("SELECT enabled,enabled_since FROM ARG_PRODUCT_SETTING WHERE id=1 FOR UPDATE"); var row=query.executeQuery()) {
            return row.next() && row.getBoolean(1) ? instant(row,2) : null;
        }
    }
    static void collected(Connection connection,Instant now,int changed) throws SQLException {
        if(changed==0)return;
        try(var query=connection.prepareStatement("UPDATE ARG_PRODUCT_SETTING SET last_collected_at=? WHERE id=1")) {
            query.setTimestamp(1,Timestamp.from(now),utc());query.executeUpdate();
        }
    }
    public void countTraffic(TrafficEvent event,Instant now) {
        transactions.executeAndReturn(c->{
            try(var q=c.prepareStatement("INSERT INTO ARG_PRODUCT_EVENT_COUNT(event_day,event_name,source_route,locale,placement,error_category) VALUES(?,?,?,?,?,'none') ON DUPLICATE KEY UPDATE event_count=event_count+1")) {
                for(String name:event.visit()?List.of("traffic_page_view","traffic_visit"):List.of("traffic_page_view")) {
                    q.setDate(1,java.sql.Date.valueOf(now.atZone(ZoneOffset.UTC).toLocalDate()));q.setString(2,name);q.setString(3,event.route());q.setString(4,event.lang());q.setString(5,event.source());q.executeUpdate();
                }
                return null;
            }catch(SQLException e){throw new IllegalStateException("Traffic counter unavailable");}
        });
    }
    public record TrafficRow(String day,String event,String route,String lang,String source,long count) {}
    public List<TrafficRow> traffic(LocalDate from,LocalDate until) {
        return transactions.executeAndReturn(c->{var rows=new ArrayList<TrafficRow>();
            try(var q=c.prepareStatement("SELECT event_day,event_name,source_route,locale,placement,event_count FROM ARG_PRODUCT_EVENT_COUNT WHERE event_name IN ('traffic_page_view','traffic_visit') AND event_day>=? AND event_day<=? ORDER BY event_day,source_route,locale,placement")) {
                q.setDate(1,java.sql.Date.valueOf(from));q.setDate(2,java.sql.Date.valueOf(until));
                try(var r=q.executeQuery()){while(r.next())rows.add(new TrafficRow(r.getDate(1).toString(),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getLong(6)));}
                return List.copyOf(rows);
            }catch(SQLException e){throw new IllegalStateException("Traffic statistics unavailable");}
        });
    }
    public void count(ProductEvent event, Instant now) {
        transactions.executeAndReturn(connection -> {
            try { if(collectionWindow(connection)==null)return null; } catch(SQLException e){throw new IllegalStateException("Measurement state unavailable");}
            try(var query=connection.prepareStatement("INSERT INTO ARG_PRODUCT_EVENT_COUNT(event_day,event_name,source_route,locale,placement,error_category) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE event_count=event_count+1")) {
                query.setDate(1,java.sql.Date.valueOf(now.atZone(ZoneOffset.UTC).toLocalDate())); query.setString(2,event.event());
                dimensions(query,3,event.dimensions()); query.setString(6,event.errorCategory()); collected(connection,now,query.executeUpdate()); return null;
            } catch(SQLException error) { throw new IllegalStateException("Product counter storage failed"); }
        });
    }
    private static void dimensions(PreparedStatement query,int offset,AnalyticsDimensions d) throws SQLException {
        query.setString(offset,d.route());query.setString(offset+1,d.lang());query.setString(offset+2,d.placement());
    }
    public void attribute(long runId,AnalyticsDimensions d,Instant now) {
        transactions.executeAndReturn(connection -> {
            Instant since; try { since=collectionWindow(connection); if(since==null || now.isBefore(since))return null; } catch(SQLException e){throw new IllegalStateException("Measurement state unavailable");}
            try(var query=connection.prepareStatement("INSERT IGNORE INTO ARG_PRODUCT_AUDIT_ATTR(run_id,source_route,locale,placement,created_at,audience) SELECT ?,?,?,?,?,IF(owner_user_id IS NULL,'visitor','account') FROM ARG_AUDIT_RUN WHERE id=? AND created_at>=?")) {
                query.setLong(1,runId);dimensions(query,2,d);query.setTimestamp(5,Timestamp.from(now),utc());query.setLong(6,runId);query.setTimestamp(7,Timestamp.from(since),utc());
                int inserted = query.executeUpdate();
                collected(connection,now,inserted);
                if (inserted > 0) {
                    try (var owner = connection.prepareStatement("SELECT owner_user_id FROM ARG_AUDIT_RUN WHERE id=?")) {
                        owner.setLong(1,runId);
                        try (var row = owner.executeQuery()) {
                            if (row.next()) {
                                long user = row.getLong(1);
                                if (!row.wasNull()) AccountJourneyDao.insert(connection,AccountJourneyEvent.ACTIVATED,user,user,"none",d.lang(),now);
                            }
                        }
                    }
                }
                return null;
            }catch(SQLException error){throw new IllegalStateException("Product attribution storage failed");}
        });
    }
    public void viewed(long runId,Instant now) {
        transactions.executeAndReturn(connection -> {
            Instant since; try { since=collectionWindow(connection); if(since==null)return null; } catch(SQLException e){throw new IllegalStateException("Measurement state unavailable");}
            try(var query=connection.prepareStatement("UPDATE ARG_PRODUCT_AUDIT_ATTR SET first_viewed_at=? WHERE run_id=? AND first_viewed_at IS NULL AND created_at>=?")) {
                query.setTimestamp(1,Timestamp.from(now),utc());query.setLong(2,runId);query.setTimestamp(3,Timestamp.from(since),utc());collected(connection,now,query.executeUpdate());return null;
            }catch(SQLException error){throw new IllegalStateException("Product view storage failed");}
        });
    }
    /** Deletes only the telemetry tables, never runs/reports/audits or their results. */
    public long purgeTelemetry(Instant now) {
        return transactions.executeAndReturn(connection -> {
            try(var attrs=connection.prepareStatement("DELETE FROM ARG_PRODUCT_AUDIT_ATTR WHERE created_at < ?");var counters=connection.prepareStatement("DELETE FROM ARG_PRODUCT_EVENT_COUNT WHERE event_day < ?");var accounts=connection.prepareStatement("DELETE FROM ARG_PRODUCT_ACCOUNT_EVENT WHERE occurred_at < ?")) {
                attrs.setTimestamp(1,Timestamp.from(now.minus(Duration.ofDays(90))),utc());
                counters.setDate(1,java.sql.Date.valueOf(now.minus(Duration.ofDays(89)).atZone(ZoneOffset.UTC).toLocalDate()));
                accounts.setTimestamp(1,Timestamp.from(now.minus(Duration.ofDays(90))),utc());
                return (long)attrs.executeUpdate()+counters.executeUpdate()+accounts.executeUpdate();
            }catch(SQLException error){throw new IllegalStateException("Product retention storage failed");}
        });
    }
    public record CohortRow(String route,String lang,String placement,String status,Instant created,Instant started,Instant finished,boolean viewed,String audience) {
        public CohortRow(String route,String lang,String placement,String status,Instant created,Instant started,Instant finished,boolean viewed) {
            this(route,lang,placement,status,created,started,finished,viewed,"unknown");
        }
    }
    public record CounterRow(String firstDay,String event,String route,String lang,String placement,String error,long count) {}
    public record Sample(List<CohortRow> cohort,List<CounterRow> counters,boolean capped) {}
    public Sample sample(Instant from,Instant until) {
        return transactions.executeAndReturn(connection -> {
            var rows=new ArrayList<CohortRow>();var counters=new ArrayList<CounterRow>();
            try(var query=connection.prepareStatement("SELECT a.source_route,a.locale,a.placement,r.status,r.created_at,r.started_at,r.finished_at,a.first_viewed_at,a.audience FROM ARG_PRODUCT_AUDIT_ATTR a JOIN ARG_AUDIT_RUN r ON r.id=a.run_id WHERE r.created_at >= ? AND r.created_at < ? ORDER BY r.created_at LIMIT 100001")) {
                query.setTimestamp(1,Timestamp.from(from),utc());query.setTimestamp(2,Timestamp.from(until),utc());
                try(var result=query.executeQuery()){while(result.next()) rows.add(new CohortRow(result.getString(1),result.getString(2),result.getString(3),result.getString(4),instant(result,5),instant(result,6),instant(result,7),result.getTimestamp(8,utc())!=null,result.getString(9)));}
            }catch(SQLException error){throw new IllegalStateException("Product cohort read failed");}
            try(var query=connection.prepareStatement("SELECT MIN(event_day),event_name,source_route,locale,placement,error_category,SUM(event_count) FROM ARG_PRODUCT_EVENT_COUNT WHERE event_day >= ? AND event_day <= ? AND event_name NOT IN ('traffic_page_view','traffic_visit') GROUP BY event_name,source_route,locale,placement,error_category ORDER BY event_name,source_route,locale,placement,error_category")) {
                query.setDate(1,java.sql.Date.valueOf(from.atZone(ZoneOffset.UTC).toLocalDate()));query.setDate(2,java.sql.Date.valueOf(until.atZone(ZoneOffset.UTC).toLocalDate()));
                try(var result=query.executeQuery()){while(result.next()) counters.add(new CounterRow(result.getDate(1).toString(),result.getString(2),result.getString(3),result.getString(4),result.getString(5),result.getString(6),result.getLong(7)));}
            }catch(SQLException error){throw new IllegalStateException("Product counters read failed");}
            boolean capped=rows.size()>100000;if(capped)rows.removeLast();return new Sample(List.copyOf(rows),List.copyOf(counters),capped);
        });
    }
    private static Instant instant(ResultSet result,int index)throws SQLException {var value=result.getTimestamp(index,utc());return value==null?null:value.toInstant();}
}
