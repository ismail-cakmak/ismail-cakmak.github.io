# Blog posts

Add your posts to this folder as Markdown files

Each post should start with frontmatter like this:

```md
---
title: My New Post
slug: my-new-post
date: 2026-04-07
tags: writing, notes
excerpt: One short sentence for the blog index.
---

Your post content goes here.
```

`slug` is optional. If you set it, that value is used for the post URL. If you omit it, the build uses the title to generate a clean kebab-case URL automatically.

If you publish this site with GitHub Pages, the deploy workflow rebuilds the site automatically on every push to `main`.

For a local preview build, run:

```bash
npm run build
```

That writes the deployable site to `dist/`.
