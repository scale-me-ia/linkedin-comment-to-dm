---
name: release
description: Préparer et publier une nouvelle release de l'extension
---

# Procédure de release

Guide pour préparer une nouvelle version de l'extension Scale Me.

## Étapes

### 1. Vérifier l'état du code

- S'assurer que toutes les modifications sont commitées
- Vérifier qu'il n'y a pas d'erreurs dans la console Chrome
- Tester en dry run puis en réel sur un post de test

### 2. Mettre à jour la version

Modifier le numéro de version dans `manifest.json` :
```json
"version": "X.Y.Z"
```

Convention de versioning :
- **Patch (X.Y.Z+1)** : fix de bugs, mise à jour de sélecteurs
- **Minor (X.Y+1.0)** : nouvelle fonctionnalité
- **Major (X+1.0.0)** : changement majeur d'architecture ou breaking change

### 3. Mettre à jour CHANGELOG.md

Ajouter une entrée en haut du fichier avec :
- Numéro de version et date
- Sections : Added, Changed, Fixed, Removed (selon le cas)

### 4. Commit et tag

```bash
git add manifest.json CHANGELOG.md
git commit -m "release: vX.Y.Z — description courte"
git tag vX.Y.Z
git push origin main --tags
```

### 5. Créer la release GitHub

```bash
gh release create vX.Y.Z --title "vX.Y.Z — Description" --notes "Notes de release..."
```

Ou via l'interface GitHub : Releases → New release → choisir le tag → rédiger les notes.

### 6. Vérification post-release

- Vérifier que la release apparaît sur GitHub
- Tester le téléchargement et l'installation depuis le ZIP de la release
- Mettre à jour tasks.md si des items de la roadmap ont été complétés
