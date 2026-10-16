package com.dokor.argos.services.connected.batch;

import com.typesafe.config.Config;
import jakarta.inject.*;

@Singleton
public final class BatchQueuePolicy {
    public final int accountLimit;
    @Inject public BatchQueuePolicy(Config config) {
        String key = "batch.account-queue-limit";
        accountLimit = config.hasPath(key) ? config.getInt(key) : 5;
        if (accountLimit < 1 || accountLimit > 50 ||
                (config.hasPath(key) && config.getDouble(key) != accountLimit))
            throw new IllegalArgumentException("Invalid batch configuration: account-queue-limit");
    }
}
