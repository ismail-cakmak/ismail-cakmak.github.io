# HookDeck GitHub Pages Deploy Bundle

This folder contains the static app ready for GitHub Pages.

## Deploy From A Pages Repo

Copy the contents of this folder into your GitHub Pages repo, commit, and push.

In GitHub:

```text
Settings -> Pages
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

## Alternative `/docs` Setup

If your Pages repo is configured to publish from `/docs`, rename this folder to
`docs` before copying it into the repo, then use:

```text
Settings -> Pages
Source: Deploy from a branch
Branch: main
Folder: /docs
```

## Included Files

- `index.html`, `styles.css`, and `app.js` are the app.
- `data/meta.json` and `data/videos.json` are the static data snapshot.
- `.nojekyll` tells GitHub Pages to publish the folder without Jekyll processing.

The app stores format edits and assignments in each browser's local storage.
