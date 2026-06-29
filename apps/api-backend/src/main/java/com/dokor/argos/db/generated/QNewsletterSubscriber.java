package com.dokor.argos.db.generated;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;
import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;
import com.querydsl.sql.ColumnMetadata;
import java.sql.Types;

/**
 * QNewsletterSubscriber is a Querydsl query type for NewsletterSubscriber
 */
@Generated("com.querydsl.sql.codegen.MetaDataSerializer")
public class QNewsletterSubscriber extends com.querydsl.sql.RelationalPathBase<NewsletterSubscriber> {

    private static final long serialVersionUID = -1234567890L;

    public static final QNewsletterSubscriber newsletterSubscriber = new QNewsletterSubscriber("ARG_NEWSLETTER_SUBSCRIBER");

    public final DateTimePath<java.time.Instant> createdAt = createDateTime("createdAt", java.time.Instant.class);

    public final StringPath email = createString("email");

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath ipHint = createString("ipHint");

    public final com.querydsl.sql.PrimaryKey<NewsletterSubscriber> primary = createPrimaryKey(id);

    public QNewsletterSubscriber(String variable) {
        super(NewsletterSubscriber.class, forVariable(variable), "null", "ARG_NEWSLETTER_SUBSCRIBER");
        addMetadata();
    }

    public QNewsletterSubscriber(String variable, String schema, String table) {
        super(NewsletterSubscriber.class, forVariable(variable), schema, table);
        addMetadata();
    }

    public QNewsletterSubscriber(String variable, String schema) {
        super(NewsletterSubscriber.class, forVariable(variable), schema, "ARG_NEWSLETTER_SUBSCRIBER");
        addMetadata();
    }

    public QNewsletterSubscriber(Path<? extends NewsletterSubscriber> path) {
        super(path.getType(), path.getMetadata(), "null", "ARG_NEWSLETTER_SUBSCRIBER");
        addMetadata();
    }

    public QNewsletterSubscriber(PathMetadata metadata) {
        super(NewsletterSubscriber.class, metadata, "null", "ARG_NEWSLETTER_SUBSCRIBER");
        addMetadata();
    }

    public void addMetadata() {
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(3).ofType(Types.TIMESTAMP).withSize(23).notNull());
        addMetadata(email, ColumnMetadata.named("email").withIndex(2).ofType(Types.VARCHAR).withSize(255).notNull());
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).withSize(19).notNull());
        addMetadata(ipHint, ColumnMetadata.named("ip_hint").withIndex(4).ofType(Types.VARCHAR).withSize(64));
    }
}
