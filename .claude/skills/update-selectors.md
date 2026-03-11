---
name: update-selectors
description: Mettre à jour les sélecteurs DOM LinkedIn quand l'interface change
---

# Mise à jour des sélecteurs DOM LinkedIn

LinkedIn a probablement changé son interface. L'utilisateur va te fournir les nouveaux sélecteurs CSS ou te demander de les mettre à jour.

## Fichiers à modifier (TOUS les 3, obligatoirement)

1. **`src/content-script.js`** — objet `SELECTORS` (lignes ~12-34)
2. **`src/config.js`** — export `SELECTORS` (lignes ~8-41)
3. **`src/catchup.js`** — `this.SELECTORS` dans le constructeur (lignes ~10-26)

## Procédure

1. Lis les 3 fichiers pour voir les sélecteurs actuels
2. Demande à l'utilisateur quels sélecteurs ont changé (ou quels éléments ne fonctionnent plus)
3. Met à jour les sélecteurs dans **les 3 fichiers en même temps**
4. Met à jour le commentaire "Last verified" dans `config.js` avec la date du jour
5. Vérifie que les sélecteurs sont cohérents entre les 3 fichiers

## Catégories de sélecteurs

- **Feed & Posts** : `FEED_CONTAINER`, `POST_CONTAINER`, `POST_URN`, `POST_TEXT`
- **Commentaires** : `COMMENTS_SECTION`, `COMMENT_ITEM`, `COMMENT_TEXT`, `COMMENT_AUTHOR`, `COMMENT_REPLY_BTN`, `COMMENT_INPUT`, `COMMENT_SUBMIT_BTN`
- **Load more** : `LOAD_MORE_COMMENTS`, `SHOW_COMMENTS_BTN`, `SHOW_PREVIOUS`
- **Messaging** : `MSG_COMPOSE_BTN`, `MSG_SEARCH_INPUT`, `MSG_RECIPIENT_RESULT`, `MSG_BODY_INPUT`, `MSG_SEND_BTN`, `MSG_CLOSE_BTN`

## Attention

- `catchup.js` utilise des sélecteurs multi-fallback (séparés par virgule) — les conserver
- `content-script.js` n'a PAS tous les mêmes sélecteurs que `catchup.js` (pas de `SHOW_PREVIOUS` par ex.)
- Après modification, l'utilisateur doit recharger l'extension dans `chrome://extensions`
