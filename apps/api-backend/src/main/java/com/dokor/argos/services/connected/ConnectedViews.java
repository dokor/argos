package com.dokor.argos.services.connected;

import com.dokor.argos.services.account.UsageService;
import com.dokor.argos.services.connected.contract.ConnectedContracts.Usage;

/** Adapters reuse the authoritative registry; they do not maintain another quota counter. */
public final class ConnectedViews {
    private ConnectedViews() {}
    public static Usage usage(UsageService.Snapshot value) {
        return new Usage(value.offer(), value.period(), value.timezone(), value.startsAt(), value.resetsAt(),
                value.used(), value.reserved(), value.limit(), value.available(), value.canLaunch());
    }
}
