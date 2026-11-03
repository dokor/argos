package com.dokor.argos.services.ci;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CiOriginTest {
    @Test void exactOriginDoesNotGrantWwwSubdomainsOrAnotherTenant() {
        assertEquals("https://example.com",CiOrigin.parse("https://EXAMPLE.com:443/"));
        assertEquals("https://tenant.github.io",CiOrigin.parse("https://tenant.github.io"));
        var scope=List.of("https://example.com");
        CiOrigin.require(scope,"https://example.com/path?q=1");
        for(String url:List.of("https://www.example.com","https://a.example.com","http://example.com","https://other.github.io"))
            assertThrows(IllegalArgumentException.class,()->CiOrigin.require(scope,url));
    }
    @Test void wildcardSuffixCredentialPathQueryFragmentAndPrivateOriginsAreRejected() {
        for(String origin:List.of("https://com","https://co.uk","https://github.io","https://*.example.com",
            "http://example.com","https://example.com/path","https://example.com?x=1","https://example.com#fragment",
            "https://user@example.com","https://127.0.0.1","https://8.8.8.8","https://localhost","https://example.com:444"))
            assertThrows(Exception.class,()->CiOrigin.parse(origin),origin);
        assertThrows(Exception.class,()->CiOrigin.scope(List.of()));
        assertThrows(Exception.class,()->CiOrigin.scope(List.of("https://example.com","https://example.com")));
    }
}
