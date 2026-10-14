package com.dokor.argos.services.connected.discovery;

import com.dokor.argos.services.analysis.AuditEgress;
import com.dokor.argos.services.domain.audit.UrlNormalizer;

import jakarta.inject.*;

import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.GZIPInputStream;

/** Each hop is checked, then sent only via the mandatory DNS-pinning egress proxy. */
@Singleton
public class DiscoveryTransport {
    public record Response(int status, String type, String location, String body) {}

    private final DiscoveryPolicy policy;
    private final HttpClient client;
    // Native resolver calls may ignore interrupts: bounded threads AND queue prevent accumulation.
    private final ExecutorService dns =
            new ThreadPoolExecutor(
                    2,
                    2,
                    0,
                    TimeUnit.SECONDS,
                    new ArrayBlockingQueue<>(16),
                    Thread.ofPlatform().daemon().name("discovery-dns-", 0).factory(),
                    new ThreadPoolExecutor.AbortPolicy());

    @Inject
    public DiscoveryTransport(DiscoveryPolicy policy) {
        this(
                policy,
                HttpClient.newBuilder()
                        .proxy(AuditEgress.configured())
                        .followRedirects(HttpClient.Redirect.NEVER)
                        .connectTimeout(Duration.ofSeconds(policy.connectSeconds))
                        .build());
    }

    DiscoveryTransport(DiscoveryPolicy policy, HttpClient client) {
        this.policy = policy;
        this.client = client;
    }

    public void validate(String url, DiscoveryBudget budget) {
        Future<?> task;
        try {
            task = dns.submit(() -> UrlNormalizer.validatePublicUrl(url));
        } catch (RejectedExecutionException e) {
            throw new DiscoveryStop("DNS_BUSY");
        }
        try {
            await(task, budget, policy.connectSeconds * 1000L);
        } catch (DiscoveryStop e) {
            throw e;
        } catch (RuntimeException e) {
            throw new DiscoveryStop("TARGET_BLOCKED");
        } finally {
            task.cancel(true);
        }
    }

    public Response get(String url, int maxBytes, DiscoveryBudget budget) {
        validate(url, budget);
        var request =
                HttpRequest.newBuilder(URI.create(url))
                        .timeout(
                                Duration.ofMillis(
                                        Math.min(
                                                budget.remainingMillis(),
                                                policy.responseSeconds * 1000L)))
                        .header("User-Agent", "ArgosDiscovery/1.0 (+https://argos.lelouet.fr)")
                        .header("Accept", "text/html,application/xml,text/plain;q=0.9")
                        .header("Accept-Encoding", "gzip")
                        .GET()
                        .build();
        var future = client.sendAsync(request, info -> new LimitedBody(maxBytes));
        try {
            var response = await(future, budget, policy.responseSeconds * 1000L);
            if (response.headers().firstValue("x-argos-egress-blocked").orElse("").equals("1"))
                throw new DiscoveryStop("TARGET_BLOCKED");
            String encoding = response.headers().firstValue("content-encoding").orElse("identity");
            if (!encoding.equalsIgnoreCase("identity") && !encoding.equalsIgnoreCase("gzip"))
                throw new DiscoveryStop("CONTENT_ENCODING");
            byte[] bytes = response.body();
            if (encoding.equalsIgnoreCase("gzip")) {
                try (var stream = new GZIPInputStream(new ByteArrayInputStream(bytes));
                        var out = new ByteArrayOutputStream()) {
                    byte[] chunk = new byte[4096];
                    int n;
                    while ((n = stream.read(chunk)) != -1) {
                        budget.check();
                        if (out.size() + n > maxBytes) throw new DiscoveryStop("BODY_LIMIT");
                        out.write(chunk, 0, n);
                    }
                    bytes = out.toByteArray();
                } catch (IOException e) {
                    throw new DiscoveryStop("CONTENT_ENCODING");
                }
            }
            return new Response(
                    response.statusCode(),
                    response.headers().firstValue("content-type").orElse(""),
                    response.headers().firstValue("location").orElse(null),
                    new String(bytes, StandardCharsets.UTF_8));
        } finally {
            future.cancel(true);
        }
    }

    private static <T> T await(Future<T> task, DiscoveryBudget budget, long maxMillis) {
        long end = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(maxMillis);
        for (; ; ) {
            budget.check();
            long left =
                    Math.min(
                            budget.remainingMillis(),
                            TimeUnit.NANOSECONDS.toMillis(end - System.nanoTime()));
            if (left <= 0) throw new DiscoveryStop("RESPONSE_TIMEOUT");
            try {
                return task.get(Math.min(200, left), TimeUnit.MILLISECONDS);
            } catch (TimeoutException e) {
                /* Check cancellation while waiting for DNS, headers AND body. */
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new DiscoveryStop("CANCELED");
            } catch (ExecutionException e) {
                Throwable cause = e.getCause();
                while (cause != null) {
                    if (cause instanceof DiscoveryStop stop) throw stop;
                    cause = cause.getCause();
                }
                throw new DiscoveryStop("TRANSPORT_ERROR");
            }
        }
    }

    static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> result = new CompletableFuture<>();
        private final ByteArrayOutputStream out = new ByteArrayOutputStream();
        private final int max;
        private Flow.Subscription subscription;

        LimitedBody(int max) {
            this.max = max;
        }

        public CompletionStage<byte[]> getBody() {
            return result;
        }

        public void onSubscribe(Flow.Subscription s) {
            subscription = s;
            s.request(1);
        }

        public void onNext(List<ByteBuffer> buffers) {
            for (var b : buffers) {
                if (b.remaining() > max - out.size()) {
                    subscription.cancel();
                    result.completeExceptionally(new DiscoveryStop("BODY_LIMIT"));
                    return;
                }
                byte[] bytes = new byte[b.remaining()];
                b.get(bytes);
                out.writeBytes(bytes);
            }
            subscription.request(1);
        }

        public void onError(Throwable error) {
            result.completeExceptionally(error);
        }

        public void onComplete() {
            result.complete(out.toByteArray());
        }
    }
}
