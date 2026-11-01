package com.dokor.argos.services.ci;
import com.dokor.argos.services.token.TokenService;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.Flow;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class HttpsTargetProofClientTest {
    private final TokenService tokens=new TokenService();
    private static final String ID="49e4eac3-00a9-4de4-81dc-f4686fb677cc";
    @SuppressWarnings("unchecked")
    @Test void verifiesOnlyExactProofWithoutFollowingRedirectOrForwardingCredentials() throws Exception {
        var http=mock(HttpClient.class); var response=mock(HttpResponse.class);
        var value="argos-ci-v1="+tokens.generateToken(); var proof=new HttpsTargetProofClient(http,tokens);
        when(http.sendAsync(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenReturn(CompletableFuture.completedFuture(response));
        when(response.statusCode()).thenReturn(200);when(response.body()).thenReturn(value+"\n");
        assertTrue(proof.matches("https://example.com",ID,tokens.sha256(value)));
        var request=org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).sendAsync(request.capture(),any(HttpResponse.BodyHandler.class));
        assertEquals("https://example.com/.well-known/argos-ci/"+ID+".txt",request.getValue().uri().toString());
        assertTrue(request.getValue().headers().firstValue("Authorization").isEmpty());
        assertTrue(request.getValue().headers().firstValue("Cookie").isEmpty());
        assertEquals("GET",request.getValue().method());
        for(int status:new int[]{301,302,307,308,404,500}) {when(response.statusCode()).thenReturn(status);assertFalse(proof.matches("https://example.com",ID,tokens.sha256(value)));}
        when(response.statusCode()).thenReturn(200);
        for(String invalid:List.of("<html>"+value+"</html>",value+"\n\n","argos-ci-v1="+"x".repeat(43),value+" ")) {
            when(response.body()).thenReturn(invalid);assertFalse(proof.matches("https://example.com",ID,tokens.sha256(value)));
        }
    }
    @Test void bodySubscriberCancelsOversizedChunkedContent() {
        var subscriber=new HttpsTargetProofClient.ProofBody(); var subscription=mock(Flow.Subscription.class);
        subscriber.onSubscribe(subscription);
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[1024])));
        subscriber.onNext(List.of(ByteBuffer.wrap(new byte[1])));
        assertThrows(CompletionException.class,()->subscriber.getBody().toCompletableFuture().join());
        verify(subscription).cancel();
    }
    @Test void absentEgressNeverFallsBackToADirectConnection() {
        var http=HttpClient.newBuilder().proxy(new com.dokor.argos.services.analysis.AuditEgress(null)).build();
        assertFalse(new HttpsTargetProofClient(http,tokens).matches("https://example.com",ID,tokens.sha256("fixture")));
    }
    @SuppressWarnings("unchecked")
    @Test void deadlineCancelsAnIncompleteResponseAndReleasesCapacity() {
        var http=mock(HttpClient.class);var pending=new CompletableFuture<HttpResponse<String>>();
        when(http.sendAsync(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenReturn(pending);
        var client=new HttpsTargetProofClient(http,tokens,30);
        assertFalse(client.matches("https://example.com",ID,tokens.sha256("fixture")));
        assertTrue(pending.isCancelled());
    }
}
