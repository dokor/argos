package com.dokor.argos.services.billing;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

/** Server-only fixed-origin transport. All identifiers come from persisted owner bindings. */
public interface StripeGateway {
    JsonNode get(String path,Map<String,String> query);
    JsonNode post(String path,Map<String,String> form,String idempotencyKey);
}
