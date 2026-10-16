package com.dokor.argos.services.security;
import com.dokor.argos.services.account.AccountError;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class AntiBotServiceTest {
    private final Clock clock=Clock.fixed(Instant.parse("2026-10-16T10:00:00Z"),ZoneOffset.UTC);
    private static final String CONFIG="antibot { mode=turnstile, site-key=public-key, secret=server-secret, hostnames=[\"argos.example\"] }";
    private AntiBotService service(AntiBotService.Verification transport) {return new AntiBotService(ConfigFactory.parseString(CONFIG),new ObjectMapper(),clock,transport);}
    private String result(String action,String host,String date,boolean success) {return "{\"success\":"+success+",\"action\":\""+action+"\",\"hostname\":\""+host+"\",\"challenge_ts\":\""+date+"\"}";}
    private String valid() {return result("audit","argos.example","2026-10-16T09:59:00Z",true);}
    @Test void checksMissingForgedExpiredWrongActionAndHostnameWithoutDisclosingDetails() {
        var service=service(json->valid());
        for(String token:new String[]{null,"","x".repeat(2049)}) assertThrows(AccountError.class,()->service.require(token,"audit"));
        for(String response:new String[]{result("register","argos.example","2026-10-16T09:59:00Z",true),result("audit","other.example","2026-10-16T09:59:00Z",true),result("audit","argos.example","2026-10-16T09:55:00Z",true),result("audit","argos.example","2026-10-16T10:10:00Z",true),result("audit","argos.example","2026-10-16T09:59:00Z",false),"{}","null"}) {
            assertEquals(400,assertThrows(AccountError.class,()->service(json->response).require("proof","audit")).getResponse().getStatus());
        }
    }
    @Test void providerConsumesTokenOnceAndReceivesOnlySecretAndProof() {
        AtomicInteger calls=new AtomicInteger();
        var service=service(json->{assertEquals(new ObjectMapper().readTree("{\"secret\":\"server-secret\",\"response\":\"proof\"}"),new ObjectMapper().readTree(json));return calls.getAndIncrement()==0?valid():"{\"success\":false}";});
        service.require("proof","audit");assertThrows(AccountError.class,()->service.require("proof","audit"));
        assertEquals(2,calls.get());assertFalse(service.publicConfig().toString().contains("server-secret"));
    }
    @Test void providerOutageFailsClosedAndIncompleteConfigCannotEnableProtection() {
        assertEquals(503,assertThrows(AccountError.class,()->service(json->{throw new java.io.IOException("private provider details");}).require("proof","audit")).getResponse().getStatus());
        assertThrows(IllegalStateException.class,()->new AntiBotService(ConfigFactory.parseString("antibot.mode=turnstile"),new ObjectMapper(),clock,json->valid()));
        var disabled=new AntiBotService(ConfigFactory.parseString("antibot.mode=disabled"),new ObjectMapper(),clock,json->{fail("No external request when explicitly disabled");return "";});
        disabled.require(null,"audit");assertEquals(false,disabled.publicConfig().get("enabled"));
    }
}
