# Stats Claude

L'écran de stats de Claude Code, en local : sessions, tokens, carte de chaleur par jour,
modèle favori. Tout est calculé sur ta machine, à partir de tes propres transcripts
Claude Code. Rien n'est envoyé nulle part.

> Projet non officiel. Non affilié à Anthropic, ni approuvé ni sponsorisé
> par Anthropic. « Claude » est une marque d'Anthropic.

## Prérequis

- Windows 10 ou 11, ou macOS
- Node.js 18 ou plus récent (aucun paquet npm à installer)
- Claude Code déjà utilisé au moins une fois : le dossier `.claude/projects` de ton dossier
  personnel doit exister (Windows : `%USERPROFILE%\.claude\projects` ; Mac : `~/.claude/projects`)

## Installer et lancer

```
node build.js
```

La commande (dans un terminal, sur Windows comme sur Mac) écrit `stats.html` à côté de
`build.js` et l'ouvre dans ton navigateur. Si rien ne s'ouvre, la commande affiche le
chemin du fichier : ouvre-le à la main.
Relance-la quand tu veux pour rafraîchir.

Option Windows : double-clique `open-app.vbs` pour rafraîchir et ouvrir l'écran dans une fenêtre
Chrome sans console. Le fichier suppose Node et Chrome dans leurs dossiers par défaut
(`C:\Program Files\nodejs` et `C:\Program Files\Google\Chrome`) ; modifie les deux
chemins dans le fichier si les tiens sont ailleurs. Tu peux créer un raccourci Bureau vers
ce fichier et lui donner l'icône `stats-claude.ico`.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `build.js` | Lit les transcripts, écrit `stats.html` |
| `template.html` | La mise en page que `build.js` remplit |
| `open-app.vbs` | Lanceur optionnel sans console (Windows) |
| `stats-claude.ico` | Icône pour un raccourci Bureau |

`cache.json` et `stats.html` sont créés au premier lancement et restent sur ta machine
(ignorés par git). `SECURITY.md` dit exactement ce qui est lu et écrit.

## Licence

MIT, voir `LICENSE`.
