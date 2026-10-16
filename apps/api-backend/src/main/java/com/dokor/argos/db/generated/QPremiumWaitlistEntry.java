package com.dokor.argos.db.generated;

import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;

/** Mapping maintained with V34__premium_waitlist.sql. */
public class QPremiumWaitlistEntry extends RelationalPathBase<PremiumWaitlistEntry> {
    public static final QPremiumWaitlistEntry premiumWaitlistEntry = new QPremiumWaitlistEntry("ARG_PREMIUM_WAITLIST");
    public final NumberPath<Long> id = createNumber("id", Long.class);
    public final StringPath email = createString("email");
    public final StringPath locale = createString("locale");
    public final StringPath consentVersion = createString("consentVersion");
    public final DateTimePath<Instant> createdAt = createDateTime("createdAt", Instant.class);
    public final DateTimePath<Instant> expiresAt = createDateTime("expiresAt", Instant.class);
    public final PrimaryKey<PremiumWaitlistEntry> primary = createPrimaryKey(id);
    public QPremiumWaitlistEntry(String variable) {
        super(PremiumWaitlistEntry.class, forVariable(variable), "null", "ARG_PREMIUM_WAITLIST");
        addMetadata(id, ColumnMetadata.named("id").withIndex(1).ofType(Types.BIGINT).notNull());
        addMetadata(email, ColumnMetadata.named("email").withIndex(2).ofType(Types.VARCHAR).withSize(255).notNull());
        addMetadata(locale, ColumnMetadata.named("locale").withIndex(3).ofType(Types.VARCHAR).withSize(2).notNull());
        addMetadata(consentVersion, ColumnMetadata.named("consent_version").withIndex(4).ofType(Types.VARCHAR).withSize(32).notNull());
        addMetadata(createdAt, ColumnMetadata.named("created_at").withIndex(5).ofType(Types.TIMESTAMP).notNull());
        addMetadata(expiresAt, ColumnMetadata.named("expires_at").withIndex(6).ofType(Types.TIMESTAMP).notNull());
    }
}
