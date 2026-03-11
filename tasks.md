# Roadmap & Backlog — Scale Me LinkedIn Comment-to-DM

## Version actuelle : v1.2.0 (mars 2026)

DOM-based catchup (zero API) — tout fonctionne via manipulation DOM.

---

## Dette technique

- [ ] **Unifier les sélecteurs DOM** — Les sélecteurs sont dupliqués dans 3 fichiers (`content-script.js`, `config.js`, `catchup.js`). Refactorer pour avoir une seule source de vérité. Contrainte : les content scripts ne supportent pas les ES modules en Manifest V3.
- [ ] **Supprimer les modules ES inutilisés** — `comment-scanner.js` et `action-executor.js` ne sont pas utilisés par le content script (qui a sa propre implémentation en IIFE). Soit les supprimer, soit migrer le content script pour les utiliser.
- [ ] **Unifier le préfixe console** — `[ScaleMe]` dans content-script.js vs `[ScaleMe LinkedIn]` dans utils.js. Choisir un seul préfixe.
- [ ] **Ajouter un .gitignore** — Aucun .gitignore n'existe actuellement.

## Prochaines fonctionnalités

### Priorité haute

- [ ] **Détection automatique de changement de sélecteurs** — Vérifier au démarrage que les sélecteurs clés trouvent bien des éléments sur la page, et alerter l'utilisateur si un sélecteur ne matche rien.
- [ ] **Multi-langue pour les messages dynamiques** — Actuellement les variations sont en français uniquement. Ajouter des sets EN/ES/DE selon la langue du profil.
- [ ] **Export/Import de configuration** — Permettre d'exporter les thématiques en JSON et de les réimporter (backup ou partage entre comptes).

### Priorité moyenne

- [ ] **Dashboard de statistiques** — Onglet dédié dans le popup avec graphiques : commentaires traités par jour, DMs envoyés, taux de match, thématiques les plus actives.
- [ ] **Notifications améliorées** — Résumé quotidien (recap du jour envoyé en notification à heure fixe).
- [ ] **Support multi-onglets** — Actuellement l'extension ne fonctionne que sur l'onglet actif LinkedIn. Gérer le cas où plusieurs onglets LinkedIn sont ouverts.
- [ ] **File d'attente persistante** — Si le navigateur est fermé avec des actions en queue, les reprendre au prochain démarrage.

### Priorité basse

- [ ] **Tests automatisés** — Unit tests sur le matching de mots-clés, le remplissage de templates, le calcul des délais. Pas de tests E2E (trop dépendant du DOM LinkedIn).
- [ ] **Mode "réponse seule"** — Option pour répondre au commentaire sans envoyer de DM (pour les cas où le CTA ne nécessite pas de lead magnet).
- [ ] **Blacklist d'utilisateurs** — Ne pas répondre à certains profils (bots, concurrents, soi-même).
- [ ] **Webhook de notification** — Envoyer un webhook (Discord, Slack) à chaque action pour suivi externe.

## Bugs connus

- [ ] *(aucun bug connu à ce jour — ajouter ici au fur et à mesure)*

---

*Dernière mise à jour : mars 2026*
