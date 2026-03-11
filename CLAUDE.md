# CLAUDE.md — Scale Me LinkedIn Comment-to-DM

Extension Chrome (Manifest V3) qui automatise les réponses aux commentaires LinkedIn par mot-clé et envoie des lead magnets par DM. JavaScript vanilla, zéro dépendance npm.

## Architecture

```
├── manifest.json                 # Manifest V3, permissions: storage, alarms, notifications
├── GUIDE.md                      # Guide utilisateur complet
├── .gitignore                    # Fichiers ignorés par git
├── icons/                        # Icônes 16/48/128px
├── tests/
│   └── unit.test.js              # Tests unitaires (node --test, zero deps)
└── src/
    ├── selectors.js              # SOURCE UNIQUE des sélecteurs DOM (IIFE → window.ScaleMeSelectors)
    ├── selector-diagnostic.js    # Diagnostic DOM : teste tous les sélecteurs + propose alternatives
    ├── content-script.js         # Script principal injecté sur linkedin.com (IIFE)
    │                               Utilise window.ScaleMeSelectors avec fallbacks inline
    ├── catchup.js                # Module DOM-based catchup (classe LinkedInCatchup)
    │                               Utilise window.ScaleMeSelectors avec fallbacks inline
    ├── config.js                 # Constantes exportées (ES modules) — DELAYS, LIMITS
    ├── utils.js                  # Utilitaires exportés (ES modules) — simulateTyping, simulateClick, etc.
    ├── service-worker.js         # Background : notifications Chrome, reset compteurs quotidiens
    ├── popup.html/css/js         # UI de configuration (dark theme, onglets, modale, diagnostic)
    └── content-style.css         # Badge flottant ScaleMe + indicateur visuel commentaires traités
```

### Ordre de chargement (manifest content_scripts)

```
1. src/selectors.js              → window.ScaleMeSelectors (sélecteurs partagés)
2. src/selector-diagnostic.js    → window.ScaleMeDiagnostic (outil de diagnostic)
3. src/catchup.js                → window.ScaleMeLinkedInCatchup
4. src/content-script.js         → IIFE principal
```

### Sélecteurs DOM — Source unique

Les sélecteurs sont définis dans `src/selectors.js` (source unique). Les fichiers `content-script.js` et `catchup.js` lisent `window.ScaleMeSelectors` avec des fallbacks inline en cas d'échec de chargement.

**Pour mettre à jour les sélecteurs : modifier UNIQUEMENT `src/selectors.js`.**

## Flux principal

1. `selectors.js` se charge → expose `window.ScaleMeSelectors`
2. `selector-diagnostic.js` se charge → expose `window.ScaleMeDiagnostic`
3. `catchup.js` se charge → expose `window.ScaleMeLinkedInCatchup`
4. `content-script.js` (IIFE) s'initialise → lit config depuis `chrome.storage.local`
5. Health check sélecteurs après 5s → alerte si sélecteurs cassés
6. MutationObserver + scan périodique (30-60s) détectent les nouveaux commentaires
7. Matching mot-clé → `enqueueAction()` → queue avec délais randomisés
8. Commentaire marqué visuellement (classe CSS `.scaleme-processed` → bordure verte + coche ✓)
9. Pour chaque match : réponse au commentaire (DOM sim) → attente → DM (DOM sim)
10. Messages envoyés via `chrome.runtime.sendMessage` vers service-worker pour notifications
11. Au scan suivant, les commentaires déjà traités sont re-marqués visuellement (`markIfProcessed`)

## Conventions

- **JS vanilla** — pas de framework, pas de build tool, pas de npm
- **camelCase** pour les fonctions et variables
- **UPPER_SNAKE_CASE** pour les constantes (SELECTORS, LIMITS, DELAYS, STORAGE_KEYS)
- **Préfixe console** : `[ScaleMe]` partout (unifié)
- **Horodatage** : format français (`fr-FR`) dans les logs
- **Pas de CSP inline** : les event listeners sont attachés via JS (delegated events dans popup.js)

## Limites de sécurité (hardcodées)

| Limite | Valeur | Fichier |
|--------|--------|---------|
| Réponses/jour | 25 | content-script.js, config.js |
| DMs/jour | 20 | content-script.js, config.js |
| Connexions/jour | 10 | content-script.js |
| Actions/heure | 8 | config.js |
| Cooldown si limite | 2h | config.js |
| Typing | 30-80ms/char | content-script.js |
| Délai entre actions | 30s-2min | config.js |
| Commentaires mémorisés | 5000 max | content-script.js |
| Logs conservés | 500 max | content-script.js |
| Pending DMs max | 50 | content-script.js |
| Expiration pending DM | 7 jours / 14 retries | content-script.js |
| Retry pending DMs | toutes les 2h | service-worker.js |

