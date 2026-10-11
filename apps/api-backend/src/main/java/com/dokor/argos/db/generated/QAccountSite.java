package com.dokor.argos.db.generated;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import java.time.Instant;
public class QAccountSite extends RelationalPathBase<AccountSite> {
 public static final QAccountSite table = new QAccountSite("ARG_ACCOUNT_SITE");
 public final NumberPath<Long> id = createNumber("id",Long.class);
 public final NumberPath<Long> ownerUserId = createNumber("ownerUserId",Long.class);
 public final NumberPath<Long> domainId = createNumber("domainId",Long.class);
 public final DateTimePath<Instant> createdAt = createDateTime("createdAt",Instant.class);
 public final PrimaryKey<AccountSite> primary = createPrimaryKey(id);
 public QAccountSite(String variable) {
  super(AccountSite.class,forVariable(variable),null,"ARG_ACCOUNT_SITE");
  addMetadata(id,ColumnMetadata.named("id").ofType(Types.BIGINT));
  addMetadata(ownerUserId,ColumnMetadata.named("owner_user_id").ofType(Types.BIGINT));
  addMetadata(domainId,ColumnMetadata.named("domain_id").ofType(Types.BIGINT));
  addMetadata(createdAt,ColumnMetadata.named("created_at").ofType(Types.TIMESTAMP));
 }
}
