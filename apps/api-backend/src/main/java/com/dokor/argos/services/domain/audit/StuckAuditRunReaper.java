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
 * <p>La reprise verrouille le run et compare le claim et la date de démarrage
 * observés avant de changer son état. Un ancien balayage ne peut pas écraser
 * un nouveau worker. La remise en file et le reset de progression sont atomiques.
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
            if (handleStuckRun(run, maxAttempts)) {
                handled++;
            }
        }
        return handled;
    }

    private boolean handleStuckRun(AuditRun run, int maxAttempts) {
        var result=auditRunDao.recoverStuck(run,maxAttempts,Instant.now(),run.getExecutionScope()==null ? auditRunService.initialModuleStatusesJson() : auditRunService.initialModuleStatusesJson(run));
        if(result==AuditRunDao.Recovery.FAILED) auditRunService.failRunningModules(run.getId());
        if(result!=AuditRunDao.Recovery.STALE) logger.warn("Stuck audit recovery runId={} outcome={}",run.getId(),result);
        return result!=AuditRunDao.Recovery.STALE;
    }
}
