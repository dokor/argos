package com.dokor.argos.services.billing;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.*;

/** Only controlled codes cross the account boundary. No provider message or raw exception. */
public final class BillingError extends WebApplicationException {
    public static final Set<String> CODES=Set.of("billing_disabled","billing_configuration","billing_sync_pending",
        "billing_payment_required","billing_existing_subscription","billing_interval_locked","billing_managed_elsewhere",
        "billing_unavailable","billing_request_invalid","billing_webhook_invalid");
    private final String code;
    public BillingError(String code){this(code,UUID.randomUUID().toString());}
    private BillingError(String code,String requestId){super(response(code,requestId));this.code=code;
        if(code.equals("billing_unavailable")||code.equals("billing_configuration"))
            org.slf4j.LoggerFactory.getLogger(BillingError.class).warn("billing_failure code={} requestId={}",code,requestId);}
    public String code(){return code;}
    private static Response response(String code,String requestId){
        if(!CODES.contains(code))throw new IllegalArgumentException("Unknown billing error");
        int status=switch(code){case "billing_disabled"->403;case "billing_webhook_invalid","billing_request_invalid"->400;
            case "billing_unavailable"->503;default->409;};
        return Response.status(status).type("application/json").header("Cache-Control","private, no-store")
            .header("X-Content-Type-Options","nosniff").header("Referrer-Policy","no-referrer")
            .entity(Map.of("error",code,"requestId",requestId)).build();
    }
    public static BillingError unavailable(){return new BillingError("billing_unavailable");}
}
