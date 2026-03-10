# ⚡ Scale Me — LinkedIn Comment-to-DM

## Guide complet d'utilisation

---

## 📦 Installation

### Première installation

1. **Télécharge le code** :
   - Va sur https://github.com/scale-me-ia/linkedin-comment-to-dm
   - Clique **Code** → **Download ZIP**, ou clone avec `git clone`

2. **Charge l'extension dans Chrome** :
   - Ouvre Chrome, tape `chrome://extensions` dans la barre d'adresse
   - Active le **mode développeur** (toggle en haut à droite)
   - Clique **"Charger l'extension non empaquetée"** (Load unpacked)
   - Sélectionne le dossier `linkedin-comment-extension/`
   - L'icône ⚡ apparaît dans ta barre d'extensions Chrome

3. **Vérifie** : va sur LinkedIn → tu dois voir un petit badge **"ScaleMe"** en bas à gauche de la page (point rouge = inactif, vert = actif)

### Mise à jour

Quand je pousse une mise à jour :
1. `git pull` dans le dossier (ou re-télécharge le ZIP)
2. Va dans `chrome://extensions`
3. Clique le bouton 🔄 **reload** sur l'extension
4. Refresh ta page LinkedIn (`Ctrl+R`)

---

## 🎯 Concept

Tu publies un post LinkedIn avec un CTA du type :

> *"J'ai compilé 50 prompts ChatGPT pour automatiser ton business. Commente **PROMPT** pour le recevoir en DM."*

L'extension :
1. **Détecte** le mot-clé "PROMPT" dans les commentaires
2. **Répond** au commentaire : "C'est envoyé en DM ! 🚀"
3. **Envoie un message privé** au commentateur avec le lien du document

Tout ça automatiquement, avec des délais humains pour rester discret.

---

## ⚙️ Configuration — Étape par étape

### Étape 1 : Créer une thématique

Clique sur l'icône ⚡ dans Chrome → onglet **Thématiques** → **"+ Ajouter une thématique"**

Remplis les champs :

| Champ | Exemple | Description |
|-------|---------|-------------|
| **Nom** | Guide IA Automation | Identifiant pour toi |
| **Mots-clés** | `GUIDE, PDF, DOC` | Mots que les gens commentent (séparés par des virgules). Insensible à la casse. |
| **Réponse commentaire** | `C'est envoyé en DM ! 🚀` | Ce que l'extension répond sous le commentaire |
| **Message DM** | `Salut {{firstName}} ! Voici le guide : {{link}}` | Le message privé envoyé |
| **Lien lead magnet** | `https://docs.scale-me.fr/guide.pdf` | Le lien du document partagé en DM |
| **Réponse min/max** | `120 / 300` | Délai en secondes avant de répondre (2-5 min) |
| **DM min/max** | `180 / 600` | Délai en secondes avant d'envoyer le DM (3-10 min) |
| **Post URNs** | *(vide)* | Si vide = surveille tous tes posts. Sinon, colle l'URN du post spécifique |

**Variables disponibles dans les templates :**

- `{{firstName}}` → Prénom du commentateur (ex: "Pierre")
- `{{fullName}}` → Nom complet (ex: "Pierre Bour")
- `{{link}}` → Lien du lead magnet configuré
- `{{keyword}}` → Le mot-clé qui a matché (ex: "GUIDE")
- `{{thematic}}` → Le nom de la thématique

**Clique "Sauvegarder"** → la thématique apparaît dans la liste avec un indicateur vert.

### Étape 2 : Configurer les settings

Onglet **Config** :

| Setting | Recommandé | Description |
|---------|-----------|-------------|
| **Mode test (dry run)** | ✅ ON au début | Simule les actions sans les exécuter. Les matchs apparaissent en console (F12) et dans les logs. **Commence TOUJOURS par ça.** |
| **Messages dynamiques** 🤖 | ✅ ON | Varie automatiquement les réponses et DMs à chaque envoi (9 variations de réponse, combinaisons aléatoires de DM). Évite les patterns répétitifs que LinkedIn peut détecter. |
| **Notifications** | ✅ ON | Notification Chrome à chaque action |
| **Debug mode** | ❌ OFF | Logs détaillés en console (pour debug uniquement) |

### Étape 3 : Activer le scanning

1. Va sur LinkedIn (feed ou page de post)
2. Ouvre le popup ⚡
3. Toggle le **switch master** en haut à droite → **ON**
4. Le badge passe au **vert** et le status affiche "🟢 Actif — Scanning" (ou "🏜️ Mode test actif" si dry run)

L'extension scanne maintenant les commentaires visibles toutes les 30-60 secondes.

---

## 🔍 Scanner automatique de profil

Si tu as déjà des posts avec des CTAs, l'extension peut **détecter automatiquement les thématiques** :

1. Va sur ta page profil LinkedIn → **Activité** → **Posts**
2. Popup ⚡ → onglet **Thématiques** → clique **"🔍 Scanner mon profil"**
3. L'extension analyse tes posts visibles et détecte les CTAs (patterns "commente X", "tape X", "écris X", etc.)
4. Des **thématiques draft** sont créées automatiquement (désactivées par défaut)
5. Pour chaque draft : clique ✏️ → ajoute le **lien du lead magnet** → active-la

---

## 🔄 Mode Rattrapage (anciens commentaires)

Pour les commentaires qui sont déjà là et qui n'ont jamais reçu de réponse :

