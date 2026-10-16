package com.dokor.argos.services.connected.discovery;

import static org.junit.jupiter.api.Assertions.*;
import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typesafe.config.ConfigFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;

class DiscoveryPolicyTest {
    @Test void defaultsRejectForgedLimitsAndPublishSafeDefaults() {
        var p = new DiscoveryPolicy(ConfigFactory.empty());
        assertEquals(50, p.capabilities().maxUrls());
        assertEquals(3, p.capabilities().maxDepth());
        assertEquals(400, assertThrows(AccountError.class, () -> p.validate(input(51,3))).getResponse().getStatus());
        assertThrows(AccountError.class, () -> p.validate(input(50,4)));
        assertDoesNotThrow(() -> p.validate(input(50,0)));
    }
    @Test void operatorsCanRaiseLimitsAndQueuedSnapshotsCanOnlyShrink() {
        var large = new DiscoveryPolicy(ConfigFactory.parseString("discovery.max-urls=200\ndiscovery.max-depth=5"));
        large.validate(input(200,5));
        var saved = large.limits(input(200,5));
        var small = new DiscoveryPolicy(ConfigFactory.empty());
        assertEquals(50, small.restrict(saved).maxUrls());
        assertEquals(3, small.restrict(saved).maxDepth());
        assertEquals(20, large.restrict(large.limits(input(20,2))).maxUrls());
    }
    @ParameterizedTest
    @ValueSource(strings={"max-urls=0","max-urls=-1","max-urls=1001","max-urls=2.5","max-depth=-1","max-depth=11","max-depth=1.2","duration-seconds=301","account-queue-limit=0","max-requests=10001","workers=0"})
    void rejectsInvalidOperatorConfiguration(String value) {
        assertThrows(RuntimeException.class, () -> new DiscoveryPolicy(ConfigFactory.parseString("discovery."+value)));
    }
    @ParameterizedTest
    @ValueSource(strings={"0","-1","1001","1.5","1.0","1e2","\"50\"","true","null","9223372036854775808","[]","{}"})
    void directJsonCannotCoerceInvalidUrlLimits(String value) {
        var json="{\"hostname\":\"example.com\",\"maxUrls\":"+value+",\"maxDepth\":3,\"excludedPaths\":[]}";
        assertThrows(Exception.class, () -> new ObjectMapper().readValue(json, CreateDiscovery.class));
    }
    @ParameterizedTest
    @ValueSource(strings={"-1","11","0.5","\"3\"","false","null","9223372036854775808"})
    void directJsonCannotCoerceInvalidDepth(String value) {
        var json="{\"hostname\":\"example.com\",\"maxUrls\":50,\"maxDepth\":"+value+",\"excludedPaths\":[]}";
        assertThrows(Exception.class, () -> new ObjectMapper().readValue(json, CreateDiscovery.class));
    }
    @Test void missingAndUnknownParametersAreRejected() {
        var mapper = new ObjectMapper();
        assertThrows(Exception.class, () -> mapper.readValue("{\"hostname\":\"example.com\",\"excludedPaths\":[]}", CreateDiscovery.class));
        assertThrows(Exception.class, () -> mapper.readValue("{\"hostname\":\"example.com\",\"maxUrls\":50,\"maxDepth\":3,\"excludedPaths\":[],\"workers\":100}", CreateDiscovery.class));
    }
    private CreateDiscovery input(long urls,long depth) {return new CreateDiscovery("example.com",urls,depth,List.of());}
}
