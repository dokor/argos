package com.dokor.argos.services.analysis;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandler;
import java.net.http.HttpResponse.BodySubscribers;
import java.nio.charset.StandardCharsets;

/**
 * Fabrique de {@link BodyHandler} lisant le corps d'une réponse HTTP <b>en bornant la
 * taille lue</b> (#220).
 * <p>
 * Les services d'analyse consomment des réponses externes non maîtrisées (LHR Lighthouse
 * de plusieurs Mo, page auditée arbitraire, API tierces). Lire ces corps sans limite via
 * {@code BodyHandlers.ofString()} expose le backend — déployé sur Raspberry Pi à mémoire
 * réduite — à un OOM déterministe (payload volumineux ou serveur malveillant).
 * <p>
 * Au-delà de la capacité, la lecture est interrompue et une {@link UncheckedIOException}
 * est levée : l'appel {@code HttpClient.send} propage l'erreur et l'appelant traite alors
 * l'échec comme une indisponibilité de module (mode dégradé existant).
 */
public final class BoundedBodyHandlers {

    /** Plafond pour les réponses JSON volumineuses (LHR Lighthouse). */
    public static final long MAX_JSON_BYTES = 25L * 1024 * 1024; // 25 Mo

    /** Plafond pour les pages HTML auditées et les ressources SEO (robots.txt/sitemap.xml). */
    public static final long MAX_PAGE_BYTES = 5L * 1024 * 1024; // 5 Mo

    private static final int READ_CHUNK = 8192;

    private BoundedBodyHandlers() {
    }

    /**
     * {@link BodyHandler} String (UTF-8) borné à {@code maxBytes}. Le corps est lu en flux
     * et la lecture est interrompue dès que la limite est franchie.
     *
     * @param maxBytes taille maximale du corps lu, en octets
     */
    public static BodyHandler<String> ofString(long maxBytes) {
        return responseInfo -> BodySubscribers.mapping(
            BodySubscribers.ofInputStream(),
            stream -> readLimited(stream, maxBytes)
        );
    }

    /**
     * Lit intégralement {@code stream} en UTF-8 tant que la taille reste ≤ {@code maxBytes} ;
     * lève une {@link UncheckedIOException} si la limite est dépassée. Ferme toujours le flux.
     */
    static String readLimited(InputStream stream, long maxBytes) {
        try (InputStream in = stream) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[READ_CHUNK];
            long total = 0;
            int read;
            while ((read = in.read(chunk)) != -1) {
                total += read;
                if (total > maxBytes) {
                    throw new UncheckedIOException(new IOException(
                        "Response body exceeds maximum allowed size (" + maxBytes + " bytes)"));
                }
                buffer.write(chunk, 0, read);
            }
            return buffer.toString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
