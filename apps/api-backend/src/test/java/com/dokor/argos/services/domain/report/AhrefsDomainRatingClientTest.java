package com.dokor.argos.services.domain.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AhrefsDomainRatingClientTest {
    private static final URI ENDPOINT = URI.create("https://api.ahrefs.com/v3/public/domain-rating-free");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-06T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void fetchesAndCachesValidRatingWithBearerKey() throws Exception {
        HttpClient http = mock(HttpClient.class);
        @SuppressWarnings("unchecked") HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("{\"domain_rating\":{\"domain_rating\":42.4}}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var client = new AhrefsDomainRatingClient(http, new ObjectMapper(), "secret", ENDPOINT, CLOCK);

        ReportDto.DomainRating first = client.get("Example.COM");
        assertNotNull(first);
        assertEquals(42.4, first.score());
        assertEquals("2026-10-06T12:00:00Z", first.fetchedAt());
        assertSame(first, client.get("example.com"));
        var request = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(http, times(1)).send(request.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals("https://api.ahrefs.com/v3/public/domain-rating-free?target=example.com",
            request.getValue().uri().toString());
        assertEquals("Bearer secret", request.getValue().headers().firstValue("Authorization").orElseThrow());
    }

    @Test
    void missingKeyAndUnavailableOrInvalidResponsesDoNotInventRating() throws Exception {
        HttpClient http = mock(HttpClient.class);
        var disabled = new AhrefsDomainRatingClient(http, new ObjectMapper(), "", ENDPOINT, CLOCK);
        assertNull(disabled.get("example.com"));
        verifyNoInteractions(http);

        @SuppressWarnings("unchecked") HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(429, 200, 200);
        when(response.body()).thenReturn("{\"domain_rating\":{\"domain_rating\":101}}",
            "{\"domain_rating\":{\"domain_rating\":0}}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var client = new AhrefsDomainRatingClient(http, new ObjectMapper(), "secret", ENDPOINT, CLOCK);
        assertNull(client.get("example.com"));
        assertNull(client.get("example.com"));
        assertEquals(0, client.get("example.com").score());
    }
}
