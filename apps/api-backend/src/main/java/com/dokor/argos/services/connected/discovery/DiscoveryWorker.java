package com.dokor.argos.services.connected.discovery;

import com.dokor.argos.db.dao.DiscoveryDao;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;

import jakarta.inject.*;

import org.slf4j.LoggerFactory;

import java.time.*;
import java.util.concurrent.*;

@Singleton
public final class DiscoveryWorker {
    private final DiscoveryDao dao;
    private final DiscoveryPolicy policy;
    private final DomainCrawler crawler;
    private final DiscoveryService service;
    private final Clock clock;
    private final ExecutorService pool;
    private final Semaphore slots;

    @Inject
    public DiscoveryWorker(
            DiscoveryDao dao,
            DiscoveryPolicy policy,
            DomainCrawler crawler,
            DiscoveryService service,
            Clock clock) {
        this.dao = dao;
        this.policy = policy;
        this.crawler = crawler;
        this.service = service;
        this.clock = clock;
        slots = new Semaphore(policy.workers);
        pool =
                Executors.newFixedThreadPool(
                        policy.workers,
                        Thread.ofPlatform().daemon().name("discovery-worker-", 0).factory());
    }

    public void tick() {
        dao.transaction(
                c -> {
                    dao.gate(c);
                    dao.reap(c, clock.instant());
                    return null;
                });
        for (int n = 0; n < policy.workers && slots.tryAcquire(); n++)
            pool.execute(
                    () -> {
                        try {
                            processNext();
                        } catch (Exception e) {
                            LoggerFactory.getLogger(DiscoveryWorker.class)
                                    .warn(
                                            "Discovery worker storage failure type={}",
                                            e.getClass().getSimpleName());
                        } finally {
                            slots.release();
                        }
                    });
    }

    public boolean processNext() {
        var job = dao.claim(policy, clock.instant());
        if (job == null) return false;
        long start = System.nanoTime();
        DomainCrawler.Result result;
        try {
            var input = service.read(job.getParametersJson(), CreateDiscovery.class);
            var limits = service.read(job.getEffectiveLimitsJson(), DiscoveryLimits.class);
            long[] checked = {0};
            boolean[] canceled = {false};
            var budget =
                    new DiscoveryBudget(
                            Duration.ofSeconds(limits.durationSeconds()),
                            () -> {
                                long now = System.nanoTime();
                                if (now - checked[0] > TimeUnit.MILLISECONDS.toNanos(200)) {
                                    canceled[0] = dao.canceled(job, clock.instant());
                                    checked[0] = now;
                                }
                                return canceled[0];
                            });
            result =
                    crawler.crawl(
                            input, limits, budget, page -> dao.page(job, page, clock.instant()));
        } catch (DiscoveryStop e) {
            result = new DomainCrawler.Result(e.code, true);
        } catch (Exception e) {
            result = new DomainCrawler.Result("WORKER_ERROR", true);
        }
        dao.finish(job, result, clock.instant());
        LoggerFactory.getLogger(DiscoveryWorker.class)
                .info(
                        "Discovery finished id={} reason={} elapsedMs={}",
                        job.getId(),
                        result.reason(),
                        TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start));
        return true;
    }
}
