package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.*;
import jakarta.inject.*;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@Singleton
public class PremiumWaitlistDao extends CrudDaoQuerydsl<PremiumWaitlistEntry> {
    @Inject public PremiumWaitlistDao(TransactionManagerQuerydsl transactions) {
        super(transactions, QPremiumWaitlistEntry.premiumWaitlistEntry);
    }
    private static Calendar utc() { return Calendar.getInstance(TimeZone.getTimeZone("UTC")); }
    /** Same atomic SQL path for new/duplicate emails; duplicates never extend consent. */
    public void subscribeIfAbsent(PremiumWaitlistEntry entry) {
        transactionManager.executeAndReturn(c -> {
            try (var q = c.prepareStatement("INSERT INTO ARG_PREMIUM_WAITLIST (id,email,locale,consent_version,created_at,expires_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id")) {
                q.setLong(1, generateIdentifier()); q.setString(2, entry.getEmail());
                q.setString(3, entry.getLocale()); q.setString(4, entry.getConsentVersion());
                q.setTimestamp(5, Timestamp.from(entry.getCreatedAt()), utc());
                q.setTimestamp(6, Timestamp.from(entry.getExpiresAt()), utc());
                q.executeUpdate(); return null;
            } catch (SQLException e) {
                // Driver exceptions can contain bound addresses. Do not propagate them to logs.
                throw new IllegalStateException("Premium waitlist storage unavailable");
            }
        });
    }
    public long purgeExpired(Instant now) {
        return transactionManager.executeAndReturn(c -> {
            try (var q = c.prepareStatement("DELETE FROM ARG_PREMIUM_WAITLIST WHERE expires_at<=? LIMIT 500")) {
                q.setTimestamp(1, Timestamp.from(now), utc()); return (long) q.executeUpdate();
            } catch (SQLException e) { throw new IllegalStateException("Premium waitlist retention unavailable"); }
        });
    }
}
