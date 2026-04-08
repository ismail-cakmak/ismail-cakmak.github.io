const THEMES = ['light', 'dark', 'tokyo'];
const LABELS = { light: 'light', dark: 'dark', tokyo: 'tokyo' };
const POSTS_INDEX_PATH = 'posts/index.json';

let postsIndexPromise;

function getTheme() {
  return localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.querySelector('.theme-label').textContent = LABELS[theme];
  }
}

function cycleTheme() {
  const current = getTheme();
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  setTheme(next);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function renderInlineMarkdown(text) {
  const linkTokens = [];
  let rendered = escapeHtml(text);
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const token = `__LINK_${linkTokens.length}__`;
    linkTokens.push(`<a href="${escapeAttribute(url)}">${label}</a>`);
    return token;
  });
  rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  rendered = linkTokens.reduce((output, token, index) => output.replace(`__LINK_${index}__`, token), rendered);
  return rendered;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listItems = [];
  let quoteLines = [];
  let codeLines = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    html.push(`<blockquote><p>${renderInlineMarkdown(quoteLines.join(' '))}</p></blockquote>`);
    quoteLines = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
  };

  lines.forEach(line => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      return;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      flushQuote();
      html.push(`<h3>${renderInlineMarkdown(line.slice(4).trim())}</h3>`);
      return;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      flushQuote();
      html.push(`<h2>${renderInlineMarkdown(line.slice(3).trim())}</h2>`);
      return;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      flushQuote();
      listItems.push(line.slice(2).trim());
      return;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      quoteLines.push(line.slice(2).trim());
      return;
    }

    paragraph.push(line.trim());
  });

  flushParagraph();
  flushList();
  flushQuote();
  flushCode();

  return html.join('');
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta = {};
  match[1].split('\n').forEach(line => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'tags') {
      meta.tags = value ? value.split(',').map(tag => tag.trim()).filter(Boolean) : [];
      return;
    }

    meta[key] = value;
  });

  return { meta, body: raw.slice(match[0].length).trim() };
}

async function loadPostsIndex() {
  if (window.POSTS_CONTENT?.posts) {
    return window.POSTS_CONTENT.posts;
  }

  if (!postsIndexPromise) {
    postsIndexPromise = fetch(POSTS_INDEX_PATH).then(async response => {
      if (!response.ok) {
        throw new Error(`Could not load ${POSTS_INDEX_PATH}`);
      }

      return response.json();
    });
  }

  return postsIndexPromise;
}

async function loadPostContent(post) {
  if (post.body) {
    return post.body;
  }

  const response = await fetch(post.file);
  if (!response.ok) {
    throw new Error(`Could not load ${post.file}`);
  }

  return response.text();
}

function renderTags(tags = []) {
  if (!tags.length) return '';
  return `<span class="post-tags">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>`;
}

function renderPostList(posts) {
  return posts.map(post => {
    const postUrl = `post.html?slug=${encodeURIComponent(post.slug)}`;
    return `
      <li class="post-item">
        <span class="post-date">${escapeHtml(post.date)}</span>
        <span class="post-title"><a href="${postUrl}">${escapeHtml(post.title)}</a>${renderTags(post.tags)}</span>
      </li>
    `;
  }).join('');
}

function groupPostsByYear(posts) {
  return posts.reduce((groups, post) => {
    const year = post.date.slice(0, 4);
    if (!groups[year]) {
      groups[year] = [];
    }
    groups[year].push(post);
    return groups;
  }, {});
}

function setStatus(key, message = '') {
  const element = document.querySelector(`[data-post-status="${key}"]`);
  if (!element) return;

  element.textContent = message;
  element.hidden = !message;
}

function renderLoadError(key) {
  setStatus(key, 'Posts could not be loaded.');
}

async function renderRecentPosts() {
  const feed = document.querySelector('[data-post-feed="recent"]');
  if (!feed) return;

  try {
    const posts = await loadPostsIndex();
    const limit = Number.parseInt(feed.dataset.postLimit || '5', 10);
    const visiblePosts = posts.slice(0, limit);
    feed.innerHTML = visiblePosts.length ? renderPostList(visiblePosts) : '<li class="post-item post-item-placeholder">No posts yet.</li>';
  } catch (error) {
    feed.innerHTML = '';
    renderLoadError('recent');
  }
}

async function renderArchive() {
  const archive = document.querySelector('[data-post-archive]');
  if (!archive) return;

  try {
    const posts = await loadPostsIndex();
    if (!posts.length) {
      archive.innerHTML = '<p class="feed-status">No posts yet.</p>';
      return;
    }

    const groups = groupPostsByYear(posts);
    archive.innerHTML = Object.keys(groups).sort((left, right) => Number(right) - Number(left)).map(year => `
      <section>
        <h2 class="section-title">${year}</h2>
        <ul class="post-list">
          ${renderPostList(groups[year])}
        </ul>
      </section>
    `).join('');
  } catch (error) {
    archive.innerHTML = '';
    renderLoadError('archive');
  }
}

function formatLongDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

async function renderSinglePost() {
  const page = document.querySelector('[data-post-page]');
  if (!page) return;

  const article = page.querySelector('article');
  const status = page.querySelector('[data-post-status="single"]');
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    status.textContent = 'Select a post from the blog archive.';
    return;
  }

  try {
    const posts = await loadPostsIndex();
    const post = posts.find(entry => entry.slug === slug);

    if (!post) {
      status.textContent = 'That post does not exist.';
      return;
    }

    const raw = await loadPostContent(post);
    const parsed = parseFrontmatter(raw);
    const title = parsed.meta.title || post.title;
    const date = parsed.meta.date || post.date;
    const tags = parsed.meta.tags || post.tags || [];

    page.querySelector('[data-post-title]').textContent = title;
    page.querySelector('[data-post-date]').textContent = formatLongDate(date);
    page.querySelector('[data-post-date]').setAttribute('datetime', date);
    page.querySelector('[data-post-tags]').innerHTML = renderTags(tags);
    page.querySelector('[data-post-body]').innerHTML = markdownToHtml(parsed.body);

    document.title = `${title} — Your Name`;
    article.hidden = false;
    status.hidden = true;
  } catch (error) {
    renderLoadError('single');
  }
}

function initLightbox() {
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = lightbox?.querySelector('img');

  if (!lightbox) return;

  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add('active');
    });
  });

  lightbox.addEventListener('click', () => lightbox.classList.remove('active'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      lightbox.classList.remove('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  setTheme(getTheme());

  const button = document.querySelector('.theme-toggle');
  if (button) {
    button.addEventListener('click', cycleTheme);
  }

  const path = window.location.pathname.split('/').pop() || 'index.html';
  const blogSection = path === 'blog.html' || path === 'post.html';
  document.querySelectorAll('.header-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html') || (blogSection && href === 'blog.html')) {
      link.classList.add('active');
    }
  });

  initLightbox();

  await Promise.all([
    renderRecentPosts(),
    renderArchive(),
    renderSinglePost()
  ]);
});
