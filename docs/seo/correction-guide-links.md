# Catalogue des guides de correction

correctionGuides.ts contrôle chaque destination par clé exacte et publication explicite. Aucun titre, preuve, token ou URL auditée n’entre dans le href. Une clé inconnue (y compris une propriété héritée), un guide non publié ou une langue absente ne produit pas de lien.

Guides publiés : la checklist reçoit title, meta description, canonical et H1 dans #html-seo ; alternatives dans #accessibilite. Langue anglaise désactivée jusqu’à livraison de sa route complète par #390. Les guides donnent accès au formulaire, à la méthode et à la démonstration.

Destinations LCP #302, CSP #303 et HSTS #304 non publiées : entrées désactivées et routes proposées internes uniquement. Avant activation : confirmer la route réelle et son contenu, remplacer la route proposée si nécessaire, renseigner seulement les langues livrées, puis passer published à true avec tests de résolution/HTTP. Ne pas créer leurs articles dans #388.
