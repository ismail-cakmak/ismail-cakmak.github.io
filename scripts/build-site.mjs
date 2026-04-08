import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPostsAssets } from './build-posts.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const staticFiles = [
  'index.html',
  'blog.html',
  'about.html',
  'gallery.html',
  'post.html'
];

const staticDirectories = [
  'css',
  'js',
  'images'
];

const optionalFiles = [
  'CNAME',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml'
];

async function copyIntoDist(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(distDir, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
}

async function copyIfPresent(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);

  try {
    await access(sourcePath, fsConstants.F_OK);
  } catch {
    return false;
  }

  await copyIntoDist(relativePath);
  return true;
}

async function buildSite() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await Promise.all(staticFiles.map(copyIntoDist));
  await Promise.all(staticDirectories.map(copyIntoDist));
  await Promise.all(optionalFiles.map(copyIfPresent));

  const postsOutputDir = path.join(distDir, 'posts');
  const result = await buildPostsAssets({
    projectRoot,
    postsDir: path.join(projectRoot, 'posts'),
    outputDir: postsOutputDir
  });

  await writeFile(path.join(distDir, '.nojekyll'), '');
  console.log(
    `Built ${result.posts.length} posts into ${path.relative(projectRoot, distDir)}.`
  );
}

buildSite().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
