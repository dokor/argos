package com.dokor.argos.services.connected.discovery;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class DiscoveryRobotsTest {
    @Test
    void emptyDisallowEndsAnExplicitGroup() {
        var r =
                DiscoveryRobots.parse(
                        "User-agent: ArgosDiscovery\nDisallow:\nUser-agent: *\nDisallow: /\n",
                        100,
                        5);
        assertTrue(r.allows("https://example.com/a"));
    }

    @Test
    void mergesExactGroupsAndAllowWinsEqualMatch() {
        var r =
                DiscoveryRobots.parse(
                        "User-agent: *\n"
                            + "Disallow: /\n"
                            + "User-agent: ArgosDiscovery\n"
                            + "Disallow: /a\n"
                            + "User-agent: ARGOSDISCOVERY\n"
                            + "Allow: /a\n"
                            + "Disallow: /b\n",
                        100,
                        5);
        assertTrue(r.allows("https://example.com/a"));
        assertTrue(r.allows("https://example.com/else"));
        assertFalse(r.allows("https://example.com/b"));
    }

    @Test
    void wildcardEndAnchorAndPercentOctets() {
        var r =
                DiscoveryRobots.parse(
                        "User-agent: *\n"
                            + "Disallow: /*.pdf$\n"
                            + "Disallow: /caf%C3%A9\n"
                            + "Disallow: /private\n",
                        100, 5);
        assertFalse(r.allows("https://example.com/a.pdf"));
        assertTrue(r.allows("https://example.com/a.pdf?q=1"));
        assertFalse(r.allows("https://example.com/café"));
        assertFalse(r.allows("https://example.com/%70rivate"));
    }

    @Test
    void boundedRulesFailClosed() {
        assertThrows(
                DiscoveryStop.class,
                () -> DiscoveryRobots.parse("User-agent: *\nDisallow: /a\nDisallow: /b\n", 1, 5));
    }
}