## Variables de template

`{{firstName}}`, `{{fullName}}`, `{{link}}`, `{{keyword}}`, `{{thematic}}`

## Messages dynamiques

Quand `settings.dynamicMessages` est activé, le content-script pioche aléatoirement parmi :
- 9 variations de réponse (REPLY_VARIATIONS)
- 5 openers DM × 6 bodies × 6 closers = 180 combinaisons

## Storage Chrome

Clés préfixées `scaleme_` dans `chrome.storage.local` :

| Clé | Contenu |
|-----|---------|
| `scaleme_thematics` | Array de thématiques configurées |
| `scaleme_settings` | Objet settings (enabled, dryRun, dynamicMessages, etc.) |
| `scaleme_action_log` | Historique des actions (max 500) |
| `scaleme_processed_comments` | Set des comment IDs traités (max 5000) |
| `scaleme_daily_counters` | { replies, dms, connections, date } — reset quotidien |
| `scaleme_pending_dms` | Array de DMs en attente de connexion (max 50, expire 7j) |
| `scaleme_selector_health` | { broken: [], timestamp, url } — dernier health check |
| `scaleme_diagnostic` | Rapport complet du dernier diagnostic |

## Communication inter-composants

Messages via `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` :

| Type | Direction | Action |
|------|-----------|--------|
| `TOGGLE_ENABLED` | popup → content | Active/désactive le scanner |
| `UPDATE_THEMATICS` | popup → content | Met à jour les thématiques |
| `UPDATE_SETTINGS` | popup → content | Met à jour les settings |
| `GET_STATUS` | popup → content | Récupère l'état (counters, queue) |
| `SCAN_PROFILE_POSTS` | popup → content | Scanner les posts de la page courante |
| `CATCHUP_FETCH_POSTS` | popup → content | Charger les posts visibles (DOM) |
| `CATCHUP_RUN` | popup → content | Lancer le rattrapage sur les posts sélectionnés |
| `RUN_DIAGNOSTIC` | popup → content | Lancer le diagnostic des sélecteurs |
| `SHOW_NOTIFICATION` | content → service-worker | Afficher une notification Chrome |
| `SEND_CONNECTION_REQUEST` | content → service-worker | Ouvrir profil en onglet bg + cliquer Connect |
| `CLICK_CONNECT_BTN` | service-worker → content | Cliquer sur le bouton Connect d'un profil |
| `RETRY_PENDING_DMS` | service-worker → content | Réessayer les DMs en attente de connexion |
| `GET_PENDING_DMS` | popup → content | Récupérer la liste des DMs en attente |
| `CLEAR_PROCESSED` | popup → content | Effacer tous les commentaires traités (permet retry) |

### Tracking deux niveaux (anti-marquage prématuré)

- **`pendingActionComments`** (Set en mémoire) — empêche la re-détection pendant que l'action est en queue/exécution. Perdu au refresh de page (correct : permet retry).
- **`processedComments`** (Set persisté dans chrome.storage) — peuplé uniquement APRÈS exécution réussie de reply/DM.

## Comment tester

### Tests unitaires
```bash
node --test tests/unit.test.js
```

### Test manuel
1. `chrome://extensions` → mode développeur → Load unpacked → ce dossier
2. Activer le **mode test (dry run)** dans le popup avant toute chose
3. Ouvrir LinkedIn, F12, filtrer console par `[ScaleMe]`
4. Les actions en dry run sont loguées mais pas exécutées

### Indicateur visuel des commentaires traités
Les commentaires matchés par l'automatisation reçoivent la classe CSS `scaleme-processed` :
- **Bordure verte** à gauche du commentaire
- **Pastille coche ✓** verte (pseudo-élément `::after`)
- Appliqué en temps réel lors du match et re-appliqué à chaque scan pour les commentaires déjà traités

### Diagnostic des sélecteurs
1. Ouvrir LinkedIn (feed ou profil)
2. Onglet Config du popup → bouton "Diagnostiquer les sélecteurs"
3. Rapport dans la console F12 + indicateur dans le popup

## Fichiers liés

- [context.md](context.md) — contexte business et produit
- [tasks.md](tasks.md) — roadmap et backlog
- [GUIDE.md](GUIDE.md) — guide utilisateur complet
