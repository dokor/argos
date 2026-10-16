package com.dokor.argos.services.domain.premium;

import com.dokor.argos.db.dao.PremiumWaitlistDao;
import com.dokor.argos.db.generated.PremiumWaitlistEntry;
import jakarta.inject.*;
import java.time.*;
import java.util.Locale;
import java.util.regex.Pattern;

@Singleton
public class PremiumWaitlistService {
    public static final String CONSENT_VERSION = "premium-2026-10-16";
    private static final Pattern EMAIL = Pattern.compile("^[a-zA-Z0-9_%+\\-]+(?:[.][a-zA-Z0-9_%+\\-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?[.])+[a-zA-Z]{2,63}$");
    private final PremiumWaitlistDao dao;
    private final Clock clock;
    @Inject public PremiumWaitlistService(PremiumWaitlistDao dao, Clock clock) { this.dao = dao; this.clock = clock; }
    public boolean subscribe(String email, Boolean consent, String locale) {
        if (!Boolean.TRUE.equals(consent) || email == null || email.length() > 255 || !("fr".equals(locale) || "en".equals(locale))) return false;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 254 || !EMAIL.matcher(normalized).matches() || normalized.indexOf('@') > 64) return false;
        var now = clock.instant();
        var entry = new PremiumWaitlistEntry();
        entry.setEmail(normalized); entry.setLocale(locale); entry.setConsentVersion(CONSENT_VERSION);
        entry.setCreatedAt(now); entry.setExpiresAt(now.atZone(ZoneOffset.UTC).plusMonths(12).toInstant());
        dao.subscribeIfAbsent(entry);
        return true;
    }
    public void purge() { dao.purgeExpired(clock.instant()); }
}
