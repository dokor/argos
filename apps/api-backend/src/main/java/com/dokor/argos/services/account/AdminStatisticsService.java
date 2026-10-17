package com.dokor.argos.services.account;

import com.dokor.argos.db.dao.AdminStatisticsDao;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.time.*;
import java.util.Set;

@Singleton
public class AdminStatisticsService {
    public record Statistics(Instant generatedAt, Instant from, String period,
                             AdminStatisticsDao.Accounts accounts, AdminStatisticsDao.Analyses analyses,
                             AdminStatisticsDao.Domains domains) {}
    private final AccountSessionService sessions;
    private final AdminStatisticsDao dao;
    private final Clock clock;

    @Inject
    public AdminStatisticsService(AccountSessionService sessions, AdminStatisticsDao dao, Clock clock) {
        this.sessions=sessions; this.dao=dao; this.clock=clock;
    }

    public Statistics read(String auth, String period) {
        return sessions.with(auth,null,true,false,(ctx,c)-> {
            AdminService.requireAdmin(ctx);
            if (!Set.of("7","30","90","all").contains(period)) throw new AccountError(400,"filter_invalid");
            Instant now=clock.instant();
            Instant from="all".equals(period) ? null : now.minus(Duration.ofDays(Integer.parseInt(period)));
            var data=dao.read(c,from,now);
            return new Statistics(now,from,period,data.accounts(),data.analyses(),data.domains());
        });
    }
}
