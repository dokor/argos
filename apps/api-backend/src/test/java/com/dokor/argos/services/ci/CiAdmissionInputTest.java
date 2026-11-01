package com.dokor.argos.services.ci;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CiAdmissionInputTest {
    private final ObjectMapper mapper=new ObjectMapper();
    @Test void onlyExplicitFullProfileAndOneOrTwoSamplesAreAllowed() throws Exception {
        var value=CiAdmissionService.input(mapper.readTree("{\"url\":\"https://EXAMPLE.com/\",\"profileId\":\"standard-v1\",\"samples\":2}"));
        assertEquals("https://example.com",value.url());assertEquals(2,value.samples());
        for(String json:new String[]{"{}","[]","{\"url\":\"https://example.com\",\"samples\":1,\"profileId\":\"standard-v1\",\"owner\":99}",
            "{\"url\":\"https://example.com\",\"samples\":1.5,\"profileId\":\"standard-v1\"}",
            "{\"url\":\"https://example.com\",\"samples\":1,\"profileId\":\"disable-security\"}"}) {
            var parsed=mapper.readTree(json);assertThrows(WebApplicationException.class,()->CiAdmissionService.input(parsed));
        }
    }
    @Test void credentialsQueriesFragmentsAndNonHttpsTargetsCannotEnterAnAdmission() {
        for(String url:new String[]{"https://user:pass@example.com","https://example.com?token=private","https://example.com#private", "http://example.com","https://127.0.0.1","https://example.com/"+"x".repeat(2048)})
            assertThrows(WebApplicationException.class,()->CiAdmissionService.input(mapper.valueToTree(new CiAdmissionService.Input(url,1,"standard-v1"))));
    }
}
