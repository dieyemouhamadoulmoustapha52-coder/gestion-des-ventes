# 🤝 Guide de collaboration — version courte

Deux développeurs · `main` toujours stable · fonctionnalités en branches + Pull Request.

## Routine (chaque session de travail)

```bash
git checkout main && git pull        # 1. synchroniser AVANT de commencer
git checkout -b feat/sujet           # 2. sa branche pour la tâche
# ... coder ...
git status && git diff              # 3. vérifier ce qu'on stage
git add . && git commit -m "feat: ..."   # 4. commit
git push -u origin feat/sujet        # 5. pousser
# 6. ouvrir la Pull Request sur GitHub → l'autre relit → merge sur main
```

## Messages de commit : `type: message court`

| Type | Quand | Exemple |
|---|---|---|
| `feat` | nouvelle fonctionnalité | `feat: ecran de vente` |
| `fix` | correction de bug | `fix: stock qui passe en negatif` |
| `docs` | documentation | `docs: maj du guide` |
| `chore` | structure, outillage | `chore: ajouter un script` |

## Les 5 règles de l'équipe

1. **Aucun commit direct sur `main`** → branche + Pull Request, toujours.
2. **Un commit = une idée**, petit et avec un message précis (pas de « wip », « fix » tout seul).
3. **Vérifier avant de committer** : `git status` + `git diff` (pas de brouillon, pas de fichier perso).
4. **Ne jamais committer les secrets** : `.env`, mots de passe (le `.gitignore` bloque déjà `node_modules/`, `.venv/`, `.env`).
5. **Pull avant de démarrer**, et avant de pousser une branche ancienne :
   `git pull --rebase origin feat/sujet`

## En cas de conflit

```bash
git pull                       # git signale les fichiers en conflit
# ouvrir le fichier, choisir la bonne version, retirer les <<<<<<< ====== >>>>>>>
git add <fichier> && git commit
git push
```

> Questions ou décision douteuse sur l'architecture ? En parler **avant** le commit, dans un commentaire de PR.
