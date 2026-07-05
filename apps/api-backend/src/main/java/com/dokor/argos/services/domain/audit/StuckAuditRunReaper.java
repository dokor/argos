package com.dokor.argos.services.domain.audit;

import com.dokor.argos.db.dao.AuditRunDao;
import com.dokor.argos.db.generated.AuditRun;
import com.dokor.argos.services.configuration.ConfigurationService;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Détecte et traite les runs d'audit restés bloqués en {@code RUNNING} après une
 * coupure réseau/électrique, un redémarrage du Raspberry ou un arrêt brutal d'un
 * worker (issues #127 et #211).
 *
 * <p>Un run est considéré comme bloqué s'il est en {@code RUNNING} depuis plus que
 * {@code audit.scheduler.stuck-timeout} (mesuré depuis {@code started_at}). Le
 * traitement normal d'un audit étant synchrone et court (~20 s), un seuil de 20 min
 * garantit que le worker est réellement mort/figé et non en cours de travail — ce qui
 * prévient les doubles traitements.
 *
 * <p>Pour chaque run bloqué :
 * <ul>
 *   <li><b>récupérable</b> ({@code attempt_count < max-attempts}) → remis en file
 *       ({@code QUEUED}) et re-traité au prochain tick du scheduler ;</li>
 *   <li><b>non récupérable</b> (tentatives épuisées) → marqué {@code FAILED} avec un
 *       message d'erreur exploitable (abandon volontaire, #211).</li>
 * </ul>
 *
 * <p>Les deux opérations passent par des updates atomiques gardés
 * ({@code WHERE status = 'RUNNING'}) : aucun run terminé entre-temps ni re-claimé
 * n'est écrasé, et deux reprises concurrentes ne peuvent aboutir.
 */
@Singleton
public class StuckAuditRunReaper {

    private static final Logger logger = LoggerFactory.getLogger(StuckAuditRunReaper.class);

    private final AuditRunDao auditRunDao;
    private final AuditRunService auditRunService;
    private final ConfigurationService configurationService;

    @Inject
    public StuckAuditRunReaper(
        AuditRunDao auditRunDao,
        AuditRunService auditRunService,
        ConfigurationService configurationService
    ) {
        this.auditRunDao = auditRunDao;
        this.auditRunService = auditRunService;
        this.configurationService = configurationService;
    }

    /**
     * Balaye les runs bloqués et les relance ou les abandonne selon leur nombre de
     * tentatives. Idempotent et sans effet si aucun run n'est bloqué.
     *
     * @return le nombre de runs effectivement traités (relancés ou abandonnés)
     */
    public int reapStuckRuns() {
        Duration timeout = configurationService.auditStuckRunTimeout();
        int maxAttempts = configurationService.auditMaxAttempts();
        Instant threshold = Instant.now().minus(timeout);

        List<AuditRun> stuckRuns = auditRunDao.findStuckRunningRuns(threshold);
        if (stuckRuns.isEmpty()) {
            logger.debug("No stuck audit run found (timeout={})", timeout);
            return 0;
        }

        logger.warn("Detected {} stuck audit run(s) in RUNNING for more than {}", stuckRuns.size(), timeout);

        int handled = 0;
        for (AuditRun run : stuckRuns) {
            if (handleStuckRun(run, maxAttempts, timeout)) {
                handled++;
            }
        }
        return handled;
    }

    private boolean handleStuckRun(AuditRun run, int maxAttempts, Duration timeout) {
        long runId = run.getId();
        int attempts = run.getAttemptCount() == null ? 0 : run.getAttemptCount();

        if (attempts < maxAttempts) {
            return requeue(runId, attempts, maxAttempts);
        }
        return abandon(runId, attempts, timeout);
    }

    private boolean requeue(long runId, int attempts, int maxAttempts) {
        boolean requeued = auditRunDao.requeueStuckRun(runId);
        if (!requeued) {
            // Le run a été terminé ou re-claimé entre la détection et l'update : rien à faire.
            logger.debug("Stuck run no longer in RUNNING, skipped requeue runId={}", runId);
            return false;
        }
        // Repart d'un état propre pour le nouveau traitement complet.
        auditRunService.resetModuleStatuses(runId);
        logger.warn("Stuck run requeued for retry runId={} attempts={}/{}", runId, attempts, maxAttempts);
        return true;
    }

    private boolean abandon(long runId, int attempts, Duration timeout) {
        String message = "Analyse abandonnée : bloquée en RUNNING plus de " + timeout
            + " après " + attempts + " tentative(s) (interruption probable du worker).";
        boolean failed = auditRunDao.markStuckFailed(runId, Instant.now(), message);
        if (!failed) {
            logger.debug("Stuck run no longer in RUNNING, skipped abandon runId={}", runId);
            return false;
        }
        // Évite un spinner infini côté rapport en clôturant les modules encore RUNNING.
        auditRunService.failRunningModules(runId);
        logger.error("Stuck run abandoned as FAILED runId={} attempts={}", runId, attempts);
        return true;
    }
}
