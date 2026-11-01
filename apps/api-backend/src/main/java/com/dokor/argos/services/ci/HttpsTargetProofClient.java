package com.dokor.argos.services.ci;

import com.dokor.argos.services.analysis.AuditEgress;
import com.dokor.argos.services.token.TokenService;
import jakarta.inject.*;
import java.net.URI;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.Flow;

/** Fixed proof path, no credentials/cookies, no redirects, mandatory pinned egress and hard deadline. */
@Singleton
public class HttpsTargetProofClient {
    private final HttpClient client;
    private final TokenService tokens;
    private final long timeoutMillis;
    private final Semaphore capacity = new Semaphore(2);
    @Inject public HttpsTargetProofClient(TokenService tokens) {
        this(transport(AuditEgress.configured(),null), tokens);
    }
    /** Package seam for a local test CA; production always uses the JVM trust store. */
    static HttpClient transport(java.net.ProxySelector proxy,javax.net.ssl.SSLContext roots) {
        var builder=HttpClient.newBuilder().proxy(proxy).followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(java.time.Duration.ofSeconds(3));
        if(roots!=null)builder.sslContext(roots);
        return builder.build();
    }
    HttpsTargetProofClient(HttpClient client, TokenService tokens) { this(client,tokens,8000); }
    HttpsTargetProofClient(HttpClient client, TokenService tokens,long timeoutMillis) {
        if(timeoutMillis<1 || timeoutMillis>8000) throw new IllegalArgumentException("Invalid proof deadline");
        this.client = client; this.tokens = tokens; this.timeoutMillis=timeoutMillis;
    }
    public static String path(String publicId) {
        if (publicId == null || !publicId.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))
            throw new IllegalArgumentException("Invalid proof identifier");
        return "/.well-known/argos-ci/" + publicId + ".txt";
    }
    public boolean matches(String origin, String publicId, byte[] expectedHash) {
        if (!capacity.tryAcquire()) return false;
        CompletableFuture<HttpResponse<String>> future = null;
        try {
            var request = HttpRequest.newBuilder(URI.create(CiOrigin.parse(origin) + path(publicId)))
                .timeout(java.time.Duration.ofMillis(timeoutMillis)).header("User-Agent", "argos-domain-verification/1")
                .header("Accept", "text/plain").header("Accept-Encoding", "identity").GET().build();
            future = client.sendAsync(request, ignored -> new ProofBody());
            var response = future.get(timeoutMillis, TimeUnit.MILLISECONDS);
            if (response.statusCode() != 200 || expectedHash == null) return false;
            // The sole optional final newline is suitable for a static text file, not an HTML page.
            var body = response.body();
            if (body.endsWith("\r\n")) body = body.substring(0, body.length()-2);
            else if (body.endsWith("\n")) body = body.substring(0, body.length()-1);
            return body.matches("argos-ci-v1=[A-Za-z0-9_-]{43}")
                && MessageDigest.isEqual(expectedHash, tokens.sha256(body));
        } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); return false; }
        catch (Exception failed) { return false; } // Never expose target/DNS/TLS/body/exception text.
        finally { if (future != null && !future.isDone()) future.cancel(true); capacity.release(); }
    }
    /** Complete only after the bounded body ends, so the deadline covers slow/chunked responses. */
    static final class ProofBody implements HttpResponse.BodySubscriber<String> {
        private final CompletableFuture<String> body = new CompletableFuture<>();
        private final java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        private Flow.Subscription subscription;
        public CompletionStage<String> getBody() { return body; }
        public void onSubscribe(Flow.Subscription s) { subscription=s; s.request(1); }
        public void onNext(List<ByteBuffer> chunks) {
            for (var chunk : chunks) {
                if (chunk.remaining() > 1024-bytes.size()) { subscription.cancel(); body.completeExceptionally(new IllegalStateException("Proof too large")); return; }
                while (chunk.hasRemaining()) bytes.write(chunk.get());
            }
            subscription.request(1);
        }
        public void onError(Throwable error) { body.completeExceptionally(new IllegalStateException("Proof unavailable")); }
        public void onComplete() { body.complete(bytes.toString(java.nio.charset.StandardCharsets.UTF_8)); }
    }
}
