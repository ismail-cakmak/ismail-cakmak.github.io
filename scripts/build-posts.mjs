import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import markdownItAttrs from 'markdown-it-attrs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultProjectRoot = path.resolve(__dirname, '..');
const frontmatterPattern = /^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const markdown = createMarkdownRenderer();

function slugify(value = '') {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildPostUrl(slug) {
  return `blog/${encodeURIComponent(slug)}/`;
}

function buildPostFileUrl(fileName) {
  return `posts/${encodeURIComponent(fileName)}`;
}

function normalizeTag(tag = '') {
  return tag.trim().toLowerCase();
}

function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: true,
    breaks: false,
    linkify: false
  });

  md.use(markdownItAttrs, {
    allowedAttributes: [
      'id',
      'class',
      'width',
      'height',
      'title',
      'loading',
      'target',
      'rel',
      /^aria-/,
      /^data-/
    ]
  });

  const defaultHeadingOpen = md.renderer.rules.heading_open
    || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));

  md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    if (!token.attrGet('id') && nextToken?.type === 'inline' && nextToken.content) {
      token.attrSet('id', slugify(nextToken.content));
    }

    return defaultHeadingOpen(tokens, index, options, env, self);
  };

  return md;
}

function markdownText(value = '') {
  return value
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function getShowTitle(meta) {
  const showTitle = String(meta.showTitle ?? '').trim().toLowerCase();
  const hideTitle = String(meta.hideTitle ?? '').trim().toLowerCase();
  return showTitle !== 'false' && showTitle !== '0' && hideTitle !== 'true' && hideTitle !== '1';
}

function removeDuplicateBodyTitle(body, title) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const firstContentIndex = lines.findIndex(line => line.trim());

  if (firstContentIndex === -1) {
    return body.trim();
  }

  const firstLine = lines[firstContentIndex].trim();
  const match = firstLine.match(/^#\s+(.+?)(?:\s+\{[^}]+\})?$/);

  if (!match) {
    return body.trim();
  }

  if (slugify(markdownText(match[1])) !== slugify(title)) {
    return body.trim();
  }

  lines.splice(firstContentIndex, 1);
  return lines.join('\n').trim();
}

export function renderMarkdown(markdownSource = '') {
  return markdown.render(markdownSource).trim();
}

export function parseFrontmatter(raw) {
  const match = raw.match(frontmatterPattern);
  if (!match) {
    throw new Error('Post is missing frontmatter.');
  }

  const meta = {};
  for (const line of match[1].split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'tags') {
      meta.tags = value ? value.split(',').map(tag => normalizeTag(tag)).filter(Boolean) : [];
      continue;
    }

    meta[key] = value;
  }

  return meta;
}

function getPostBody(raw) {
  const match = raw.match(frontmatterPattern);
  if (!match) {
    throw new Error('Post is missing frontmatter.');
  }

  return raw.slice(match[0].length).trim();
}

export function isMarkdownFile(fileName) {
  return fileName.endsWith('.md') && fileName !== 'README.md';
}

function comparePosts(left, right) {
  return right.date.localeCompare(left.date);
}

export async function collectPosts(postsDir) {
  const fileNames = await readdir(postsDir);
  const posts = [];
  const contentPosts = [];
  const usedSlugs = new Map();

  for (const fileName of fileNames.filter(isMarkdownFile)) {
    const filePath = path.join(postsDir, fileName);
    const raw = await readFile(filePath, 'utf8');
    const meta = parseFrontmatter(raw);
    const rawBody = getPostBody(raw);
    const renderableBody = getShowTitle(meta)
      ? removeDuplicateBodyTitle(rawBody, meta.title)
      : rawBody;
    const fileSlug = path.basename(fileName, '.md');
    const slug = slugify(meta.slug || meta.title || fileSlug);

    if (!meta.title || !meta.date) {
      throw new Error(`${fileName} must define both title and date.`);
    }

    if (!slug) {
      throw new Error(`${fileName} must resolve to a non-empty slug.`);
    }

    if (usedSlugs.has(slug)) {
      throw new Error(
        `${fileName} resolves to duplicate slug "${slug}", already used by ${usedSlugs.get(slug)}.`
      );
    }

    usedSlugs.set(slug, fileName);

    const post = {
      slug,
      legacySlugs: fileSlug !== slug ? [fileSlug] : [],
      url: buildPostUrl(slug),
      title: meta.title,
      date: meta.date,
      tags: meta.tags || [],
      excerpt: meta.excerpt || '',
      file: buildPostFileUrl(fileName)
    };

    posts.push(post);
    contentPosts.push({
      ...post,
      body: raw,
      html: renderMarkdown(renderableBody)
    });
  }

  posts.sort(comparePosts);
  contentPosts.sort(comparePosts);
  return { posts, contentPosts };
}

export async function buildPostsAssets({
  projectRoot = defaultProjectRoot,
  postsDir = path.join(projectRoot, 'posts'),
  outputDir = postsDir
} = {}) {
  const outputPath = path.join(outputDir, 'index.json');
  const contentOutputPath = path.join(outputDir, 'content.js');
  const { posts, contentPosts } = await collectPosts(postsDir);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(posts, null, 2)}\n`);

  const content = {
    generatedAt: new Date().toISOString(),
    posts: contentPosts
  };

  await writeFile(
    contentOutputPath,
    `window.POSTS_CONTENT = ${JSON.stringify(content, null, 2)};\n`
  );

  return {
    posts,
    outputPath,
    contentOutputPath
  };
}

async function run() {
  const result = await buildPostsAssets();
  console.log(
    `Wrote ${result.posts.length} posts to ${path.relative(defaultProjectRoot, result.outputPath)} and ${path.relative(defaultProjectRoot, result.contentOutputPath)}.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