1. Va sur LinkedIn
2. Popup ⚡ → onglet **Rattrapage**
3. Clique **"📡 Charger mes posts"** → l'extension récupère tes 20 derniers posts via l'API LinkedIn
4. Tu vois la liste avec un preview + nombre de commentaires
5. **Coche/décoche** les posts à scanner
6. Clique **"🚀 Lancer le rattrapage"**
7. L'extension fetch **tous les commentaires** (jusqu'à 500/post), matche les mots-clés
8. Les matchs sont mis en queue → **DM uniquement** (pas de reply sur les vieux commentaires)

**Résultat affiché :**
- Posts scannés
- Commentaires analysés
- Matchs trouvés → DMs en attente

Les DMs sont ensuite envoyés avec les délais configurés dans la thématique.

---

## 📊 Dashboard temps réel

Le popup affiche en permanence :

| Indicateur | Description |
|-----------|-------------|
| **Réponses** | Nombre de réponses envoyées aujourd'hui / limite (25) |
| **DMs** | Nombre de DMs envoyés aujourd'hui / limite (20) |
| **En attente** | Actions dans la queue (en cours de traitement avec délais) |

Les compteurs se remettent à zéro automatiquement chaque jour.

---

## 📝 Logs

Onglet **Logs** → historique de toutes les actions :

- 💬 = Réponse envoyée
- 📩 = DM envoyé
- ❌ = Échec
- ⚡ = Autre action

Chaque entrée montre : heure, auteur, mot-clé, thématique.

Bouton **"Vider les logs"** pour reset.

---

## 🛡️ Sécurité et limites

### Limites automatiques (non modifiables)

| Limite | Valeur | Raison |
|--------|--------|--------|
| Réponses/jour | 25 max | Éviter la détection LinkedIn |
| DMs/jour | 20 max | Limite safe pour les messages |
| Délai entre actions | 2-10 min (configurable) | Simule un comportement humain |
| Typing | 30-80ms/caractère | Frappe réaliste |

### Bonnes pratiques

- **Toujours commencer en dry run** pour vérifier que les matchs sont corrects
- **Ne pas dépasser 2-3 thématiques actives** en même temps
- **Varier les templates** entre les thématiques
- **Activer les messages dynamiques** pour éviter les répétitions
- **Rester connecté sur LinkedIn** — l'extension utilise ta session active
- **Ne pas utiliser d'autres outils d'automation** en même temps

### En cas de problème

1. **L'extension ne détecte rien** → vérifie que le scanner est ON (badge vert), que les mots-clés sont corrects, ouvre la console F12 et filtre par `[ScaleMe]`
2. **Les réponses ne s'envoient pas** → les sélecteurs DOM ont peut-être changé. Ouvre un issue sur le repo.
3. **"Impossible de scanner"** → reload l'extension dans `chrome://extensions`, refresh LinkedIn
4. **Limite atteinte** → attends le lendemain, les compteurs se reset à minuit

---

## 🔧 Architecture technique (pour référence)

```
┌─────────────────────────────────────┐
│         Popup (popup.html/js)       │
│  Config thématiques / Stats / Logs  │
│         Catchup UI                  │
└──────────────┬──────────────────────┘
               │ chrome.tabs.sendMessage
               ▼
┌─────────────────────────────────────┐
│      Content Script (linkedin.com)  │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  Comment     │  │  Catchup     │  │
│  │  Scanner     │  │  (Voyager    │  │
│  │  (DOM +      │  │   API)       │  │
│  │  Observer)   │  │              │  │
│  └──────┬──────┘  └──────┬───────┘  │
│         │                │          │
│         ▼                ▼          │
│  ┌─────────────────────────────┐    │
│  │      Action Queue           │    │
│  │  (delays, rate limits)      │    │
│  └──────────┬──────────────────┘    │
│             │                       │
│     ┌───────┴────────┐              │
│     ▼                ▼              │
│  Reply to         Send DM          │
│  Comment          (messaging)       │
│  (DOM sim)        (DOM sim)         │
└─────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Service Worker (background)      │
│    Notifications / Daily reset      │
└─────────────────────────────────────┘
```

---

## 💡 Tips avancés

### Trouver l'URN d'un post

Pour cibler une thématique sur un post spécifique :
1. Ouvre le post LinkedIn
2. L'URL ressemble à `https://www.linkedin.com/feed/update/urn:li:activity:1234567890/`
3. L'URN est `urn:li:activity:1234567890`
4. Colle-le dans le champ "Post URNs" de la thématique

### Messages dynamiques — Comment ça marche

Quand activé, au lieu d'envoyer le template exact, l'extension pioche aléatoirement parmi des variations :

**Réponses (9 variations) :**
- "C'est envoyé en DM ! 🚀"
- "Envoyé en message privé ✅"
- "C'est parti en DM 📩"
- "Je t'envoie ça en privé ! 🎯"
- "Check tes DMs ! 📬"
- etc.

**DMs (combinaison aléatoire opener + body + closer) :**
- Opener : "Salut Pierre !" / "Hey Pierre 👋" / "Hello Pierre !" / ...
- Body : "Comme promis, voici le document : [lien]" / "Voilà le lien : [lien]" / ...
- Closer : "Bonne lecture ! 📖" / "Hésite pas si t'as des questions 💬" / ...

Ça donne des **centaines de combinaisons** différentes, impossible à détecter comme pattern.

### Console de debug

Pour voir ce que fait l'extension en temps réel :
1. Ouvre LinkedIn
2. F12 → Console
3. Filtre par `[ScaleMe]`
4. Tu verras : scans, matchs, actions en queue, envois

---

*Extension développée par Neo ⚡ pour Scale Me — Mars 2026*
