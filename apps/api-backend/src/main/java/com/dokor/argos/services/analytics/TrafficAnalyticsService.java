package com.dokor.argos.services.analytics;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.security.AdminReadAccess;
import com.typesafe.config.Config;
import jakarta.inject.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
@Singleton
public class TrafficAnalyticsService {
    public record Period(String date,long views,long visits) {}
    public record Dimension(String value,long views) {}
    public record Metrics(boolean enabled,String from,String until,long views,long visits,List<Period> evolution,List<Dimension> pages,List<Dimension> sources,List<Dimension> languages) {}
    private final boolean enabled; private final ProductAnalyticsDao dao; private final AdminReadAccess access; private final Clock clock;
    @Inject public TrafficAnalyticsService(Config config,ProductAnalyticsDao dao,AdminReadAccess access,Clock clock){enabled=config.hasPath("traffic-analytics.enabled")&&config.getBoolean("traffic-analytics.enabled");this.dao=dao;this.access=access;this.clock=clock;}
    public boolean count(TrafficEvent event,String auth){access.require(auth);if(!enabled)return false;dao.countTraffic(event,clock.instant());return true;}
    public Metrics metrics(int days,String group,AccountSessionService.Context context){
        AdminService.requireAdmin(context);
        if(!Set.of(7,30,90).contains(days)||!Set.of("day","week","month").contains(group))throw new AccountError(400,"filter_invalid");
        var until=LocalDate.ofInstant(clock.instant(),ZoneOffset.UTC);var from=until.minusDays(days-1);
        return summarize(dao.traffic(from,until),from,until,group,enabled);
    }
    public static Metrics summarize(List<ProductAnalyticsDao.TrafficRow> rows,LocalDate from,LocalDate until,String group,boolean enabled){
        var periods=new TreeMap<String,long[]>();var pages=new HashMap<String,Long>();var sources=new HashMap<String,Long>();var languages=new HashMap<String,Long>();long views=0,visits=0;
        for(var day=from;!day.isAfter(until);day=day.plusDays(1))periods.putIfAbsent(bucket(day,group),new long[2]);
        for(var row:rows){var values=periods.get(bucket(LocalDate.parse(row.day()),group));if(values==null)continue;
            if(row.event().equals("traffic_visit")){visits+=row.count();values[1]+=row.count();}
            else if(row.event().equals("traffic_page_view")){views+=row.count();values[0]+=row.count();pages.merge(row.route(),row.count(),Long::sum);sources.merge(row.source(),row.count(),Long::sum);languages.merge(row.lang(),row.count(),Long::sum);}
        }
        return new Metrics(enabled,from.toString(),until.toString(),views,visits,periods.entrySet().stream().map(e->new Period(e.getKey(),e.getValue()[0],e.getValue()[1])).toList(),dimensions(pages),dimensions(sources),dimensions(languages));
    }
    private static String bucket(LocalDate d,String group){return (group.equals("month")?d.withDayOfMonth(1):group.equals("week")?d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)):d).toString();}
    private static List<Dimension> dimensions(Map<String,Long> values){return values.entrySet().stream().sorted(Map.Entry.<String,Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey())).map(e->new Dimension(e.getKey(),e.getValue())).toList();}
}
