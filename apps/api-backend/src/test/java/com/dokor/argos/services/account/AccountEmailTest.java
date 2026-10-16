package com.dokor.argos.services.account;

import static org.junit.jupiter.api.Assertions.*;

import com.typesafe.config.ConfigFactory;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.Properties;

class AccountEmailTest {
    private static final String ORIGIN = "https://argos.example";
    private static final String TOKEN = "synthetic_" + "x".repeat(33);

    @Test
    void everyMessageHasLocalisedCopyAndUsableMimeAlternatives() throws Exception {
        for (var kind : AccountEmail.Kind.values()) {
            for (String lang : new String[]{"fr", "en"}) {
                var message = AccountEmail.render(kind, lang, ORIGIN, TOKEN, Duration.ofMinutes(17));
                var doc = Jsoup.parse(message.html());
                assertEquals(lang, doc.selectFirst("html").attr("lang"));
                assertEquals(1, doc.select("h1").size());
                assertEquals(message.preview(), doc.selectFirst("body > div").text());
                assertTrue(message.subject().startsWith("Argos — "));
                assertTrue(message.text().contains(message.subject().substring(8)));
                assertTrue(doc.select("img,script,form").isEmpty());
                for (var link : doc.select("a")) {
                    assertTrue(link.attr("href").startsWith(ORIGIN + "/"));
                    assertTrue(message.text().contains(link.attr("href")));
                }
                if (kind == AccountEmail.Kind.REAUTH) {
                    assertTrue(message.text().contains(TOKEN));
                    assertEquals(TOKEN, doc.selectFirst(".code").text());
                    assertFalse(message.html().contains("#token="));
                } else if (kind == AccountEmail.Kind.VERIFY || kind == AccountEmail.Kind.RESET) {
                    String path = ORIGIN + (lang.equals("en") ? "/en" : "") + "/account/"
                            + (kind == AccountEmail.Kind.VERIFY ? "verify" : "reset") + "#token=" + TOKEN;
                    assertEquals(2, doc.select("a[href='" + path + "']").size());
                    assertTrue(message.text().contains(path));
                    assertTrue(message.text().contains("17 minutes"));
                } else {
                    assertFalse(message.text().contains(TOKEN));
                    assertTrue(message.html().contains("/account/settings"));
                    assertFalse(message.text().contains("17 minutes"));
                }
                var session = Session.getInstance(new Properties());
                var mime = new MimeMessage(session);
                SmtpAccountMail.applyContent(mime, message);
                var bytes = new ByteArrayOutputStream();
                mime.writeTo(bytes);
                var decoded = new MimeMessage(session, new ByteArrayInputStream(bytes.toByteArray()));
                assertEquals(message.subject(), decoded.getSubject());
                assertTrue(decoded.isMimeType("multipart/alternative"));
                var parts = (MimeMultipart) decoded.getContent();
                assertEquals(2, parts.getCount());
                assertTrue(parts.getBodyPart(0).isMimeType("text/plain"));
                assertTrue(parts.getBodyPart(1).isMimeType("text/html"));
                assertEquals(message.text(), parts.getBodyPart(0).getContent().toString().replace("\r\n", "\n"));
                assertTrue(parts.getBodyPart(1).getContent().toString().contains(doc.selectFirst("h1").text()));
            }
        }
    }

    @Test
    void usesConfiguredLifetimeWithoutRoundingOrInventingDefaults() {
        var settings = new AccountSettings(ConfigFactory.parseMap(Map.of(
                "account.token-verify-ttl", "7623 seconds",
                "account.token-reset-ttl", "11 minutes", "account.token-reauth-ttl", "45 seconds")));
        assertTrue(AccountEmail.render(AccountEmail.Kind.VERIFY, "fr", ORIGIN, TOKEN, settings.tokenTtl("VERIFY")).text().contains("2 heures et 7 minutes et 3 secondes"));
        assertTrue(AccountEmail.render(AccountEmail.Kind.RESET, "en", ORIGIN, TOKEN, settings.tokenTtl("RESET")).text().contains("11 minutes"));
        assertTrue(AccountEmail.render(AccountEmail.Kind.REAUTH, "en", ORIGIN, TOKEN, settings.tokenTtl("REAUTH")).text().contains("45 seconds"));
        assertEquals("1 jour", AccountEmail.duration(new AccountSettings(ConfigFactory.empty()).tokenTtl("VERIFY"), false));
    }

    @Test
    void unsupportedLanguagesCannotChangeRoutesAndDynamicHtmlIsEscaped() {
        for (String lang : new String[]{null, "fr", "de", "//external.example", "en/../"}) {
            var message = AccountEmail.render(AccountEmail.Kind.RESET, lang, ORIGIN, "<script>\"&", Duration.ofMinutes(30));
            assertTrue(message.html().contains("lang=\"fr\""));
            assertTrue(message.html().contains(ORIGIN + "/account/reset#token=&lt;script&gt;&quot;&amp;"));
            assertFalse(message.html().contains("<script>"));
        }
    }

    /** Opt-in, synthetic exports only; normal tests never modify the working tree. */
    @Test
    void exportPreviewsWhenRequested() throws Exception {
        String directory = System.getProperty("account.mail.preview.dir");
        if (directory == null) return;
        Path output = Path.of(directory);
        Files.createDirectories(output);
        for (var kind : AccountEmail.Kind.values()) {
            for (String lang : new String[]{"fr", "en"}) {
                var ttl = new AccountSettings(ConfigFactory.empty()).tokenTtl(kind.name());
                var message = AccountEmail.render(kind, lang, ORIGIN, TOKEN, ttl);
                String name = kind.name().toLowerCase(java.util.Locale.ROOT) + "-" + lang;
                Files.writeString(output.resolve(name + ".html"), message.html(), StandardCharsets.UTF_8);
                Files.writeString(output.resolve(name + ".txt"), message.subject() + "\n" + message.text(), StandardCharsets.UTF_8);
                var mime = new MimeMessage(Session.getInstance(new Properties()));
                mime.setFrom("Argos <preview@example.invalid>");
                mime.setRecipients(jakarta.mail.Message.RecipientType.TO, "reader@example.invalid");
                SmtpAccountMail.applyContent(mime, message);
                try (var stream = Files.newOutputStream(output.resolve(name + ".eml"))) { mime.writeTo(stream); }
            }
        }
    }
}
