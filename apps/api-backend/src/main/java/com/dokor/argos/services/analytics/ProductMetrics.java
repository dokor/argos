package com.dokor.argos.services.analytics;
import java.time.*;
import java.util.*;
public final class ProductMetrics {
    private ProductMetrics() {}
    public record Delays(int sample,int excluded,Long medianMs,Long p90Ms,Long p95Ms) {}
    public record Counts(long accepted,long started,long completed,long failed,long pending,long viewed,long completedViewed) {}
    public record Breakdown(String route,String lang,String placement,Counts counts) {}
    public record Summary(String from,String until,int days,String timezone,boolean enabled,boolean capped,Counts cohort,List<Breakdown> bySource,Delays queue,Delays processing,Delays endToEnd,List<ProductAnalyticsDao.CounterRow> events,String limits) {}
    public static Summary summarize(ProductAnalyticsDao.Sample sample,Instant from,Instant until,int days,boolean enabled) {
        var rows=sample.cohort();var groups=new TreeMap<String,List<ProductAnalyticsDao.CohortRow>>();
        for(var row:rows)groups.computeIfAbsent(row.route()+"|"+row.lang()+"|"+row.placement(),key->new ArrayList<>()).add(row);
        var breakdown=groups.values().stream().map(group->{var first=group.getFirst();return new Breakdown(first.route(),first.lang(),first.placement(),counts(group));}).toList();
        return new Summary(from.toString(),until.toString(),days,"UTC",enabled,sample.capped(),counts(rows),breakdown,delays(rows,"queue"),delays(rows,"processing"),delays(rows,"total"),sample.counters(),"Consented created runs only. Each run counted once; pending cohorts are immature. Public events count displays/clicks, not unique people. No visit-to-report conversion or causal gain is inferred. Counters use UTC calendar days. Missing/negative timestamps excluded from delays. Up to 100000 oldest runs per requested period.");
    }
    private static Counts counts(List<ProductAnalyticsDao.CohortRow> rows) {
        return new Counts(rows.size(),rows.stream().filter(r->r.started()!=null).count(),rows.stream().filter(r->"COMPLETED".equals(r.status())).count(),rows.stream().filter(r->"FAILED".equals(r.status())).count(),rows.stream().filter(r->Set.of("QUEUED","RUNNING").contains(r.status())).count(),rows.stream().filter(ProductAnalyticsDao.CohortRow::viewed).count(),rows.stream().filter(r->r.viewed()&&"COMPLETED".equals(r.status())).count());
    }
    private static Delays delays(List<ProductAnalyticsDao.CohortRow> rows,String kind) {
        var values=new ArrayList<Long>();int eligible=0;
        for(var row:rows){if(!kind.equals("queue")&&!"COMPLETED".equals(row.status()))continue;eligible++;
            Instant start=kind.equals("processing")?row.started():row.created();Instant end=kind.equals("queue")?row.started():row.finished();
            if(start!=null&&end!=null&&!end.isBefore(start))values.add(Duration.between(start,end).toMillis());
        }
        values.sort(Long::compareTo);return new Delays(values.size(),eligible-values.size(),percentile(values,.5),percentile(values,.9),percentile(values,.95));
    }
    private static Long percentile(List<Long> values,double p){return values.isEmpty()?null:values.get((int)Math.ceil(p*values.size())-1);}
}
