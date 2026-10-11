package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
public class QAccountSiteUrl extends RelationalPathBase<AccountSiteUrl> {
 public static final QAccountSiteUrl table = new QAccountSiteUrl("ARG_ACCOUNT_SITE_URL");
 public final NumberPath<Long> id = createNumber("id",Long.class);
 public final NumberPath<Long> siteId = createNumber("siteId",Long.class);
 public final NumberPath<Long> auditId = createNumber("auditId",Long.class);
 public final DateTimePath<Instant> createdAt = createDateTime("createdAt",Instant.class);
 public final PrimaryKey<AccountSiteUrl> primary = createPrimaryKey(id);
 public QAccountSiteUrl(String variable) {
  super(AccountSiteUrl.class,forVariable(variable),null,"ARG_ACCOUNT_SITE_URL");
  addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
  addMetadata(siteId,ColumnMetadata.named("site_id").ofType(Types.BIGINT));
  addMetadata(auditId,ColumnMetadata.named("audit_id").ofType(Types.BIGINT));
  addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
 }
}
