package com.dokor.argos.services.analytics;

import com.dokor.argos.db.generated.AccountSession;
import com.dokor.argos.db.generated.AccountUser;
import com.dokor.argos.services.account.*;
import com.dokor.argos.services.token.TokenService;
import com.dokor.argos.webservices.api.account.AccountAuthWs;
import jakarta.inject.Provider;
import jakarta.ws.rs.container.ContainerRequestContext;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountJourneyWsTest {
    private final AccountAuthService auth = mock(AccountAuthService.class);
    private final AccountOAuthService oauth = mock(AccountOAuthService.class);
    private final AccountJourneyService journey = mock(AccountJourneyService.class);
    private final ContainerRequestContext request = mock(ContainerRequestContext.class);
    private AccountAuthWs ws;

    @BeforeEach void prepare() throws Exception {
        var csrf = mock(AccountCsrf.class);
        when(csrf.require(request)).thenReturn("csrf");
        when(request.getHeaderString("Accept-Language")).thenReturn("en");
        when(request.getHeaderString("X-Argos-Measurement")).thenReturn("Bearer server");
        when(request.getHeaderString("X-Argos-OAuth-Browser")).thenReturn("browser");
        when(request.getCookies()).thenReturn(Map.of());
        ws = new AccountAuthWs(auth, mock(AccountSessionService.class), oauth, csrf,
                mock(AccountRateLimiter.class), mock(TokenService.class), mock(AccountSettings.class), journey);
        var requests = AccountAuthWs.class.getDeclaredField("requests"); requests.setAccessible(true);
        requests.set(ws, (Provider<ContainerRequestContext>) () -> request);
        var nativeRequests = AccountAuthWs.class.getDeclaredField("nativeRequests"); nativeRequests.setAccessible(true);
        nativeRequests.set(ws, (Provider<org.glassfish.grizzly.http.server.Request>) () -> null);
    }

    @Test void actualRegistrationIsMeasuredWithoutExposingItsInternalReference() {
        when(auth.register("new@example.test", "secret", "Example", "en")).thenReturn(101L);
        var response = ws.register(new AccountAuthWs.Registration("new@example.test", "secret", "Example"));
        assertEquals(Map.of("accepted", true), response.getEntity());
        verify(journey).record(AccountJourneyEvent.REGISTERED, 101L, 101L, "password", "en", "Bearer server");
    }

    @Test void failedLoginProducesNoSuccessEvent() {
        when(auth.login("new@example.test", "wrong", "csrf")).thenThrow(AccountError.unauthorized());
        assertThrows(AccountError.class, () -> ws.login(new AccountAuthWs.Login("new@example.test", "wrong")));
        verifyNoInteractions(journey);
    }

    @Test void successfulClassicLoginUsesTheVerifiedBusinessContext() {
        var user = new AccountUser(); user.setId(101L); user.setState("ACTIVE"); user.setRole("USER");
        var session = new AccountSession(); session.setId(202L);
        when(auth.login("new@example.test", "secret", "csrf")).thenReturn(
                new AccountSessionService.Issued("jwt", new AccountSessionService.Context(user, session)));
        ws.login(new AccountAuthWs.Login("new@example.test", "secret"));
        verify(journey).authenticated(202L, 101L, "password", "en", "Bearer server");
    }

    @Test void socialCreationAndReturningLoginAreDifferentFromMethodLinking() {
        when(oauth.finish("google", "state", "browser", "code", null, null, "en"))
                .thenReturn(new AccountOAuthService.Finish("jwt", "/account", 101L, 202L, true));
        ws.callback("google", "state", "code");
        verify(journey).record(AccountJourneyEvent.REGISTERED, 101L, 101L, "google", "en", "Bearer server");
        verify(journey).authenticated(202L, 101L, "google", "en", "Bearer server");
        clearInvocations(journey);
        when(oauth.finish("google", "state", "browser", "code", null, null, "en"))
                .thenReturn(new AccountOAuthService.Finish("jwt", "/account", 101L, 203L, false));
        ws.callback("google", "state", "code");
        verify(journey).authenticated(203L, 101L, "google", "en", "Bearer server");
        verifyNoMoreInteractions(journey);
        clearInvocations(journey);
        when(oauth.finish("google", "state", "browser", "code", null, null, "en"))
                .thenReturn(new AccountOAuthService.Finish(null, "/account/settings", null, null, false));
        ws.callback("google", "state", "code");
        verifyNoInteractions(journey);
    }
}
