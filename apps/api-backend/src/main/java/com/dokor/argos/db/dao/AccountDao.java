package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.*;

import jakarta.inject.*;

import java.sql.Connection;
import java.util.*;
import java.util.function.Function;

@Singleton
public class AccountDao {
    public final TransactionManagerQuerydsl transactions;

    @Inject
    public AccountDao(TransactionManagerQuerydsl transactions) {
        this.transactions = transactions;
    }

    public <T> T transaction(Function<Connection, T> work) {
        return transactions.executeAndReturn(work::apply);
    }

    public AccountUser user(long id, Connection c, boolean lock) {
        var q =
                transactions
                        .selectQuery(c)
                        .select(QAccountUser.table)
                        .from(QAccountUser.table)
                        .where(QAccountUser.table.id.eq(id));
        return (lock ? q.forUpdate() : q).fetchOne();
    }

    public AccountUser email(String email, Connection c) {
        return transactions
                .selectQuery(c)
                .select(QAccountUser.table)
                .from(QAccountUser.table)
                .where(QAccountUser.table.email.eq(email))
                .fetchOne();
    }

    public AccountSession session(long id, Connection c, boolean lock) {
        var q =
                transactions
                        .selectQuery(c)
                        .select(QAccountSession.table)
                        .from(QAccountSession.table)
                        .where(QAccountSession.table.id.eq(id));
        return (lock ? q.forUpdate() : q).fetchOne();
    }

    public AccountIdentity identity(String provider, String subject, Connection c) {
        return identity(provider, subject, c, false);
    }

    public AccountIdentity identity(String provider, String subject, Connection c, boolean lock) {
        var t = QAccountIdentity.table;
        var query =
                transactions
                        .selectQuery(c)
                        .select(t)
                        .from(t)
                        .where(t.provider.eq(provider), t.subject.eq(subject));
        return (lock ? query.forUpdate() : query).fetchOne();
    }

    public List<AccountIdentity> identities(long user, Connection c) {
        var t = QAccountIdentity.table;
        return transactions
                .selectQuery(c)
                .select(t)
                .from(t)
                .where(t.userId.eq(user), t.disabledAt.isNull())
                .fetch();
    }

    public List<AccountSession> sessions(long user, Connection c) {
        var t = QAccountSession.table;
        return transactions
                .selectQuery(c)
                .select(t)
                .from(t)
                .where(t.userId.eq(user), t.revokedAt.isNull())
                .orderBy(t.createdAt.desc())
                .limit(100)
                .fetch();
    }

    public <T extends com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl> T save(
            T entity, com.querydsl.sql.RelationalPathBase<T> table, Connection c) {
        return new CrudDaoQuerydsl<T>(transactions, table).save(entity, c);
    }

    public AccountUser save(AccountUser u, Connection c) {
        return save(u, QAccountUser.table, c);
    }

    public AccountIdentity save(AccountIdentity u, Connection c) {
        return save(u, QAccountIdentity.table, c);
    }

    public AccountSession save(AccountSession u, Connection c) {
        return save(u, QAccountSession.table, c);
    }

    public AccountToken save(AccountToken u, Connection c) {
        return save(u, QAccountToken.table, c);
    }

    public AccountOauth save(AccountOauth u, Connection c) {
        return save(u, QAccountOauth.table, c);
    }

    public AccountRunClaim save(AccountRunClaim u, Connection c) {
        return save(u, QAccountRunClaim.table, c);
    }

    public AccountSecurityEvent save(AccountSecurityEvent u, Connection c) {
        return save(u, QAccountSecurityEvent.table, c);
    }
}
