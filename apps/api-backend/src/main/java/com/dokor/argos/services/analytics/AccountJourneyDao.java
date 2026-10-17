package com.dokor.argos.services.analytics;

import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

@Singleton
public class AccountJourneyDao {
    private final TransactionManagerQuerydsl transactions;

    @Inject
    public AccountJourneyDao(TransactionManagerQuerydsl transactions) { this.transactions = transactions; }

    static Calendar utc() { return Calendar.getInstance(TimeZone.getTimeZone("UTC")); }

    /** Called after business commit. The shared lock also serializes collection with disabling. */
    public void record(AccountJourneyEvent event, long subject, long user, String method, String lang, Instant now) {
        transactions.executeAndReturn(connection -> {
            try {
                Instant since = ProductAnalyticsDao.collectionWindow(connection);
                if (since == null || now.isBefore(since)) return null;
                insert(connection, event, subject, user, method, lang, now);
                return null;
            } catch (SQLException unavailable) { throw new IllegalStateException("Account measurement unavailable"); }
        });
    }

    static void insert(Connection connection, AccountJourneyEvent event, long subject, long user,
                       String method, String lang, Instant now) throws SQLException {
        String key = event == AccountJourneyEvent.ACTIVITY
                ? now.atZone(ZoneOffset.UTC).toLocalDate().toString() : "once";
        try (var query = connection.prepareStatement("""
                INSERT IGNORE INTO ARG_PRODUCT_ACCOUNT_EVENT
                (event_name,subject_id,event_key,user_id,occurred_at,locale,method) VALUES(?,?,?,?,?,?,?)
                """)) {
            query.setString(1, event.eventName()); query.setLong(2, subject); query.setString(3, key);
            query.setLong(4, user); query.setTimestamp(5, Timestamp.from(now), utc());
            query.setString(6, lang); query.setString(7, method);
            ProductAnalyticsDao.collected(connection, now, query.executeUpdate());
        }
    }

    public record Retention(long eligible, long returned) {}
    public record Cohort(String method, String lang, long registered, long activated, long claimed,
                         Retention day7, Retention day30) {}
    public record Summary(long activeAccounts, long returningAccounts, long activityDays,
                          long authentications, long claimedReports, List<Cohort> cohorts) {}

    public Summary summary(Instant from, Instant until) {
        return transactions.executeAndReturn(connection -> {
            var cohorts = new ArrayList<Cohort>();
            // Cohort membership is an observed registration, never reconstructed from account history.
            try (var query = connection.prepareStatement("""
                    SELECT r.method,r.locale,COUNT(*),
                      SUM(EXISTS(SELECT 1 FROM ARG_PRODUCT_ACCOUNT_EVENT e WHERE e.user_id=r.user_id
                        AND e.event_name='account_activated' AND e.occurred_at>=r.occurred_at AND e.occurred_at<?)),
                      SUM(EXISTS(SELECT 1 FROM ARG_PRODUCT_ACCOUNT_EVENT e WHERE e.user_id=r.user_id
                        AND e.event_name='report_claimed' AND e.occurred_at>=r.occurred_at AND e.occurred_at<?)),
                      SUM(DATE(r.occurred_at)+INTERVAL 8 DAY<=?),
                      SUM(DATE(r.occurred_at)+INTERVAL 8 DAY<=? AND EXISTS(
                        SELECT 1 FROM ARG_PRODUCT_ACCOUNT_EVENT e WHERE e.user_id=r.user_id
                        AND e.event_name='account_activity' AND e.event_key=DATE(r.occurred_at)+INTERVAL 7 DAY)),
                      SUM(DATE(r.occurred_at)+INTERVAL 31 DAY<=?),
                      SUM(DATE(r.occurred_at)+INTERVAL 31 DAY<=? AND EXISTS(
                        SELECT 1 FROM ARG_PRODUCT_ACCOUNT_EVENT e WHERE e.user_id=r.user_id
                        AND e.event_name='account_activity' AND e.event_key=DATE(r.occurred_at)+INTERVAL 30 DAY))
                    FROM ARG_PRODUCT_ACCOUNT_EVENT r
                    WHERE r.event_name='account_registered' AND r.occurred_at>=? AND r.occurred_at<?
                    GROUP BY r.method,r.locale ORDER BY r.method,r.locale
                    """)) {
                for (int index = 1; index <= 6; index++) query.setTimestamp(index, Timestamp.from(until), utc());
                query.setTimestamp(7, Timestamp.from(from), utc()); query.setTimestamp(8, Timestamp.from(until), utc());
                try (var rows = query.executeQuery()) {
                    while (rows.next()) cohorts.add(new Cohort(rows.getString(1), rows.getString(2), rows.getLong(3),
                            rows.getLong(4), rows.getLong(5), new Retention(rows.getLong(6), rows.getLong(7)),
                            new Retention(rows.getLong(8), rows.getLong(9))));
                }
            } catch (SQLException unavailable) { throw new IllegalStateException("Account cohorts unavailable"); }
            try (var query = connection.prepareStatement("""
                    SELECT COUNT(DISTINCT CASE WHEN e.event_name='account_activity' THEN e.user_id END),
                      COUNT(DISTINCT CASE WHEN e.event_name='account_activity' AND EXISTS(
                        SELECT 1 FROM ARG_PRODUCT_ACCOUNT_EVENT p WHERE p.user_id=e.user_id
                        AND p.event_name='account_activity' AND p.event_key<e.event_key) THEN e.user_id END),
                      COALESCE(SUM(e.event_name='account_activity'),0),
                      COALESCE(SUM(e.event_name='account_authenticated'),0),
                      COALESCE(SUM(e.event_name='report_claimed'),0)
                    FROM ARG_PRODUCT_ACCOUNT_EVENT e WHERE e.occurred_at>=? AND e.occurred_at<?
                    """)) {
                query.setTimestamp(1, Timestamp.from(from), utc()); query.setTimestamp(2, Timestamp.from(until), utc());
                try (var rows = query.executeQuery()) {
                    rows.next();
                    return new Summary(rows.getLong(1), rows.getLong(2), rows.getLong(3), rows.getLong(4),
                            rows.getLong(5), List.copyOf(cohorts));
                }
            } catch (SQLException unavailable) { throw new IllegalStateException("Account activity unavailable"); }
        });
    }
}
