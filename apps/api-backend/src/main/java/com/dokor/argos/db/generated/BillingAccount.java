package com.dokor.argos.db.generated;
import com.coreoz.plume.db.querydsl.crud.CrudEntityQuerydsl;
import com.querydsl.sql.Column;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
/** V47 private provider binding; never serialized as an API response. */
@Getter @Setter
public class BillingAccount extends CrudEntityQuerydsl {
    @Column("id") private Long id;
    @Column("binding_id") private String bindingId;
    @Column("stripe_account") private String stripeAccount;
    @Column("live_mode") private Boolean liveMode;
    @Column("customer_id") private String customerId;
    @Column("subscription_id") private String subscriptionId;
    @Column("charge_id") private String chargeId;
    @Column("phase") private String phase;
    @Column("status") private String status;
    @Column("billing_interval") private String billingInterval;
    @Column("period_end") private Instant periodEnd;
    @Column("last_synced_at") private Instant lastSyncedAt;
    @Column("next_sync_at") private Instant nextSyncAt;
    @Column("sync_generation") private Long syncGeneration;
    @Column("attempts") private Integer attempts;
    @Column("last_error") private String lastError;
    @Column("lease_token") private String leaseToken;
    @Column("lease_until") private Instant leaseUntil;
    @Column("checkout_key") private String checkoutKey;
    @Column("checkout_id") private String checkoutId;
    @Column("checkout_interval") private String checkoutInterval;
    @Column("checkout_lang") private String checkoutLang;
    @Column("checkout_price_id") private String checkoutPriceId;
    @Column("checkout_origin") private String checkoutOrigin;
    @Column("checkout_created_at") private Instant checkoutCreatedAt;
    @Column("checkout_attempted_at") private Instant checkoutAttemptedAt;
    @Column("customer_attempted_at") private Instant customerAttemptedAt;
    @Column("checkout_expires_at") private Instant checkoutExpiresAt;
    @Column("prior_offer") private String priorOffer;
    @Column("managed_offer") private Boolean managedOffer;
    @Override public String toString(){return "BillingAccount#"+id;}
}
