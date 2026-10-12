package com.dokor.argos.services.account;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.nimbusds.oauth2.sdk.id.*;
import com.nimbusds.openid.connect.sdk.validators.IDTokenValidator;
import com.typesafe.config.ConfigFactory;

import org.junit.jupiter.api.*;

import java.time.*;
import java.util.*;

class AccountCryptoTest {
    @Test
    void plumeJwtRequiresPurposeIssuerAudienceExpiryAndNeverLogsInvalidClaims() {
        var clock = Clock.fixed(Instant.parse("2026-10-11T08:00:00Z"), ZoneOffset.UTC);
        var settings =
                new AccountSettings(
                        ConfigFactory.parseMap(
                                Map.of(
                                        "account.enabled",
                                        true,
                                        "account.jwt-secret",
                                        "s".repeat(64))));
        var signer = new AccountSessionSigner(settings, new ObjectMapper(), clock);
        String valid = signer.issue(1, 2);
        assertNotNull(signer.parseSession(valid, ArgosWebSession.class));
        assertNull(signer.parseSession(valid + "invalid", ArgosWebSession.class));
        for (var wrong :
                List.of(
                        new ArgosWebSession("wrong", "argos-account", "account", 1L, 2L, null),
                        new ArgosWebSession("argos-account", "wrong", "account", 1L, 2L, null),
                        new ArgosWebSession(
                                "argos-account", "argos-account", "admin", 1L, 2L, null))) {
            assertNull(
                    signer.parseSession(
                            signer.serializeSession(
                                    wrong, clock.instant().plusSeconds(60).toEpochMilli()),
                            ArgosWebSession.class));
        }
        assertNull(
                signer.parseSession(
                        signer.serializeSession(
                                new ArgosWebSession(
                                        "argos-account", "argos-account", "account", 1L, 2L, null),
                                null),
                        ArgosWebSession.class));
        assertNull(
                signer.parseSession(
                        signer.serializeSession(
                                new ArgosWebSession(
                                        "argos-account", "argos-account", "account", 1L, 2L, null),
                                clock.millis()),
                        ArgosWebSession.class));
    }

    @Test
    void oidcRejectsWrongSignatureIssuerAudienceNonceAndExpiredTokens() throws Exception {
        RSAKey key = new RSAKeyGenerator(2048).keyID("fixture").generate();
        var validator =
                new IDTokenValidator(
                        new Issuer("https://issuer.example"),
                        new ClientID("fixture-client"),
                        JWSAlgorithm.RS256,
                        new JWKSet(key.toPublicJWK()));
        validator.setMaxClockSkew(0);
        var good =
                new JWTClaimsSet.Builder()
                        .issuer("https://issuer.example")
                        .subject("fixture-sub")
                        .audience("fixture-client")
                        .expirationTime(Date.from(Instant.now().plusSeconds(120)))
                        .issueTime(new Date())
                        .claim("nonce", "fixture-nonce")
                        .build();
        assertNotNull(
                AccountOAuthClient.validateOidc(signed(good, key), validator, "fixture-nonce"));
        for (var bad :
                List.of(
                        new JWTClaimsSet.Builder(good).issuer("https://attacker.example").build(),
                        new JWTClaimsSet.Builder(good).audience("wrong-client").build(),
                        new JWTClaimsSet.Builder(good).claim("nonce", "wrong").build(),
                        new JWTClaimsSet.Builder(good)
                                .expirationTime(Date.from(Instant.now().minusSeconds(10)))
                                .build())) {
            assertThrows(
                    Exception.class,
                    () ->
                            AccountOAuthClient.validateOidc(
                                    signed(bad, key), validator, "fixture-nonce"));
        }
        RSAKey other = new RSAKeyGenerator(2048).keyID("fixture").generate();
        assertThrows(
                Exception.class,
                () ->
                        AccountOAuthClient.validateOidc(
                                signed(good, other), validator, "fixture-nonce"));
    }

    @Test
    void linkedinAcceptsDiscoveryIssuerAndPreservesExistingAccountKeys() throws Exception {
        var provider = AccountOAuthClient.PROVIDERS.get("linkedin");
        RSAKey key = new RSAKeyGenerator(2048).keyID("fixture").generate();
        var validator =
                new IDTokenValidator(
                        new Issuer(provider.issuer()),
                        new ClientID("fixture-client"),
                        JWSAlgorithm.RS256,
                        new JWKSet(key.toPublicJWK()));
        validator.setMaxClockSkew(0);
        // LinkedIn's live discovery document, rather than the outdated documentation example.
        var token =
                new JWTClaimsSet.Builder()
                        .issuer("https://www.linkedin.com/oauth")
                        .subject("linkedin-member")
                        .audience("fixture-client")
                        .expirationTime(Date.from(Instant.now().plusSeconds(120)))
                        .issueTime(new Date())
                        .claim("nonce", "fixture-nonce")
                        .claim("email", "member@example.com")
                        .claim("email_verified", true)
                        .claim("name", "Member")
                        .build();
        var claims = AccountOAuthClient.validateOidc(signed(token, key), validator, "fixture-nonce");
        var identity = AccountOAuthClient.oidcIdentity(provider, claims);
        assertEquals("https://www.linkedin.com|linkedin-member", identity.subject());
        assertEquals("member@example.com", identity.email());
        assertTrue(identity.verified());
        assertEquals("Member", identity.name());
        assertThrows(
                Exception.class,
                () ->
                        AccountOAuthClient.validateOidc(
                                signed(
                                        new JWTClaimsSet.Builder(token)
                                                .issuer("https://www.linkedin.com")
                                                .build(),
                                        key),
                                validator,
                                "fixture-nonce"));
    }

    private SignedJWT signed(JWTClaimsSet claims, RSAKey key) throws Exception {
        var jwt =
                new SignedJWT(
                        new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("fixture").build(), claims);
        jwt.sign(new RSASSASigner(key));
        return jwt;
    }

    @Test
    void passwordsPreservePassphrasesAndUseArgon2idWithDistinctSalts() {
        var p = new AccountPasswords(new AccountSettings(ConfigFactory.empty()));
        String password = "  a long passphrase with spaces  ";
        String a = p.hash(password), b = p.hash(password);
        assertTrue(a.startsWith("$argon2id$"));
        assertNotEquals(a, b);
        assertTrue(p.verify(a, password));
        assertFalse(p.verify(a, password.strip()));
        assertFalse(p.verify(null, password));
        assertThrows(AccountError.class, () -> p.hash("short"));
        assertThrows(AccountError.class, () -> p.hash("x".repeat(129)));
    }
}
