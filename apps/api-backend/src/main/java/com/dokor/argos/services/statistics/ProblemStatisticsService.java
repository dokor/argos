package com.dokor.argos.services.statistics;

import com.dokor.argos.db.dao.ProblemStatisticsDao;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.analysis.scoring.ScorePolicy;
import com.dokor.argos.services.domain.report.ReportRetentionPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.*;
import java.util.Set;
import org.slf4j.LoggerFactory;

@Singleton
public class ProblemStatisticsService {
    private final ProblemStatisticsDao dao;
    private final AccountSessionService sessions;
    private final ScorePolicy policy;
    private final ReportRetentionPolicy retention;
    private final ObjectMapper mapper;
    private final Clock clock;

    @Inject public ProblemStatisticsService(ProblemStatisticsDao dao, AccountSessionService sessions,
        ScorePolicy policy, ReportRetentionPolicy retention, ObjectMapper mapper, Clock clock) {
        this.dao=dao; this.sessions=sessions; this.policy=policy; this.retention=retention; this.mapper=mapper; this.clock=clock;
    }

    public ProblemStatistics read(String authorization, int days, String category) {
        return sessions.with(authorization, null, true, false, (context, connection) -> {
            AdminService.requireAdmin(context);
            if (!Set.of(30,90).contains(days) || category != null && !Set.of("performance","security","seo","a11y").contains(category))
                throw new AccountError(400,"filter_invalid");
            Instant now=clock.instant(), until=LocalDate.ofInstant(now,ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
            return dao.read(connection,until.minus(Duration.ofDays(days)),until,now,retention,policy,category);
        });
    }

    public void backfill() {
        Instant now=clock.instant();
        Instant from=LocalDate.ofInstant(now,ZoneOffset.UTC).minusDays(90).atStartOfDay(ZoneOffset.UTC).toInstant();
        try { dao.backfill(from,now,retention,mapper,policy); }
        catch (RuntimeException unavailable) {
            LoggerFactory.getLogger(ProblemStatisticsService.class).warn("Problem statistics backfill deferred: {}", unavailable.getClass().getSimpleName());
        }
    }
}
