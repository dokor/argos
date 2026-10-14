package com.dokor.argos.services.connected.discovery;

/** Only controlled codes cross the worker boundary; never upstream URLs or bodies. */
public final class DiscoveryStop extends RuntimeException {
    public final String code;

    public DiscoveryStop(String code) {
        super(code);
        this.code = code;
    }
}
