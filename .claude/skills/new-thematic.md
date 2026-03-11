---
name: new-thematic
description: Aide à créer un nouveau set thématique pour l'extension
---

# Créer une nouvelle thématique

Guide l'utilisateur pour configurer une nouvelle thématique de réponse automatique.

## Informations à collecter

Pose ces questions à l'utilisateur :

1. **Nom de la thématique** — Ex: "Guide IA Automation"
2. **Mots-clés déclencheurs** — Ex: "GUIDE", "PDF", "DOC" (séparés par des virgules, insensible à la casse)
3. **Template de réponse au commentaire** — Ex: "C'est envoyé en DM ! 🚀"
4. **Template du message DM** — Ex: "Salut {{firstName}} ! Voici le guide : {{link}}"
5. **Lien du lead magnet** — URL du document/ressource à partager
6. **Posts ciblés** (optionnel) — URNs de posts spécifiques, ou vide pour tous les posts
7. **Délais** (optionnel) — Réponse min/max (défaut 120-300s), DM min/max (défaut 180-600s)

## Variables disponibles dans les templates

- `{{firstName}}` — Prénom du commentateur
- `{{fullName}}` — Nom complet
- `{{link}}` — Lien du lead magnet configuré
- `{{keyword}}` — Mot-clé qui a déclenché le match
- `{{thematic}}` — Nom de la thématique

## Résultat attendu

Génère l'objet thématique complet au format JSON que l'utilisateur pourra copier, ou indique les valeurs à saisir dans le popup de l'extension :

```json
{
  "name": "Guide IA Automation",
  "keywords": ["GUIDE", "PDF", "DOC"],
  "replyTemplate": "C'est envoyé en DM ! 🚀",
  "dmTemplate": "Salut {{firstName}} !\n\nSuite à ton commentaire, voici le guide : {{link}}\n\nBonne lecture ! 📖",
  "leadMagnetUrl": "https://docs.scale-me.fr/guide-ia.pdf",
  "postUrns": [],
  "enabled": true,
  "replyDelayMin": 120,
  "replyDelayMax": 300,
  "dmDelayMin": 180,
  "dmDelayMax": 600
}
```

## Conseils à donner

- Choisir des mots-clés courts et distinctifs (éviter les mots communs)
- Varier les templates entre les thématiques pour plus de naturel
- Activer les "Messages dynamiques" dans les settings pour que l'extension varie automatiquement
- Toujours tester en mode dry run d'abord
