package com.dokor.argos.services.billing;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

/** Required Stripe fields fail closed; new optional fields are never copied to Argos. */
public final class StripeObjects {
    private StripeObjects(){}
    public static void require(boolean ok){if(!ok)throw new BillingError("billing_configuration");}
    public static String text(JsonNode n,String key){var v=n.path(key);require(v.isTextual()&&v.textValue().length()<=4096);return v.textValue();}
    public static String id(JsonNode n,String key,String prefix){String v=text(n,key);require(v.matches(prefix.equals("cs")?"cs_(?:test_|live_)[A-Za-z0-9]{4,80}":prefix+"_[A-Za-z0-9]{4,80}"));return v;}
    public static boolean bool(JsonNode n,String key){require(n.path(key).isBoolean());return n.path(key).booleanValue();}
    public static long number(JsonNode n,String key){require(n.path(key).isIntegralNumber()&&n.path(key).canConvertToLong());return n.path(key).longValue();}
    public static Instant time(JsonNode n,String key){long v=number(n,key);require(v>0&&v<4_102_444_800L);return Instant.ofEpochSecond(v);}
    public static void type(JsonNode n,String type){require(n.isObject()&&type.equals(text(n,"object")));}
}
