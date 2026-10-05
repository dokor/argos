package com.dokor.argos.services.analysis;

import com.typesafe.config.Config;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.MDC;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.concurrent.*;

/** One bounded worker preserves the order of local/browser stages and permits cancellation. */
@Singleton
public class AuditModuleExecutor implements AutoCloseable {
    private final ThreadPoolExecutor executor;
    private final Duration timeout;
    @Inject public AuditModuleExecutor(Config config) {
        this(config.hasPath("audit.timeout")?config.getDuration("audit.timeout"):Duration.ofSeconds(120));
    }
    public AuditModuleExecutor(Duration timeout) {
        if(timeout.isNegative() || timeout.isZero()) throw new IllegalArgumentException("Audit timeout must be positive");
        this.timeout=timeout;
        executor=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,new ArrayBlockingQueue<>(1),task -> {
            var thread=new Thread(task,"audit-local"); thread.setDaemon(true); return thread;
        },new ThreadPoolExecutor.AbortPolicy());
    }
    public AuditDeadline deadline() { return new AuditDeadline(timeout); }
    public Duration collectionBudget() { return timeout.minusNanos(Math.min(Duration.ofSeconds(5).toNanos(),timeout.toNanos()/10)); }
    public <T> T execute(AuditDeadline deadline,Callable<T> call) throws Exception {
        if(deadline.expired()) throw new HttpTimeoutException("Audit deadline exceeded (timeout)");
        executor.purge(); var context=MDC.getCopyOfContextMap();
        var future=executor.submit(() -> {
            try { if(context!=null) MDC.setContextMap(context); return deadline.call(call); }
            finally { MDC.clear(); }
        });
        try { return future.get(deadline.remainingNanos(),TimeUnit.NANOSECONDS); }
        catch(TimeoutException timeout) { future.cancel(true); throw new HttpTimeoutException("Audit deadline exceeded (timeout)"); }
        catch(InterruptedException stop) { future.cancel(true); Thread.currentThread().interrupt(); throw stop; }
        catch(ExecutionException failure) {
            if(failure.getCause() instanceof Exception error) throw error;
            if(failure.getCause() instanceof Error error) throw error;
            throw new IllegalStateException(failure.getCause());
        }
    }
    @Override public void close() { executor.shutdownNow(); }
}
