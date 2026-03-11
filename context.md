# Contexte — Scale Me LinkedIn Comment-to-DM

## Problème

Les créateurs de contenu LinkedIn utilisent une stratégie de lead generation très répandue :
1. Publier un post avec un CTA du type "Commente **GUIDE** pour recevoir le doc en DM"
2. Répondre manuellement à chaque commentaire
3. Envoyer manuellement un DM avec le lien du lead magnet

Ce processus est **chronophage et répétitif**. Un post viral peut générer des centaines de commentaires en quelques heures, et le créateur doit répondre un par un, ce qui est incompatible avec son activité principale.

## Solution

Scale Me automatise l'intégralité du flux :
- Détection en temps réel des commentaires contenant un mot-clé configuré
- Réponse automatique au commentaire ("C'est envoyé en DM !")
- Envoi automatique d'un message privé avec le lien du lead magnet
- Personnalisation via variables (prénom, nom complet, mot-clé, lien)

Le tout avec des garde-fous pour rester discret : délais humains randomisés, simulation de frappe caractère par caractère, limites quotidiennes.

## Public cible

- Créateurs de contenu LinkedIn (solopreneurs, coachs, formateurs)
- Growth hackers et équipes marketing B2B
- Agences qui gèrent des comptes LinkedIn pour leurs clients

## Vision produit

### Philosophie "Zero API"

Depuis la v1.2.0, l'extension fonctionne **entièrement via manipulation DOM**. Aucun appel à l'API LinkedIn Voyager ou autre endpoint interne. Avantages :
- **Fiabilité** : pas de casse quand LinkedIn modifie ses endpoints API internes
- **Discrétion** : pas de requêtes HTTP suspectes, uniquement des interactions DOM comme un utilisateur normal
- **Simplicité** : pas d'authentification API, pas de tokens à gérer

Le seul point de fragilité reste les **sélecteurs CSS** qui peuvent changer quand LinkedIn refait son frontend.

### Principes directeurs

1. **Discrétion avant tout** — L'extension doit être indistinguable d'un humain qui répond manuellement
2. **Sécurité du compte** — Les limites quotidiennes sont hardcodées, pas configurables par l'utilisateur, pour éviter les abus
3. **Simplicité d'usage** — Configuration via popup en 3 clics, scanner automatique de profil pour détecter les CTAs existants
4. **Autonomie** — Fonctionne sans serveur, sans compte Scale Me, sans abonnement

## Risques identifiés

| Risque | Impact | Mitigation |
|--------|--------|------------|
| LinkedIn change ses sélecteurs DOM | Extension casse partiellement ou totalement | Maintenance régulière de `config.js`, sélecteurs dupliqués dans 3 fichiers |
| Détection par LinkedIn (automation) | Restriction temporaire ou ban du compte | Limites quotidiennes, délais humains, typing simulé, messages dynamiques |
| Usage excessif par l'utilisateur | Ban LinkedIn | Limites hardcodées (non modifiables), dry run par défaut |
| Sélecteurs dupliqués dans 3 fichiers | Incohérence après mise à jour partielle | Documenter la procédure de mise à jour (skill `/update-selectors`) |

## Organisation

- **Équipe** : Scale Me IA (petite équipe interne)
- **Développeur principal** : Neo
- **Repo** : https://github.com/scale-me-ia/linkedin-comment-to-dm
- **Dernière release** : v1.2.0 (mars 2026) — DOM-based catchup (zero API)
