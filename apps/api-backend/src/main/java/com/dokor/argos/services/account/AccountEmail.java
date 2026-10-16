package com.dokor.argos.services.account;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Transactional copy and email-safe rendering. No remote assets or tracking. */
public final class AccountEmail {
    private AccountEmail() {}

    public enum Kind { VERIFY, RESET, REAUTH, PASSWORD_CHANGED, METHOD_ADDED, METHOD_REMOVED }

    public record Message(String subject, String preview, String text, String html) {}

    public static Message render(Kind kind, String language, String origin, String token, Duration ttl) {
        boolean en = "en".equals(language);
        String lang = en ? "en" : "fr";
        String title;
        String intro;
        String action;
        String safety;
        String path = origin + (en ? "/en" : "") + "/account";
        boolean challenge = kind == Kind.VERIFY || kind == Kind.RESET || kind == Kind.REAUTH;
        switch (kind) {
            case VERIFY -> {
                title = en ? "Confirm your email address" : "Confirmez votre adresse e-mail";
                intro = en ? "Welcome to Argos. Confirm this address to access your analyses and follow your sites."
                        : "Bienvenue sur Argos. Confirmez cette adresse pour accéder à vos analyses et suivre vos sites.";
                action = en ? "Confirm my email address" : "Confirmer mon adresse e-mail";
                safety = en ? "If you did not request this, ignore this email. The address will not be verified through this link without your confirmation."
                        : "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail. L’adresse ne sera pas vérifiée par ce lien sans votre confirmation.";
                path += "/verify#token=" + token;
            }
            case RESET -> {
                title = en ? "Reset your password" : "Réinitialisez votre mot de passe";
                intro = en ? "A password reset was requested for your Argos account. Open the secure page to choose a new password."
                        : "Une réinitialisation a été demandée pour votre compte Argos. Ouvrez la page sécurisée pour choisir un nouveau mot de passe.";
                action = en ? "Choose a new password" : "Choisir un nouveau mot de passe";
                safety = en ? "If you did not request this, ignore this email. Your current password stays unchanged. Never share this link."
                        : "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail. Votre mot de passe actuel reste inchangé. Ne partagez jamais ce lien.";
                path += "/reset#token=" + token;
            }
            case REAUTH -> {
                title = en ? "Confirm your identity" : "Confirmez votre identité";
                intro = en ? "Enter this code in the Argos account window where you requested it to confirm a sensitive action."
                        : "Saisissez ce code dans la fenêtre de votre compte Argos où vous l’avez demandé pour confirmer une action sensible.";
                action = null;
                safety = en ? "If you did not request this code, do not use or share it. Check your sessions from your account and contact the operator if needed."
                        : "Si vous n’avez pas demandé ce code, ne l’utilisez pas et ne le partagez pas. Vérifiez vos sessions depuis votre compte et contactez l’opérateur si nécessaire.";
            }
            case PASSWORD_CHANGED -> {
                title = en ? "Your password has changed" : "Votre mot de passe a été modifié";
                intro = en ? "The password for your Argos account has been set or changed."
                        : "Le mot de passe de votre compte Argos a été défini ou modifié.";
                action = en ? "Review my account security" : "Vérifier la sécurité de mon compte";
                safety = en ? "If you do not recognise this change, reset your password from the sign-in page and contact the operator."
                        : "Si vous ne reconnaissez pas ce changement, réinitialisez votre mot de passe depuis la page de connexion et contactez l’opérateur.";
                path += "/settings";
            }
            case METHOD_ADDED, METHOD_REMOVED -> {
                boolean added = kind == Kind.METHOD_ADDED;
                title = en ? (added ? "A sign-in method was added" : "A sign-in method was removed")
                        : (added ? "Un moyen de connexion a été ajouté" : "Un moyen de connexion a été retiré");
                intro = en ? (added ? "A new sign-in method is now linked to your Argos account." : "A sign-in method has been disabled on your Argos account.")
                        : (added ? "Un nouveau moyen de connexion est désormais associé à votre compte Argos." : "Un moyen de connexion a été désactivé sur votre compte Argos.");
                action = en ? "Review my sign-in methods" : "Vérifier mes moyens de connexion";
                safety = en ? "If you do not recognise this change, sign in using a method you trust, revoke other sessions and contact the operator."
                        : "Si vous ne reconnaissez pas ce changement, connectez-vous avec un moyen de confiance, révoquez les autres sessions et contactez l’opérateur.";
                path += "/settings";
            }
            default -> throw new IllegalArgumentException("Unknown account email");
        }
        String validity = challenge
                ? (en ? "Valid for " : "Valable pendant ") + duration(ttl, en) + ". "
                    + (en ? "Single use. A new request invalidates the previous link or code."
                          : "À usage unique. Une nouvelle demande invalide le lien ou code précédent.")
                : (en ? "This is a security notification. No confirmation is required."
                      : "Ceci est une notification de sécurité. Aucune confirmation n’est nécessaire.");
        String explicit = kind == Kind.VERIFY || kind == Kind.RESET
                ? (en ? "Opening the link does not confirm anything: complete the action on the Argos page."
                      : "Ouvrir le lien ne confirme rien : terminez l’action sur la page Argos.") : "";
        String preview = intro;
        String privacy = origin + (en ? "/en/privacy" : "/confidentialite");
        String contact = origin + (en ? "/en/legal-information" : "/informations-legales");
        String footer = en ? "Account email sent by Argos. Never share a password, link or confirmation code."
                : "E-mail de compte envoyé par Argos. Ne partagez jamais de mot de passe, lien ou code de confirmation.";
        String text = title + "\n\n" + intro + "\n\n"
                + (kind == Kind.REAUTH ? (en ? "Confirmation code: " : "Code de confirmation : ") + token + "\n\n" : "")
                + validity + "\n" + explicit + "\n\n" + safety + "\n\n"
                + (action == null ? "" : action + "\n" + path + "\n\n")
                + footer + "\n" + (en ? "Privacy: " : "Confidentialité : ") + privacy + "\n"
                + (en ? "Contact the operator: " : "Contacter l’opérateur : ") + contact + "\n";
        String content = "<h1 style=\"margin:0 0 20px;font-size:28px;line-height:1.25;font-weight:700\">" + escape(title) + "</h1>"
                + paragraph(intro)
                + (kind == Kind.REAUTH ? "<p class=\"code\" style=\"margin:24px 0;padding:16px;background:#f6f7fb;border:1px solid #dfe5ee;border-radius:9px;font-family:Consolas,monospace;font-size:18px;line-height:1.6;word-break:break-all;overflow-wrap:anywhere\">" + escape(token) + "</p>" : "")
                + paragraph(validity) + (explicit.isEmpty() ? "" : paragraph(explicit))
                + (action == null ? "" : "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0\"><tr><td bgcolor=\"#5045dd\" style=\"border-radius:9px;mso-padding-alt:14px 20px\"><a href=\"" + escape(path) + "\" style=\"display:inline-block;padding:14px 20px;color:#ffffff;background:#5045dd;border-radius:9px;font-size:16px;font-weight:600;line-height:1.5;text-decoration:none\">" + escape(action) + "</a></td></tr></table>")
                + "<div style=\"margin-top:24px;padding-top:24px;border-top:1px solid #dfe5ee\">" + paragraph(safety) + "</div>"
                + (action == null ? "" : "<p style=\"margin:20px 0 8px;font-size:14px\">" + (en ? "If the button does not work, copy this address:" : "Si le bouton ne fonctionne pas, copiez cette adresse :")
                    + "</p><p style=\"margin:0;word-break:break-all;overflow-wrap:anywhere;font-size:14px\"><a class=\"link\" style=\"color:#5045dd;text-decoration:underline\" href=\"" + escape(path) + "\">" + escape(path) + "</a></p>");
        String html = """
                <!doctype html>
                <html lang="%s"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>%s</title>
                <style>
                a:focus-visible{outline:3px solid #5045dd;outline-offset:4px}
                @media(max-width:480px){.body-cell{padding:24px 18px!important}.outer{padding:16px 8px!important}}
                @media(prefers-color-scheme:dark){.canvas{background:#101624!important}.surface{background:#192233!important;color:#e6edf8!important}.surface,.surface td,.surface div{border-color:#334159!important}.muted{color:#a8b5cb!important}.link{color:#b6b0ff!important}.code{background:#101624!important;border-color:#334159!important}}
                </style></head>
                <body class="canvas" style="margin:0;background:#f6f7fb;color:#172239;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65">
                <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">%s</div>
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr><td class="outer" align="center" style="padding:32px 16px">
                <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
                <table role="presentation" class="surface" width="100%%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #dfe5ee;border-radius:9px;color:#172239;text-align:left">
                <tr><td style="padding:20px 24px;border-bottom:1px solid #dfe5ee;font-size:22px;font-weight:700">Argos <span class="muted" style="font-size:14px;font-weight:400;color:#58677d">/ %s</span></td></tr>
                <tr><td class="body-cell" style="padding:32px 24px">%s</td></tr>
                <tr><td class="muted" style="padding:20px 24px;border-top:1px solid #dfe5ee;color:#58677d;font-size:14px">%s<br>
                <a class="link" href="%s" style="display:inline-block;padding:10px 0;color:#5045dd;text-decoration:underline">%s</a> · <a class="link" href="%s" style="display:inline-block;padding:10px 0;color:#5045dd;text-decoration:underline">%s</a></td></tr>
                </table><!--[if mso]></td></tr></table><![endif]-->
                </td></tr></table></body></html>
                """.formatted(lang, escape(title), escape(preview), en ? "Your account" : "Votre compte", content,
                    escape(footer), privacy, en ? "Privacy" : "Confidentialité", contact, en ? "Contact" : "Contact");
        return new Message("Argos — " + title, preview, text, html);
    }

    private static String paragraph(String text) {
        return "<p style=\"margin:0 0 16px\">" + escape(text) + "</p>";
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    static String duration(Duration duration, boolean en) {
        if (duration == null || duration.isNegative() || duration.isZero())
            throw new IllegalArgumentException("Positive token lifetime required");
        long seconds = duration.getSeconds();
        List<String> parts = new ArrayList<>();
        long[] sizes = {86400, 3600, 60, 1};
        String[] units = en ? new String[]{"day", "hour", "minute", "second"}
                : new String[]{"jour", "heure", "minute", "seconde"};
        for (int i = 0; i < sizes.length; i++) {
            long count = seconds / sizes[i];
            seconds %= sizes[i];
            if (count > 0) parts.add(count + " " + units[i] + (count > 1 ? "s" : ""));
        }
        if (duration.getNano() > 0) parts.add((duration.getNano() / 1_000_000.0) + " ms");
        return String.join(en ? " and " : " et ", parts);
    }
}
