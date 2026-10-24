package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
/** V47 private provider binding; never serialized as an API response. */
@Getter @Setter
public class BillingEvent extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("event_id") private String eventId;
    @Column("stripe_account") private String stripeAccount;
    @Column("live_mode") private Boolean liveMode;
    @Column("body_hash") private byte[] bodyHash;
    @Column("event_type") private String eventType;
    @Column("received_at") private Instant receivedAt;
    @Column("owner_id") private Long ownerId;
    @Override public String toString(){return "BillingEvent#"+id;}
}
