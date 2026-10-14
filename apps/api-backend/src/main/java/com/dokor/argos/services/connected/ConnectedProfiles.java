package com.dokor.argos.services.connected;

import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.analysis.scoring.ScorePolicy;
import com.dokor.argos.services.connected.contract.ConnectedContracts.*;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.util.List;

/** The existing pipeline has one execution policy, not selectable mobile/desktop profiles. */
@Singleton
public final class ConnectedProfiles {
    public static final String DEFAULT_ID = "server-default-v1";
    private final ScorePolicy policy;
    @Inject public ConnectedProfiles(ScorePolicy policy) { this.policy = policy; }

    public AnalysisProfiles catalogue() {
        return new AnalysisProfiles(DEFAULT_ID, List.of(new AnalysisProfile(DEFAULT_ID,
                "analysisProfiles.serverDefault", snapshot(DEFAULT_ID))));
    }

    public ProfileSnapshot snapshot(String profileId) {
        if (!DEFAULT_ID.equals(profileId)) throw new AccountError(400, "unsupported_profile");
        return new ProfileSnapshot(DEFAULT_ID, 1L, "COLLECTOR_DEFAULTS", (long) policy.version(), policy.fingerprint());
    }
}
