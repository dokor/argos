package com.dokor.argos.services.connected;

import com.dokor.argos.services.account.AccountError;
import com.dokor.argos.services.account.AccountSessionService;

/** Server-only capability obtained inside sessions.with; never a request DTO. */
public final class ConnectedOwner {
    private final long userId;
    private ConnectedOwner(long userId) { this.userId = userId; }
    public long userId() { return userId; }

    public static ConnectedOwner from(AccountSessionService.Context context) {
        if (context == null || context.user() == null || context.session() == null
                || context.user().getId() == null || context.user().getId() <= 0
                || !context.user().getId().equals(context.session().getUserId())) {
            throw AccountError.unauthorized();
        }
        if (!"ACTIVE".equals(context.user().getState())) throw AccountError.forbidden("email_unverified");
        return new ConnectedOwner(context.user().getId());
    }
}
