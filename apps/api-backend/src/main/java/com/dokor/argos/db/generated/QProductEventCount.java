package com.dokor.argos.db.generated;
import com.querydsl.core.types.dsl.*;
import com.querydsl.sql.*;
import java.sql.Types;
import static com.querydsl.core.types.PathMetadataFactory.forVariable;
/** Manually maintained query mapping for V10. */
public class QProductEventCount extends RelationalPathBase<ProductEventCount> {
    public static final QProductEventCount productEventCount=new QProductEventCount("ARG_PRODUCT_EVENT_COUNT");
    public final DatePath<java.time.LocalDate> eventDay=createDate("eventDay",java.time.LocalDate.class);
    public final StringPath eventName=createString("eventName");
    public final StringPath sourceRoute=createString("sourceRoute");
    public final StringPath locale=createString("locale");
    public final StringPath placement=createString("placement");
    public final StringPath errorCategory=createString("errorCategory");
    public final NumberPath<Long> eventCount=createNumber("eventCount",Long.class);
    public QProductEventCount(String variable){super(ProductEventCount.class,forVariable(variable),"null","ARG_PRODUCT_EVENT_COUNT");
        addMetadata(eventDay,ColumnMetadata.named("event_day").withIndex(1).ofType(Types.DATE).notNull());
        addMetadata(eventName,ColumnMetadata.named("event_name").withIndex(2).ofType(Types.VARCHAR).withSize(40).notNull());
        addMetadata(sourceRoute,ColumnMetadata.named("source_route").withIndex(3).ofType(Types.VARCHAR).withSize(80).notNull());
        addMetadata(locale,ColumnMetadata.named("locale").withIndex(4).ofType(Types.CHAR).withSize(2).notNull());
        addMetadata(placement,ColumnMetadata.named("placement").withIndex(5).ofType(Types.VARCHAR).withSize(16).notNull());
        addMetadata(errorCategory,ColumnMetadata.named("error_category").withIndex(6).ofType(Types.VARCHAR).withSize(16).notNull());
        addMetadata(eventCount,ColumnMetadata.named("event_count").withIndex(7).ofType(Types.BIGINT).notNull());
    }
}
