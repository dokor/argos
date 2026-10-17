# Supervision des files d’attente

`/account/admin/queue` (FR/EN) est une observation en lecture seule. L’API
`GET /api/account/admin/queue/tasks` et son détail `/{DISCOVERY|BATCH|RUN}/{id}`
revérifient la session et le rôle ADMIN actif dans la transaction. Le BFF utilise
la session de compte, jamais l’ancien secret administrateur. Réponses privées,
`no-store` ; aucune action de priorité, claim, annulation ou reprise n’est ajoutée.

Les compteurs globaux couvrent uniquement les états persistés QUEUED/RUNNING :
découvertes durables, lots admis, runs (y compris ceux des lots). Ce sont des unités
différentes, sans total additionné. Une découverte COMPLETED en attente d’une
sélection ne fait pas partie de la file. Les travaux terminaux quittent la liste,
mais restent consultables par leur détail après une actualisation.

La liste regroupe les URL sous leur lot actif ; le filtre RUN expose aussi les
enfants. Un parent terminal ou absent ne masque pas un enfant encore actif.
Le détail d’un lot contient ses URL sélectionnées (limite d’admission : 50).
Les identités sont jointes en SQL ; les comptes archivés restent masqués. Les URL
de présentation utilisent `AdminDisplayUrl` : pas de query, fragment, credentials
ou token privé. Aucun journal ni erreur brute de collecteur n’est sélectionné.

## Diagnostics observés

- `OBSERVED` : état persisté, sans preuve que le worker travaille actuellement.
- `STALE` : run RUNNING démarré avant `now - audit.scheduler.stuck-timeout`
  (même seuil strict que le reaper), ou au moins un enfant RUNNING du lot dans ce
  cas. Ce diagnostic demande une vérification ; il ne déclenche aucune reprise.
- `REQUEUED` : run QUEUED avec `attempt_count > 0` (au moins une tentative passée).
- `LEASE_EXPIRED` : découverte RUNNING dont `lease_until <= now` ; le worker
  n’est plus autorisé à publier, le prochain reaper fera la transition.
- `EXPIRED` : découverte QUEUED dont `expires_at <= now`.
- `CANCEL_REQUESTED` : annulation durable demandée, encore non terminale.
- `INCONSISTENT` : démarrage/bail absent pour une découverte RUNNING, démarrage
  absent pour un run RUNNING, nombre d’enfants différent de la sélection d’un lot,
  ou lot avec enfants RUNNING sans démarrage observable.
- `RECONCILIATION_PENDING` : statut du lot différent de celui observé depuis les
  enfants (y compris tous les enfants devenus terminaux). Comme `BatchState`, un
  lot déjà RUNNING reste commencé si tous ses enfants sont remis en file.
- `TERMINAL` : détail d’un travail terminé, annulé ou échoué.

L’attente mesure création/admission → démarrage, ou → observation si le travail
n’a pas démarré ; elle s’arrête à la fin pour un travail terminal jamais démarré.
La durée écoulée mesure démarrage → fin/observation. Aucun ETA, rang ni délai
garanti. Les lots dérivent leur premier démarrage des runs, car cette date n’est
pas persistée sur le lot. Un démarrage absent n'est pas interprété comme une
preuve de non-démarrage : après reprise, la durée d'un run remis en file est
libellée « Depuis la soumission », car elle peut inclure une tentative antérieure.
Un lot/run RUNNING sans date de début n'affiche pas une attente inventée.
Les dates et filtres de période sont en UTC.

## Pagination et navigation

Filtres serveur : `type`, `status`, `site` (hôte exact, sans fusion de www ou des
sous-domaines), `user` (ID ou anonymous), `from`, `until` (inclusifs, YYYY-MM-DD).
Tris autorisés : `oldest`, `newest`, `status`, `started`, avec type/ID pour départager.
Pagination par `page` (1–10000), `limit` (1–100, défaut 20), lecture de limit+1.
Pas de requête de comptage total filtré. Les pages représentent une file mouvante :
des transitions peuvent déplacer les lignes entre deux lectures. Actualisation
manuelle avec horodatage serveur ; aucune boucle de polling.

Les compteurs et la liste sont lus dans la transaction de session. Les filtres,
le tri et la page restent dans l’URL ; les liens de détail et de fiche utilisateur
transportent un retour validé à la liste. Les diagnostics n’interviennent jamais
dans l’ordonnancement, les quotas ou la récupération après crash.
