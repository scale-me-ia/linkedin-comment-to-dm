# Scale Me — LinkedIn Comment-to-DM Extension

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-green)
![Zero API](https://img.shields.io/badge/API-Zero%20(DOM%20only)-orange)
![JS](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

Extension Chrome (Manifest V3) pour automatiser les réponses aux commentaires LinkedIn et l'envoi de DMs avec lead magnets. 100% DOM-based, zéro appel API.

## Fonctionnement

```
Commentaire avec mot-clé          Réponse automatique           DM avec lead magnet
┌──────────────────────┐    ┌──────────────────────────┐    ┌─────────────────────────┐
│ "GUIDE"              │ -> │ "C'est envoyé en DM !"   │ -> │ "Salut Pierre ! Voici   │
│ par Pierre Dupont    │    │ (délai 2-5 min)          │    │  le guide : [lien]"     │
└──────────────────────┘    └──────────────────────────┘    │ (délai 3-10 min)        │
                                                            └─────────────────────────┘
```

1. Tu publies un post LinkedIn avec un CTA ("Commente **GUIDE** pour recevoir le doc")
2. L'extension scanne les commentaires en temps réel (MutationObserver + scan périodique)
3. Quand un mot-clé est détecté : réponse au commentaire + envoi DM avec le lien

## Installation

1. Clone le repo ou télécharge le ZIP
2. Ouvre Chrome → `chrome://extensions`
3. Active **Developer mode** (toggle en haut à droite)
4. Clique **Load unpacked** → sélectionne ce dossier
5. L'icône apparaît dans la barre Chrome → un badge "ScaleMe" apparaît sur les pages LinkedIn

## Configuration

### Via le popup (clic sur l'icône) :

1. **Créer des thématiques** : chaque thématique = mots-clés + template réponse + template DM + lien lead magnet
2. **Mode test** : activé par défaut — simule les actions sans les exécuter (logs en console)
3. **Messages dynamiques** : varie automatiquement les réponses et DMs (180 combinaisons)
4. **Activer** : toggle master ON quand tu es prêt

### Variables disponibles dans les templates :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `{{firstName}}` | Prénom du commentateur | Pierre |
| `{{fullName}}` | Nom complet | Pierre Dupont |
| `{{link}}` | Lien du lead magnet | https://docs.scale-me.fr/guide.pdf |
| `{{keyword}}` | Mot-clé détecté | GUIDE |
| `{{thematic}}` | Nom de la thématique | Guide IA Automation |

### Exemple de thématique :

- **Nom** : Guide IA Automation
- **Mots-clés** : `GUIDE, PDF, DOC`
- **Réponse** : `C'est envoyé en DM !`
- **DM** : `Salut {{firstName}} ! Voici le guide : {{link}}`
- **Lien** : `https://docs.scale-me.fr/guide-ia-automation.pdf`
- **Délais** : Réponse 2-5 min, DM 3-10 min

## Fonctionnalités

### Scanner de profil
Va sur ton profil LinkedIn > Activité > Posts, puis clique "Scanner mon profil" dans le popup. L'extension détecte automatiquement tes CTAs et génère des thématiques draft.

### Mode Rattrapage
Pour les commentaires déjà existants : onglet "Rattrapage" dans le popup → charge tes posts → sélectionne ceux à scanner → lance le rattrapage. L'extension scrape les commentaires via le DOM et envoie les DMs manqués.

### Messages dynamiques
Quand activé, l'extension varie automatiquement chaque réponse et DM parmi des dizaines de formulations (9 variations de réponse, 180 combinaisons de DM) pour éviter les patterns détectables.

## Sécurité & Limites

### Limites quotidiennes (hardcodées, non modifiables) :

| Limite | Valeur |
|--------|--------|
| Réponses/jour | 25 max |
| DMs/jour | 20 max |
| Délai entre actions | 2-10 min (configurable par thématique) |
| Typing | 30-80ms/caractère (simulation humaine) |

### Bonnes pratiques :
- **Toujours démarrer en dry run** pour vérifier les matchs
- Ne pas laisser tourner sur plus de 2-3 posts en même temps
- Activer les **messages dynamiques** pour varier les réponses
- Varier les templates de réponse entre les thématiques
- Rester connecté sur LinkedIn (l'extension a besoin de la session active)

## Architecture

```
├── manifest.json                 # Config Manifest V3
├── icons/                        # Icônes 16/48/128px
├── src/
│   ├── content-script.js         # Script principal (injecté sur LinkedIn) — IIFE
│   ├── catchup.js                # Module catchup DOM-based (chargé avant content-script)
│   ├── content-style.css         # Badge flottant ScaleMe
│   ├── service-worker.js         # Background (notifications, reset compteurs)
│   ├── popup.html/css/js         # UI popup (dark theme, 4 onglets)
│   ├── config.js                 # Constantes & sélecteurs DOM (ES module)
│   ├── utils.js                  # Utilitaires (ES module)
│   ├── comment-scanner.js        # Scanner de commentaires (ES module)
│   └── action-executor.js        # Exécution des actions (ES module)
├── CLAUDE.md                     # Instructions pour Claude Code
├── context.md                    # Contexte business/produit
├── tasks.md                      # Roadmap & backlog
├── CHANGELOG.md                  # Historique des versions
└── GUIDE.md                      # Guide utilisateur complet
```

### Flux de données

```
┌────────────────────────────────────────────────┐
│              Popup (config UI)                 │
│   Thématiques / Stats / Logs / Rattrapage      │
└──────────────────┬─────────────────────────────┘
                   │ chrome.tabs.sendMessage
                   v
┌────────────────────────────────────────────────┐
│         Content Script (linkedin.com)          │
│                                                │
│  MutationObserver ──> Comment Scanner          │
│  + Scan périodique     (keyword matching)       │
│                            │                   │
│  Catchup (DOM scraper) ────┤                   │
│                            v                   │
│                     Action Queue               │
│                   (délais randomisés)          │
│                     │           │              │
│                     v           v              │
│               Reply to      Send DM            │
│               Comment       (messaging)        │
│             (DOM sim)       (DOM sim)           │
└──────────────────┬─────────────────────────────┘
                   │ chrome.runtime.sendMessage
                   v
┌────────────────────────────────────────────────┐
│         Service Worker (background)            │
│    Notifications Chrome / Reset quotidien      │
└────────────────────────────────────────────────┘
```

## Risques

- LinkedIn peut changer ses sélecteurs DOM → les mettre à jour dans **3 fichiers** : `content-script.js`, `config.js`, `catchup.js`
- L'extension simule des actions utilisateur → risque de détection si usage excessif
- **NE PAS** dépasser les limites quotidiennes
- **NE PAS** utiliser sur un compte LinkedIn critique sans avoir testé en dry run

## Debug

1. Ouvre la console Chrome (F12) sur une page LinkedIn
2. Filtre les logs par `[ScaleMe]`
3. Active le "Debug mode" dans les settings pour plus de logs
4. Les logs sont aussi visibles dans l'onglet "Logs" du popup

## Dépannage

| Problème | Solution |
|----------|----------|
| Extension ne se charge pas | Recharger dans `chrome://extensions` + refresh LinkedIn |
| Aucun match détecté | Vérifier mots-clés, vérifier que les commentaires sont visibles |
| Reply/DM échoue | Sélecteurs DOM probablement cassés → inspecter + mettre à jour |
| "Impossible de scanner" | Être sur LinkedIn (feed ou profil), pas sur une autre page |
| Limite atteinte | Attendre le lendemain, les compteurs se reset à minuit |

## Mise à jour des sélecteurs

Si LinkedIn change son DOM, les sélecteurs doivent être mis à jour dans **3 fichiers** :
1. `src/content-script.js` — objet `SELECTORS` (lignes ~12-34)
2. `src/config.js` — export `SELECTORS` (lignes ~8-41)
3. `src/catchup.js` — `this.SELECTORS` dans le constructeur (lignes ~10-26)

Puis recharger l'extension dans `chrome://extensions`.

## Documentation

- [GUIDE.md](GUIDE.md) — Guide utilisateur complet pas à pas
- [CHANGELOG.md](CHANGELOG.md) — Historique des versions
- [context.md](context.md) — Contexte business et produit
- [tasks.md](tasks.md) — Roadmap et backlog

---

*Développé par Neo pour [Scale Me IA](https://github.com/scale-me-ia) — Mars 2026*
