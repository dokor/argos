package com.dokor.argos.services.analysis;

import com.typesafe.config.Config;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.MDC;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Opt-in, shared budgeted pool exclusively for SSL Labs and Observatory; no browser runs here. */
@Singleton
public class RemoteModuleExecutor implements AutoCloseable {
    private final ThreadPoolExecutor executor;
    private final long budgetNanos;
    private final int maxConcurrentModules;

    @Inject
    public RemoteModuleExecutor(Config config) {
        this(config.hasPath("audit.remote-modules.timeout")
            ? config.getDuration("audit.remote-modules.timeout") : Duration.ofMinutes(2),
            config.hasPath("audit.execution.max-concurrent-modules")
                ? config.getInt("audit.execution.max-concurrent-modules") : 1);
    }

    public RemoteModuleExecutor(Duration timeout) {
        this(timeout, 1);
    }

    /** One local worker plus, when enabled, one or two remote workers. */
    public RemoteModuleExecutor(Duration timeout, int maxConcurrentModules) {
        if (timeout.isZero() || timeout.isNegative()) throw new IllegalArgumentException("Remote module timeout must be positive");
        if (maxConcurrentModules < 1 || maxConcurrentModules > 3)
            throw new IllegalArgumentException("audit.execution.max-concurrent-modules must be between 1 and 3");
        budgetNanos = timeout.toNanos();
        this.maxConcurrentModules = maxConcurrentModules;
        if (maxConcurrentModules == 1) {
            executor = null;
            return;
        }
        int workers = maxConcurrentModules - 1;
        AtomicInteger threads = new AtomicInteger();
        executor = new ThreadPoolExecutor(workers, workers, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(2), runnable -> {
            Thread thread = new Thread(runnable, "audit-remote-" + threads.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        }, new ThreadPoolExecutor.AbortPolicy());
    }

    public int maxConcurrentModules() { return maxConcurrentModules; }
    public boolean parallelEnabled() { return maxConcurrentModules > 1; }
    public Duration timeoutBudget() { return Duration.ofNanos(budgetNanos); }

    public <T> Task<T> submit(String module, Callable<T> call) {
        if (!AuditModule.SSL.id().equals(module) && !AuditModule.OBSERVATORY.id().equals(module))
            throw new IllegalArgumentException("Not a remote module");
        if (!parallelEnabled()) throw new IllegalStateException("Remote parallelism is disabled");
        long submitted = System.nanoTime();
        long effectiveBudget = AuditDeadline.current()==null ? budgetNanos : Math.min(budgetNanos,AuditDeadline.current().remainingNanos());
        long startedAtMillis = System.currentTimeMillis();
        Map<String, String> context = MDC.getCopyOfContextMap();
        Callable<T> contextual = () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            try {
                if (context == null) MDC.clear(); else MDC.setContextMap(context);
                MDC.put("module", module);
                if (System.nanoTime() - submitted >= effectiveBudget) throw timeout();
                T result = call.call();
                if (System.nanoTime() - submitted >= effectiveBudget) throw timeout();
                return result;
            } finally {
                if (previous == null) MDC.clear(); else MDC.setContextMap(previous);
            }
        };
        Future<T> future;
        executor.purge();
        try { future = executor.submit(contextual); }
        catch (RejectedExecutionException rejected) {
            CompletableFuture<T> failed = new CompletableFuture<>();
            failed.completeExceptionally(rejected);
            future = failed;
        }
        return new Task<>(future, submitted, startedAtMillis, effectiveBudget);
    }

    private static HttpTimeoutException timeout() { return new HttpTimeoutException("Remote module deadline exceeded (timeout)"); }

    public static final class Task<T> implements AutoCloseable {
        private final Future<T> future;
        private final long submitted;
        private final long budget;
        private final long startedAtMillis;
        private Task(Future<T> future, long submitted, long startedAtMillis, long budget) {
            this.future = future; this.submitted = submitted; this.startedAtMillis = startedAtMillis; this.budget = budget;
        }
        public long startedAtMillis() { return startedAtMillis; }
        public T await() throws Exception {
            try {
                // An already-finished result remains readable after the local modules ran.
                return future.isDone() ? future.get()
                    : future.get(Math.max(0, budget - (System.nanoTime() - submitted)), TimeUnit.NANOSECONDS);
            } catch (TimeoutException timedOut) { future.cancel(true); throw timeout(); }
            catch (InterruptedException interrupted) { future.cancel(true); Thread.currentThread().interrupt(); throw interrupted; }
            catch (ExecutionException failed) {
                if (failed.getCause() instanceof Exception cause) throw cause;
                if (failed.getCause() instanceof Error cause) throw cause;
                throw new IllegalStateException("Remote module failed", failed.getCause());
            }
        }
        @Override public void close() { if (!future.isDone()) future.cancel(true); }
    }

    @Override public void close() {
        if (executor == null) return;
        for (Runnable pending : executor.shutdownNow())
            if (pending instanceof Future<?> future) future.cancel(true);
        try { executor.awaitTermination(5, TimeUnit.SECONDS); }
        catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
    }
}
