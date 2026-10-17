package com.dokor.argos.services.account;

import static org.junit.jupiter.api.Assertions.*;

import com.typesafe.config.ConfigFactory;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.Test;

import java.io.*;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.*;

/** Exercises the production adapter against an isolated SMTP peer, without external delivery. */
class SmtpAccountMailTest {
    @Test
    void smtpDeliversBothUtf8AlternativesWithTheConfiguredEnvelope() throws Exception {
        for (String language : new String[]{"fr", "en"}) {
            try (var server = new SmtpPeer(false)) {
                var message = AccountEmail.render(AccountEmail.Kind.VERIFY, language,
                        "https://argos.example", "synthetic-token", Duration.ofHours(24));
                new SmtpAccountMail(server.settings(false)).send("reader@example.invalid", message);
                var delivery = server.delivery();
                assertEquals("MAIL FROM:<sender@example.invalid>", delivery.sender());
                assertEquals("RCPT TO:<reader@example.invalid>", delivery.recipient());
                var mime = new MimeMessage(Session.getInstance(new Properties()),
                        new ByteArrayInputStream(delivery.data().getBytes(StandardCharsets.US_ASCII)));
                assertEquals("sender@example.invalid", mime.getFrom()[0].toString());
                assertEquals("reader@example.invalid", mime.getAllRecipients()[0].toString());
                assertEquals(message.subject(), mime.getSubject());
                assertNotNull(mime.getSentDate());
                assertNotNull(mime.getMessageID());
                assertTrue(mime.isMimeType("multipart/alternative"));
                var parts = (MimeMultipart) mime.getContent();
                assertEquals(2, parts.getCount());
                assertTrue(parts.getBodyPart(0).isMimeType("text/plain"));
                assertTrue(parts.getBodyPart(1).isMimeType("text/html"));
                assertEquals(message.text(), normalise(parts.getBodyPart(0).getContent()));
                assertEquals(message.html(), normalise(parts.getBodyPart(1).getContent()));
            }
        }
    }

    @Test
    void requiredStartTlsRefusesToSendContentToAPeerWithoutTls() throws Exception {
        try (var server = new SmtpPeer(false)) {
            assertThrows(AccountError.class, () -> new SmtpAccountMail(server.settings(true))
                    .send("reader@example.invalid", sample()));
            var delivery = server.delivery();
            assertNull(delivery.sender());
            assertNull(delivery.recipient());
            assertEquals("", delivery.data());
        }
    }

    @Test
    void serverRejectionIsReportedAsMailUnavailable() throws Exception {
        try (var server = new SmtpPeer(true)) {
            var failure = assertThrows(AccountError.class, () -> new SmtpAccountMail(server.settings(false))
                    .send("reader@example.invalid", sample()));
            assertEquals(503, failure.getResponse().getStatus());
            assertEquals(Map.of("error", "mail_unavailable"), failure.getResponse().getEntity());
            assertFalse(server.delivery().data().isBlank());
        }
    }

    private static AccountEmail.Message sample() {
        return AccountEmail.render(AccountEmail.Kind.RESET, "fr", "https://argos.example",
                "synthetic-token", Duration.ofMinutes(30));
    }

    private static String normalise(Object value) {
        return value.toString().replace("\r\n", "\n");
    }

    private record Delivery(String sender, String recipient, String data) {}

    /** Minimal, one-connection SMTP peer: loopback only, no AUTH, no TLS, no relay. */
    private static final class SmtpPeer implements AutoCloseable {
        private final ServerSocket listener;
        private final ExecutorService executor = Executors.newSingleThreadExecutor();
        private final Future<Delivery> result;

        SmtpPeer(boolean reject) throws IOException {
            listener = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
            listener.setSoTimeout(5000);
            result = executor.submit(() -> {
                try (var socket = listener.accept()) {
                    socket.setSoTimeout(5000);
                    var input = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
                    var output = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.US_ASCII));
                    reply(output, "220 localhost test SMTP");
                    String sender = null;
                    String recipient = null;
                    StringBuilder data = new StringBuilder();
                    for (String line; (line = input.readLine()) != null;) {
                        if (line.startsWith("EHLO ") || line.startsWith("HELO ")) {
                            reply(output, "250 localhost");
                        } else if (line.startsWith("MAIL FROM:")) {
                            sender = line;
                            reply(output, "250 OK");
                        } else if (line.startsWith("RCPT TO:")) {
                            recipient = line;
                            reply(output, "250 OK");
                        } else if (line.equals("DATA")) {
                            reply(output, "354 End with dot");
                            while ((line = input.readLine()) != null && !line.equals(".")) {
                                data.append(line.startsWith("..") ? line.substring(1) : line).append("\r\n");
                            }
                            reply(output, reject ? "554 Test rejection" : "250 Accepted");
                        } else if (line.equals("QUIT")) {
                            reply(output, "221 Bye");
                            break;
                        } else {
                            reply(output, "250 OK");
                        }
                    }
                    return new Delivery(sender, recipient, data.toString());
                }
            });
        }

        AccountSettings settings(boolean requireTls) {
            return new AccountSettings(ConfigFactory.parseMap(Map.of(
                    "account.smtp.host", "127.0.0.1",
                    "account.smtp.port", Integer.toString(listener.getLocalPort()),
                    "account.smtp.from", "sender@example.invalid",
                    "account.smtp.require-tls", Boolean.toString(requireTls))));
        }

        Delivery delivery() throws Exception {
            return result.get(6, TimeUnit.SECONDS);
        }

        private static void reply(BufferedWriter output, String line) throws IOException {
            output.write(line + "\r\n");
            output.flush();
        }

        @Override
        public void close() throws IOException {
            listener.close();
            executor.shutdownNow();
        }
    }
}
