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

## Control the rendered post

Posts are rendered with `markdown-it` during the build. That means the browser uses generated HTML from your Markdown instead of the older hand-written parser.

The frontmatter `title` is the default visible page title. Start the body with the intro paragraph or a `##` section heading:

```md
---
title: My New Post
slug: my-new-post
date: 2026-04-07
tags: writing, notes
excerpt: One short sentence for the blog index.
---

This is the first paragraph of the post.

## First Section
```

If you want the visible title to live inside the Markdown body exactly where you place it, add `showTitle: false` and write your own `#` heading:

```md
---
title: My New Post
showTitle: false
date: 2026-04-07
---

# My New Post

This title is controlled by the Markdown body.
```

If the first body line is `# Same Title As Frontmatter`, the build removes it automatically so you do not get a duplicate title.

### Image controls

Use normal Markdown for standard centered images:

```md
![Alt text](posts/image/my-post/screenshot.png)
```

Add classes with `{.class-name}` when you need layout control:

```md
![Wide screenshot](posts/image/my-post/screenshot.png){.image-wide}

![Small diagram](posts/image/my-post/diagram.png){.image-small}

![Icon without frame](posts/image/my-post/icon.png){.image-small .image-plain}

![Image floated right beside text](posts/image/my-post/phone.png){.image-right}
```

Use raw HTML when you need captions or multi-image layouts:

```html
<figure class="image-wide">
  <img src="posts/image/my-post/screenshot.png" alt="Alt text">
  <figcaption>Caption text shown below the image.</figcaption>
</figure>

<div class="image-grid image-grid--two">
  <img src="posts/image/my-post/before.png" alt="Before">
  <img src="posts/image/my-post/after.png" alt="After">
</div>
```

Supported classes:

- `.image-wide` for a wider image that breaks out of the text column.
- `.image-small` for narrow images.
- `.image-left` and `.image-right` for floated images on desktop.
- `.image-plain` to remove the border/background.
- `.image-grid .image-grid--two` for two images side by side.

Markdown tables, ordered lists, unordered lists, blockquotes, horizontal rules, code blocks, and raw HTML are supported.

## Preview before pushing

Run the exact static build locally:

```bash
npm run preview
```

Then open the printed local URL and inspect the post under `/blog/your-post-slug/`. Keep this command running while you write. When you save a post, stylesheet, or template file, the preview rebuilds and the browser refreshes automatically.

For a non-server check, run:

```bash
npm run build
```

That writes the deployable site to `dist/`, which is what GitHub Pages publishes.
