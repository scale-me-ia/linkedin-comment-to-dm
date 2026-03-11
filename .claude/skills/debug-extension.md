---
name: debug-extension
description: Checklist de debug quand l'extension ne fonctionne pas
---

# Debug de l'extension Scale Me

L'utilisateur a un problème avec l'extension. Suis cette checklist pour diagnostiquer.

## Checklist de diagnostic

### 1. L'extension est-elle chargée ?

- Vérifier dans `chrome://extensions` que l'extension "Scale Me — LinkedIn Comment-to-DM" est présente et activée
- Vérifier qu'il n'y a pas d'erreurs affichées (lien "Errors" sous l'extension)
- Si erreurs : les lire et corriger (souvent des sélecteurs DOM cassés ou des erreurs de syntaxe)

### 2. Le badge ScaleMe est-il visible ?

- Sur une page LinkedIn, un badge "ScaleMe" avec un point coloré doit apparaître en bas à gauche
- **Point rouge** = scanner inactif → activer via le popup
- **Point vert** = scanner actif
- **Pas de badge** = le content script ne se charge pas → recharger l'extension

### 3. Le scanner est-il actif ?

- Ouvrir le popup (icône ⚡) → le toggle master doit être ON
- Vérifier le statut : "Actif — Scanning" ou "Mode test actif"
- Vérifier qu'au moins une thématique est activée (✅)

### 4. Les sélecteurs DOM sont-ils à jour ?

- Ouvrir la console Chrome (F12) sur LinkedIn
- Filtrer par `[ScaleMe]`
- Exécuter dans la console :
  ```js
  document.querySelector('.comments-comment-item')  // doit retourner un élément
  document.querySelector('.feed-shared-update-v2')   // doit retourner un élément
  ```
- Si `null` → les sélecteurs ont changé → utiliser `/update-selectors`

### 5. Les mots-clés matchent-ils ?

- Vérifier que les mots-clés configurés correspondent exactement aux commentaires
- Le matching est **insensible à la casse** (`GUIDE` matche `guide`, `Guide`, etc.)
- Le commentaire doit **contenir** le mot-clé (pas besoin d'être exact)

### 6. Les limites sont-elles atteintes ?

- Popup → vérifier les compteurs Réponses et DMs
- Max 25 réponses/jour, 20 DMs/jour
- Si atteint → attendre le lendemain (reset à minuit)

### 7. Le mode dry run est-il activé ?

- Si dry run = ON : les actions sont loguées mais pas exécutées
- C'est le comportement attendu en mode test
- Pour exécuter réellement : désactiver le dry run dans Config

## Logs utiles

Dans la console Chrome (F12), filtrer par `[ScaleMe]` :
- `⚡ Scale Me LinkedIn extension loaded` → l'extension s'est bien initialisée
- `🔍 Scanner started` → le scanner est actif
- `🎯 X new keyword match(es)` → des mots-clés ont été détectés
- `📋 Queued: NomAuteur` → action ajoutée à la queue
- `💬 Reply sent` / `📩 DM sent` → actions exécutées
- `⚠️ Daily limit reached` → limites quotidiennes atteintes

## Solutions courantes

| Problème | Solution |
|----------|----------|
| Extension ne se charge pas | Recharger dans chrome://extensions + refresh LinkedIn |
| Aucun match détecté | Vérifier mots-clés, vérifier que les commentaires sont visibles sur la page |
| Reply/DM échoue | Sélecteurs DOM probablement cassés → `/update-selectors` |
| "Impossible de scanner" | Être sur LinkedIn (feed ou profil), pas sur une autre page |
| Badge invisible | Vérifier que content-style.css est bien chargé, pas de conflit z-index |
