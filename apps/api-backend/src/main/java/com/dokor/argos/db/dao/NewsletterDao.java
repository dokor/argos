package com.dokor.argos.db.dao;

import com.coreoz.plume.db.querydsl.crud.CrudDaoQuerydsl;
import com.coreoz.plume.db.querydsl.transaction.TransactionManagerQuerydsl;
import com.dokor.argos.db.generated.NewsletterSubscriber;
import com.dokor.argos.db.generated.QNewsletterSubscriber;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import java.util.Optional;

/**
 * DAO pour la table ARG_NEWSLETTER_SUBSCRIBER.
 * <p>
 * Garantit l'unicité de l'email via l'index unique en base.
 */
@Singleton
public class NewsletterDao extends CrudDaoQuerydsl<NewsletterSubscriber> {

    private static final QNewsletterSubscriber SUBSCRIBER = QNewsletterSubscriber.newsletterSubscriber;

    @Inject
    public NewsletterDao(TransactionManagerQuerydsl transactionManager) {
        super(transactionManager, SUBSCRIBER);
    }

    public Optional<NewsletterSubscriber> findByEmail(String email) {
        return Optional.ofNullable(
            transactionManager.selectQuery()
                .select(SUBSCRIBER)
                .from(SUBSCRIBER)
                .where(SUBSCRIBER.email.equalsIgnoreCase(email))
                .fetchOne()
        );
    }

    public boolean existsByEmail(String email) {
        return transactionManager.selectQuery()
            .select(SUBSCRIBER.id)
            .from(SUBSCRIBER)
            .where(SUBSCRIBER.email.equalsIgnoreCase(email))
            .fetchFirst() != null;
    }

    /** One SQL path for new and existing subscriptions, without an existence oracle. */
    public void subscribeIfAbsent(NewsletterSubscriber subscriber) {
        transactionManager.executeAndReturn(connection -> {
            try (var statement = connection.prepareStatement("INSERT INTO ARG_NEWSLETTER_SUBSCRIBER (id,email,created_at,ip_hint) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id=id")) {
                statement.setLong(1, generateIdentifier());
                statement.setString(2, subscriber.getEmail());
                statement.setTimestamp(3, java.sql.Timestamp.from(subscriber.getCreatedAt()));
                statement.setString(4, subscriber.getIpHint());
                statement.executeUpdate();
                return null;
            } catch (java.sql.SQLException error) {
                throw new IllegalStateException("Newsletter storage unavailable", error);
            }
        });
    }
}
