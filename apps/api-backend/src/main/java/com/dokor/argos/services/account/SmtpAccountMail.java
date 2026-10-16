package com.dokor.argos.services.account;

import jakarta.inject.*;
import jakarta.mail.*;
import jakarta.mail.internet.*;

import java.util.Properties;

/**
 * plume-mail 2 beta resolves javax.mail; Jakarta adapter avoids importing that obsolete runtime.
 */
@Singleton
public class SmtpAccountMail implements AccountMail {
    private final AccountSettings settings;

    @Inject
    public SmtpAccountMail(AccountSettings settings) {
        this.settings = settings;
    }

    @Override
    public void send(String recipient, AccountEmail.Message message) {
        String host = settings.value("smtp.host", "");
        if (host.isBlank()) throw new AccountError(503, "mail_unavailable");
        try {
            Properties p = new Properties();
            p.put("mail.smtp.host", host);
            p.put("mail.smtp.port", settings.value("smtp.port", "587"));
            p.put("mail.smtp.connectiontimeout", "5000");
            p.put("mail.smtp.timeout", "5000");
            p.put("mail.smtp.writetimeout", "5000");
            p.put("mail.smtp.starttls.enable", "true");
            p.put("mail.smtp.starttls.required", settings.value("smtp.require-tls", "true"));
            p.put("mail.smtp.ssl.checkserveridentity", "true");
            String user = settings.value("smtp.username", "");
            p.put("mail.smtp.auth", Boolean.toString(!user.isBlank()));
            Session session =
                    Session.getInstance(
                            p,
                            user.isBlank()
                                    ? null
                                    : new Authenticator() {
                                        @Override
                                        protected PasswordAuthentication
                                                getPasswordAuthentication() {
                                            return new PasswordAuthentication(
                                                    user, settings.value("smtp.password", ""));
                                        }
                                    });
            session.setDebug(false);
            MimeMessage m = new MimeMessage(session);
            m.setFrom(new InternetAddress(settings.value("smtp.from", "")));
            m.setRecipient(Message.RecipientType.TO, new InternetAddress(recipient));
            applyContent(m, message);
            Transport.send(m);
        } catch (Exception failure) {
            throw new AccountError(503, "mail_unavailable");
        }
    }

    static void applyContent(MimeMessage mime, AccountEmail.Message message) throws MessagingException {
        mime.setSubject(message.subject(), "UTF-8");
        var plain = new MimeBodyPart();
        plain.setText(message.text(), "UTF-8");
        var html = new MimeBodyPart();
        html.setText(message.html(), "UTF-8", "html");
        var alternatives = new MimeMultipart("alternative");
        alternatives.addBodyPart(plain);
        alternatives.addBodyPart(html);
        mime.setContent(alternatives);
    }
}
