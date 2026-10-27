package com.dokor.argos.services.billing;

import com.typesafe.config.Config;
import jakarta.inject.*;

/** Publishing configured prices never opens any commercial gate or provisions a secret. */
@Singleton
public final class BillingSettings {
    public static final String API_VERSION="2026-09-30.endive";
    private final Config c;
    private final boolean enabled,payments,live,approved;
    @Inject public BillingSettings(Config root) {
        c=root.getConfig("billing");enabled=c.getBoolean("enabled");
        payments=c.getBoolean("payments-enabled");live=c.getBoolean("live-mode");approved=c.getBoolean("prices-approved");
        if(payments&&!enabled)throw invalid();
        if(approved||c.hasPath("monthly-amount-ht-cents")||c.hasPath("annual-amount-ht-cents")) {
            long m=amount("MONTH"),y=amount("YEAR");
            if(m<1||y<1||m>100_000_000||y>=Math.multiplyExact(m,12))throw invalid();
        }
        if(enabled){
            if(c.getInt("reconciliation-batch-size")<1||c.getInt("reconciliation-batch-size")>100||c.getDouble("reconciliation-batch-size")!=c.getInt("reconciliation-batch-size"))throw invalid();
            if(!approved||!c.getBoolean("launch-approved")||!c.getBoolean("tax-ready"))throw invalid();
            if(!id("account-id").matches("acct_[A-Za-z0-9]{4,80}")||!id("product-id").matches("prod_[A-Za-z0-9]{4,80}")
                ||!id("portal-config-id").matches("bpc_[A-Za-z0-9]{4,80}"))throw invalid();
            for(String interval:new String[]{"MONTH","YEAR"})if(!price(interval).matches("price_[A-Za-z0-9]{4,80}"))throw invalid();
            if(price("MONTH").equals(price("YEAR")))throw invalid();
            if(!key().matches("(?:sk|rk)_"+(live?"live":"test")+"_[A-Za-z0-9_]{16,256}")
                ||!webhookSecret().matches("whsec_[A-Za-z0-9_]{16,256}"))throw invalid();
        }
    }
    private static IllegalArgumentException invalid(){return new IllegalArgumentException("Billing configuration is incomplete or inconsistent");}
    public boolean enabled(){return enabled;}
    public boolean payments(){return enabled&&payments;}
    public boolean live(){return live;}
    public boolean pricesApproved(){return approved;}
    public int batchSize(){return c.getInt("reconciliation-batch-size");}
    public String id(String name){return c.hasPath(name)?c.getString(name):"";}
    public String key(){return id("api-key");}
    public String webhookSecret(){return id("webhook-secret");}
    public String price(String interval){return id(interval.equals("MONTH")?"monthly-price-id":"annual-price-id");}
    public Long configuredAmount(String interval){
        return c.hasPath(interval.equals("MONTH")?"monthly-amount-ht-cents":"annual-amount-ht-cents")?amount(interval):null;
    }
    public long amount(String interval){String p=interval.equals("MONTH")?"monthly-amount-ht-cents":"annual-amount-ht-cents";
        if(!c.hasPath(p)||c.getDouble(p)!=c.getLong(p))throw invalid();return c.getLong(p);}
    public void requireEnabled(){if(!enabled)throw new BillingError("billing_disabled");}
    public void requirePayments(){if(!payments())throw new BillingError("billing_disabled");}
}
