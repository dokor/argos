package com.dokor.argos.services.connected.summary;

import com.dokor.argos.db.dao.*;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

import jakarta.inject.*;

import java.sql.Connection;
import java.time.Clock;

@Singleton
public final class AccountOverviewService {
    private final AccountDao accounts;
    private final AccountSessionService sessions;
    private final AccountOverviewDao dao;
    private final UsageService usage;
    private final Clock clock;

    @Inject
    public AccountOverviewService(
            AccountDao accounts,
            AccountSessionService sessions,
            AccountOverviewDao dao,
            UsageService usage,
            Clock clock) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.dao = dao;
        this.usage = usage;
        this.clock = clock;
    }

    public Overview overview(String auth, AccountOverviewDao.Filter filter) {
        return accounts.transaction(
                c -> {
                    try {
                        c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
                    } catch (java.sql.SQLException e) {
                        throw new IllegalStateException(e);
                    }
                    var ctx = sessions.require(auth, null, true, false, c);
                    long owner = ctx.user().getId();
                    var credit = usage.snapshot(owner, ctx.user().getOffer(), c);
                    var now = clock.instant();
                    var totals = dao.totals(owner, now, c);
                    return new Overview(
                            now.toString(),
                            "LATEST_ATTEMPT_PER_URL",
                            totals.tracked(),
                            totals.priority(),
                            totals.incomplete(),
                            dao.active(owner, c),
                            new Usage(
                                    credit.offer(),
                                    credit.period(),
                                    credit.timezone(),
                                    credit.startsAt(),
                                    credit.resetsAt(),
                                    credit.used(),
                                    credit.reserved(),
                                    credit.limit(),
                                    credit.available(),
                                    credit.canLaunch()),
                            dao.runs(owner, false, c),
                            dao.pages(
                                            owner,
                                            now,
                                            new AccountOverviewDao.Filter(
                                                    "priority", "", null, 5, 0),
                                            c)
                                    .items(),
                            dao.runs(owner, true, c),
                            dao.pages(owner, now, filter, c));
                });
    }

    public TrackedPages pages(String auth, AccountOverviewDao.Filter filter) {
        return accounts.transaction(
                c -> {
                    try {
                        c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
                    } catch (java.sql.SQLException e) {
                        throw new IllegalStateException(e);
                    }
                    var ctx = sessions.require(auth, null, true, false, c);
                    return dao.pages(ctx.user().getId(), clock.instant(), filter, c);
                });
    }
}
