package com.dokor.argos.services.connected;

import com.dokor.argos.services.account.UsageService;
import com.dokor.argos.services.connected.contract.ConnectedContracts.Usage;

/** Adapters reuse the authoritative registry; they do not maintain another quota counter. */
public final class ConnectedViews {
    private ConnectedViews() {}
    public static Usage usage(UsageService.Snapshot value) {
        Long available = value.limit() == null ? null
                : value.used() >= value.limit() ? 0L : Math.max(0L, value.limit() - value.used() - value.reserved());
        return new Usage(value.offer(), value.period(), value.timezone(), value.startsAt(), value.resetsAt(),
                value.used(), value.reserved(), value.limit(), available, value.canLaunch());
    }
}
