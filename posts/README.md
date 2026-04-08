# Blog posts

Add your posts to this folder as Markdown files.

Each post should start with frontmatter like this:

```md
---
title: My New Post
date: 2026-04-07
tags: writing, notes
excerpt: One short sentence for the blog index.
---

Your post content goes here.
```

If you publish this site with GitHub Pages, the deploy workflow rebuilds the site automatically on every push to `main`.

For a local preview build, run:

```bash
npm run build
```

That writes the deployable site to `dist/`.
