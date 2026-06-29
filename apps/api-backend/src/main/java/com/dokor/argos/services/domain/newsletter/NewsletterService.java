package com.dokor.argos.services.domain.newsletter;

import com.dokor.argos.db.dao.NewsletterDao;
import com.dokor.argos.db.generated.NewsletterSubscriber;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.regex.Pattern;

@Singleton
public class NewsletterService {

    private static final Logger logger = LoggerFactory.getLogger(NewsletterService.class);

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$"
    );

    private final NewsletterDao newsletterDao;

    @Inject
    public NewsletterService(NewsletterDao newsletterDao) {
        this.newsletterDao = newsletterDao;
    }

    public enum SubscribeResult {
        SUBSCRIBED,
        ALREADY_SUBSCRIBED,
        INVALID_EMAIL
    }

    /**
     * Inscrit un email à la newsletter.
     *
     * @param email   l'adresse email à inscrire
     * @param ipHint  IP du client (optionnel, à des fins d'audit)
     * @return le résultat de l'inscription
     */
    public SubscribeResult subscribe(String email, String ipHint) {
        if (email == null || email.isBlank()) {
            return SubscribeResult.INVALID_EMAIL;
        }

        String normalizedEmail = email.trim().toLowerCase();

        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            logger.warn("Newsletter subscribe: invalid email={}", normalizedEmail);
            return SubscribeResult.INVALID_EMAIL;
        }

        if (newsletterDao.existsByEmail(normalizedEmail)) {
            logger.info("Newsletter subscribe: already subscribed email={}", normalizedEmail);
            return SubscribeResult.ALREADY_SUBSCRIBED;
        }

        NewsletterSubscriber subscriber = new NewsletterSubscriber();
        subscriber.setEmail(normalizedEmail);
        subscriber.setCreatedAt(Instant.now());
        subscriber.setIpHint(ipHint);
        newsletterDao.save(subscriber);

        logger.info("Newsletter subscribe: new subscriber email={}", normalizedEmail);
        return SubscribeResult.SUBSCRIBED;
    }
}
