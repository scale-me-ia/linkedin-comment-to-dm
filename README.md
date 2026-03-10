# ⚡ Scale Me — LinkedIn Comment-to-DM Extension

Extension Chrome (Manifest V3) pour automatiser les réponses aux commentaires LinkedIn et l'envoi de DMs avec lead magnets.

## 🎯 Fonctionnement

1. Tu publies un post LinkedIn avec un CTA ("Commente **GUIDE** pour recevoir le doc")
2. L'extension scanne les commentaires en temps réel (MutationObserver + scan périodique)
3. Quand un mot-clé est détecté → réponse au commentaire + envoi DM avec le lien

## 📦 Installation

1. Ouvre Chrome → `chrome://extensions`
2. Active **Developer mode** (toggle en haut à droite)
3. Clique **Load unpacked** → sélectionne ce dossier (`linkedin-comment-extension/`)
4. L'icône ⚡ apparaît dans la barre Chrome

## ⚙️ Configuration

### Via le popup (clic sur l'icône ⚡) :

1. **Créer des thématiques** : chaque thématique = mots-clés + template réponse + template DM + lien lead magnet
2. **Mode test** : activé par défaut — simule les actions sans les exécuter (logs en console)
3. **Activer** : toggle master ON quand tu es prêt

### Variables disponibles dans les templates :

| Variable | Description |
|----------|-------------|
| `{{firstName}}` | Prénom du commentateur |
| `{{fullName}}` | Nom complet |
| `{{link}}` | Lien du lead magnet |
| `{{keyword}}` | Mot-clé détecté |
| `{{thematic}}` | Nom de la thématique |

### Exemple de thématique :

- **Nom** : Guide IA Automation
- **Mots-clés** : `GUIDE, PDF, DOC`
- **Réponse** : `C'est envoyé en DM ! 🚀`
- **DM** : `Salut {{firstName}} ! Voici le guide : {{link}}`
- **Lien** : `https://docs.scale-me.fr/guide-ia-automation.pdf`

## 🛡️ Sécurité & Limites

### Limites quotidiennes (hardcodées) :
- **25 réponses/jour** max
- **20 DMs/jour** max
- Délais aléatoires entre chaque action (30s à 2min)
- Typing simulé caractère par caractère

### Bonnes pratiques :
- **Toujours démarrer en dry run** pour vérifier les matchs
- Ne pas laisser tourner sur plus de 2-3 posts en même temps
- Varier les templates de réponse entre les thématiques
- Rester connecté sur LinkedIn (l'extension a besoin de la session active)

## 🏗️ Architecture

```
linkedin-comment-extension/
├── manifest.json              # Config Manifest V3
├── icons/                     # Icônes extension
├── src/
│   ├── content-script.js      # Script principal (injecté sur LinkedIn)
│   ├── content-style.css      # Badge flottant
│   ├── service-worker.js      # Background (notifications, alarms)
│   ├── popup.html             # UI popup
│   ├── popup.css              # Styles popup (dark theme Scale Me)
│   ├── popup.js               # Logique popup
│   ├── config.js              # Constantes & sélecteurs DOM (module)
│   ├── utils.js               # Utilitaires (module)
│   ├── comment-scanner.js     # Scanner de commentaires (module)
│   └── action-executor.js     # Exécution des actions (module)
```

## ⚠️ Risques

- LinkedIn peut changer ses sélecteurs DOM → les mettre à jour dans `config.js`
- L'extension simule des actions utilisateur → risque de détection si usage excessif
- **NE PAS** dépasser les limites quotidiennes
- **NE PAS** utiliser sur un compte LinkedIn critique sans avoir testé en dry run

## 🔧 Debug

1. Ouvre la console Chrome (F12) sur une page LinkedIn
2. Filtre les logs par `[ScaleMe]`
3. Active le "Debug mode" dans les settings pour plus de logs
4. Les logs sont aussi visibles dans l'onglet "Logs" du popup

## 🔄 Mise à jour des sélecteurs

Si LinkedIn change son DOM :
1. Inspecte les éléments (F12) sur une page LinkedIn
2. Mets à jour les sélecteurs dans `src/config.js` (objet `SELECTORS`)
3. Recharge l'extension dans `chrome://extensions`
