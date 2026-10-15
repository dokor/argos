package com.dokor.argos.services.domain.report;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
class ModuleExecutionTest {
    private ModuleExecution states(String states) { return ModuleExecution.from(Map.of("moduleStatuses",states)); }
    @Test void sixSuccessesAndTwoFailuresAreTerminal() {
        var m=states("{\"http\":\"COMPLETED\",\"html\":\"COMPLETED\",\"runtime\":\"COMPLETED\",\"lighthouse\":\"COMPLETED\",\"tech\":\"COMPLETED\",\"zap\":\"COMPLETED\",\"ssl\":\"FAILED\",\"observatory\":\"UNAVAILABLE\"}");
        assertEquals(8,m.total()); assertEquals(6,m.completed()); assertEquals(2,m.failed()); assertEquals(100,m.terminalPercent());
    }
    @Test void ongoingAndSkippedAreDistinct() {
        var m=states("{\"a\":\"COMPLETED\",\"b\":\"RUNNING\",\"c\":\"PENDING\",\"d\":\"SKIPPED\"}");
        assertEquals(50,m.terminalPercent()); assertEquals(1,m.skipped()); assertEquals(1,m.pending()); assertEquals(1,m.running());
    }
    @Test void successfulPartialAndTimeoutAllFinishProgress() {
        assertEquals(100,states("{\"a\":\"COMPLETED\",\"b\":\"COMPLETED\"}").terminalPercent());
        var m=states("{\"a\":\"PARTIAL\",\"b\":\"TIMEOUT\"}");
        assertEquals(100,m.terminalPercent()); assertEquals(1,m.partial()); assertEquals(1,m.failed()); assertEquals(0,m.completed());
    }
    @Test void historicalOrMalformedMetadataDoesNotInventProgress() {
        assertNull(ModuleExecution.from(null)); assertNull(ModuleExecution.from(Map.of()));
        for(var raw:new String[]{"{}","[]","bad","{\"a\":\"FUTURE\"}","{\"a\":3}"}) assertNull(states(raw));
    }
}
