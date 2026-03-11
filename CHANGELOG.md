# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

---

## [v1.2.0] — 2026-03-10

### Changed
- **Catchup 100% DOM** — Remplacement complet de l'API LinkedIn Voyager par un scraper DOM-based. Le module `catchup.js` charge maintenant les commentaires en cliquant sur "load more" et en scrapant le DOM, éliminant toute dépendance API.

### Fixed
- Fiabilité du catchup : plus de casse quand LinkedIn modifie ses endpoints API internes.

---

## [v1.1.1] — 2026-03-10

### Fixed
- Catchup API : ajout de 3 endpoints de posts et 5 endpoints de commentaires avec fallbacks pour gérer les changements d'API LinkedIn.

---

## [v1.1.0] — 2026-03-10

### Added
- **Mode Rattrapage (Catchup)** — Récupération des anciens commentaires via l'API LinkedIn Voyager pour envoyer les DMs manqués.
- **Scanner de profil** — Détection automatique des CTAs dans les posts visibles, avec génération de thématiques draft.
- **Messages dynamiques** — 9 variations de réponse + 180 combinaisons de DMs (5 openers × 6 bodies × 6 closers) pour éviter les patterns répétitifs.
- **Délais configurables** — Délais de réponse et de DM configurables par thématique (min/max en secondes).
- Onglet "Rattrapage" dans le popup avec sélection de posts et lancement du scan.

### Fixed
- Suppression du bruit `runtime.lastError` quand aucun onglet LinkedIn n'est actif.
- Listeners catchup null-safe dans le popup.
- CSP : remplacement des `onclick` inline par des event listeners délégués dans popup.js.
- Content script chargé sur **toutes** les pages linkedin.com (pas seulement le feed).
- Scanner de profil robuste avec sélecteurs multi-fallback.

---

## [v1.0.0] — 2026-03-10

### Added
- Extension Chrome Manifest V3 complète.
- Détection de commentaires en temps réel via MutationObserver + scan périodique.
- Matching de mots-clés par thématique.
- Réponse automatique aux commentaires avec simulation de frappe humaine.
- Envoi automatique de DMs avec lead magnets.
- Popup de configuration avec gestion des thématiques (CRUD).
- Limites de sécurité : 25 réponses/jour, 20 DMs/jour, délais randomisés.
- Mode test (dry run) activé par défaut.
- Badge flottant ScaleMe sur LinkedIn (vert = actif, rouge = inactif).
- Service worker pour notifications Chrome et reset quotidien des compteurs.
- Variables de template : `{{firstName}}`, `{{fullName}}`, `{{link}}`, `{{keyword}}`, `{{thematic}}`.
- Dark theme pour le popup.

---

[v1.2.0]: https://github.com/scale-me-ia/linkedin-comment-to-dm/releases/tag/v1.2.0
[v1.1.1]: https://github.com/scale-me-ia/linkedin-comment-to-dm/releases/tag/v1.1.1
[v1.1.0]: https://github.com/scale-me-ia/linkedin-comment-to-dm/releases/tag/v1.1.0
[v1.0.0]: https://github.com/scale-me-ia/linkedin-comment-to-dm/releases/tag/v1.0.0
