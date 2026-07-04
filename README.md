# Personal Website

This repo contains the static personal website and Markdown blog posts for `ismail-cakmak.github.io`.

## Writing Workflow

Use VS Code for writing, and use the browser preview as the source of truth for how the post will look on the website.

1. Start from the project root:

```bash
cd /home/user/DEV/personal-website/ismail-cakmak.github.io
```

2. Install dependencies once if needed:

```bash
npm install
```

3. Start the live preview:

```bash
npm run preview
```

4. Open the URL printed in the terminal.

It usually starts on:

```text
http://127.0.0.1:4173/
```

If that port is busy, the preview command will try the next port and print a different URL, such as:

```text
http://127.0.0.1:4174/
```

Use the URL that the terminal prints.

5. Open your post route in the browser:

```text
http://127.0.0.1:4173/blog/your-post-slug/
```

6. Write in VS Code, save the Markdown file, and watch the browser update automatically.

The loop is:

```text
write in VS Code -> save -> site rebuilds -> browser refreshes
```

The update happens on save, not on every keystroke.

## Where Posts Live

Markdown posts live in:

```text
posts/
```

Post images live in:

```text
posts/image/your-post-slug/
```

Each post should start with frontmatter:

```md
---
title: My Post Title
slug: my-post-title
date: 2026-07-04
tags: product, notes
excerpt: One short sentence for the blog index.
---

Start the post here.
```

The `slug` becomes the public URL:

```text
/blog/my-post-title/
```

## Editor Preview vs Website Preview

When you open a `.md` file in VS Code, it may show a rendered editorial Markdown view. That is useful for writing and structure.

It is not the website renderer.

The real website preview is the browser page served by:

```bash
npm run preview
```

Trust the browser preview before publishing.

## Image And Layout Controls

Standard centered image:

```md
![Alt text](posts/image/my-post-title/image.png)
```

Wide image:

```md
![Alt text](posts/image/my-post-title/image.png){.image-wide}
```

Small image:

```md
![Alt text](posts/image/my-post-title/image.png){.image-small}
```

Right floated image:

```md
![Alt text](posts/image/my-post-title/image.png){.image-right}
```

Plain image without frame:

```md
![Alt text](posts/image/my-post-title/image.png){.image-plain}
```

Captioned image:

```html
<figure class="image-wide">
  <img src="posts/image/my-post-title/image.png" alt="Alt text">
  <figcaption>Caption text.</figcaption>
</figure>
```

Two images side by side:

```html
<div class="image-grid image-grid--two">
  <img src="posts/image/my-post-title/before.png" alt="Before">
  <img src="posts/image/my-post-title/after.png" alt="After">
</div>
```

More post-specific details are documented in `posts/README.md`.

## Before Pushing

Run a production-style build:

```bash
npm run build
```

This writes the deployable site to:

```text
dist/
```

GitHub Pages publishes the same built output during deployment.

## Useful Commands

```bash
npm run preview
```

Build the site, serve it locally, watch source files, and refresh the browser on save.

```bash
npm run build
```

Build the deployable static site into `dist/`.

```bash
npm run build:posts
```

Regenerate `posts/index.json` and `posts/content.js` from Markdown posts.

## Troubleshooting

If the preview URL does not open, check the terminal output and use the exact URL it prints.

If a port is already in use, the preview command tries the next port automatically.

If the browser does not update after saving, stop the preview server with `Ctrl+C`, then run `npm run preview` again.
