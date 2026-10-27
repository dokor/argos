package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
public class QCiRequest extends RelationalPathBase<CiRequest> {
    public static final QCiRequest table=new QCiRequest("ARG_CI_REQUEST");
    public final NumberPath<Long> id=createNumber("id",Long.class),ownerUserId=createNumber("ownerUserId",Long.class),integrationId=createNumber("integrationId",Long.class);
    public final StringPath publicId=createString("publicId"),navigationOrigins=createString("navigationOrigins"),profileId=createString("profileId");
    public final StringPath verdictPolicyJson=createString("verdictPolicyJson");
    public final SimplePath<byte[]> idempotencyHash=createSimple("idempotencyHash",byte[].class),requestFingerprint=createSimple("requestFingerprint",byte[].class);
    public final NumberPath<Integer> samples=createNumber("samples",Integer.class);
    public final DateTimePath<Instant> createdAt=createDateTime("createdAt",Instant.class);
    public final PrimaryKey<CiRequest> primary=createPrimaryKey(id);
    public QCiRequest(String variable){
        super(CiRequest.class,forVariable(variable),null,"ARG_CI_REQUEST");
        addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
        addMetadata(publicId,ColumnMetadata.named("public_id").ofType(Types.CHAR).withSize(36));
        addMetadata(ownerUserId,ColumnMetadata.named("owner_user_id").ofType(Types.BIGINT));
        addMetadata(integrationId,ColumnMetadata.named("integration_id").ofType(Types.BIGINT));
        addMetadata(idempotencyHash,ColumnMetadata.named("idempotency_hash").ofType(Types.BINARY).withSize(32));
        addMetadata(requestFingerprint,ColumnMetadata.named("request_fingerprint").ofType(Types.BINARY).withSize(32));
        addMetadata(navigationOrigins,ColumnMetadata.named("navigation_origins").ofType(Types.LONGVARCHAR));
        addMetadata(profileId,ColumnMetadata.named("profile_id").ofType(Types.VARCHAR).withSize(32));
        addMetadata(verdictPolicyJson,ColumnMetadata.named("verdict_policy_json").ofType(Types.LONGVARCHAR));
        addMetadata(samples,ColumnMetadata.named("samples").ofType(Types.INTEGER));
        addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
    }
}
