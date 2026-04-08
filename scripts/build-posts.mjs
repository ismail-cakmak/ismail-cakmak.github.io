import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultProjectRoot = path.resolve(__dirname, '..');

function normalizeTag(tag = '') {
  return tag.trim().toLowerCase();
}

export function parseFrontmatter(raw) {
  const match = raw.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
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

  for (const fileName of fileNames.filter(isMarkdownFile)) {
    const filePath = path.join(postsDir, fileName);
    const raw = await readFile(filePath, 'utf8');
    const meta = parseFrontmatter(raw);
    const slug = path.basename(fileName, '.md');

    if (!meta.title || !meta.date) {
      throw new Error(`${fileName} must define both title and date.`);
    }

    const post = {
      slug,
      title: meta.title,
      date: meta.date,
      tags: meta.tags || [],
      excerpt: meta.excerpt || '',
      file: `posts/${fileName}`
    };

    posts.push(post);
    contentPosts.push({
      ...post,
      body: raw
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
