package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
/** QueryDSL mapping maintained with V47. */
public class QBillingEvent extends RelationalPathBase<BillingEvent> {
    public static final QBillingEvent table=new QBillingEvent("ARG_BILLING_EVENT");
    public final NumberPath<Long> id=createNumber("id",Long.class);
    public final StringPath eventId=createString("eventId");
    public final StringPath stripeAccount=createString("stripeAccount");
    public final BooleanPath liveMode=createBoolean("liveMode");
    public final SimplePath<byte[]> bodyHash=createSimple("bodyHash",byte[].class);
    public final StringPath eventType=createString("eventType");
    public final DateTimePath<Instant> receivedAt=createDateTime("receivedAt",Instant.class);
    public final NumberPath<Long> ownerId=createNumber("ownerId",Long.class);
    public final PrimaryKey<BillingEvent> primary=createPrimaryKey(id);
    public QBillingEvent(String variable){super(BillingEvent.class,forVariable(variable),null,"ARG_BILLING_EVENT");
        addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(eventId,ColumnMetadata.named("event_id").ofType(Types.VARCHAR));
        addMetadata(stripeAccount,ColumnMetadata.named("stripe_account").ofType(Types.VARCHAR));
        addMetadata(liveMode,ColumnMetadata.named("live_mode").ofType(Types.BOOLEAN));
        addMetadata(bodyHash,ColumnMetadata.named("body_hash").ofType(Types.BINARY));
        addMetadata(eventType,ColumnMetadata.named("event_type").ofType(Types.VARCHAR));
        addMetadata(receivedAt,ColumnMetadata.named("received_at").ofType(Types.TIMESTAMP));
        addMetadata(ownerId,ColumnMetadata.named("owner_id").ofType(Types.BIGINT));
    }
}
