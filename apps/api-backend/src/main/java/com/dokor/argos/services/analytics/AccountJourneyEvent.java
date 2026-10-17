package com.dokor.argos.services.analytics;

/** Server business outcomes only. Premium names remain reserved, without a collector. */
public enum AccountJourneyEvent {
    REGISTERED("account_registered"),
    AUTHENTICATED("account_authenticated"),
    CLAIMED("report_claimed"),
    ACTIVATED("account_activated"),
    ACTIVITY("account_activity");

    private final String name;

    AccountJourneyEvent(String name) { this.name = name; }
    public String eventName() { return name; }
}
