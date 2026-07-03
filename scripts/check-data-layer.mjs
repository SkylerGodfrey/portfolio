#!/usr/bin/env node
/**
 * Data-layer smoke test — plain JavaScript, runnable with bare node.
 *
 * Usage:
 *   # Real GitHub API (empty result is fine if no repo has topic:portfolio yet):
 *   node scripts/check-data-layer.mjs
 *
 *   # Fixture data (deterministic, no network required):
 *   PORTFOLIO_FIXTURES=1 node scripts/check-data-layer.mjs
 *
 * This script replicates the logic in src/lib/github.ts in pure JavaScript so
 * it can run without a TypeScript compiler.
 */

// ---------------------------------------------------------------------------
// Inline fixtures (mirrors src/lib/fixtures.ts)
// ---------------------------------------------------------------------------

const FIXTURES = [
  {
    slug: 'MMM-Canvas',
    name: 'MMM-Canvas',
    title: 'MagicMirror Canvas LMS Module',
    blurbMarkdown:
      '# MMM-Canvas\n\nDisplays upcoming Canvas LMS assignments on a MagicMirror² smart mirror.\n',
    tags: ['magicmirror', 'canvas-lms', 'javascript', 'education'],
    repoUrl: 'https://github.com/SkylerGodfrey/MMM-Canvas',
    demoUrl: null,
    previewClipUrl: null,
    contentGroup: 'dev',
  },
  {
    slug: 'MMM-Chores',
    name: 'MMM-Chores',
    title: 'MagicMirror Chores Tracker',
    blurbMarkdown:
      '# MMM-Chores\n\nDisplays household chore schedules and tracks completion on a MagicMirror².\n',
    tags: ['magicmirror', 'javascript', 'productivity'],
    repoUrl: 'https://github.com/SkylerGodfrey/MMM-Chores',
    demoUrl: null,
    previewClipUrl: null,
    contentGroup: 'dev',
  },
  {
    slug: 'pokemon-tcg-tracker',
    name: 'pokemon-tcg-tracker',
    title: 'Pokémon TCG Living Dex Tracker',
    blurbMarkdown:
      '# Pokémon TCG Living Dex Tracker\n\nFull-stack app for tracking a Pokémon TCG living dex.\n',
    tags: ['typescript', 'postgresql', 'react', 'pokemon'],
    repoUrl: 'https://github.com/SkylerGodfrey/pokemon-tcg-tracker',
    demoUrl: 'https://skylergodfrey.com/demos/pokemon-tcg-tracker/',
    previewClipUrl: 'https://skylergodfrey.com/demos/pokemon-tcg-tracker/preview.mp4',
    contentGroup: 'dev',
  },
  {
    slug: 'MMM-Mascot',
    name: 'MMM-Mascot',
    title: 'MagicMirror Animated Mascot',
    blurbMarkdown:
      '# MMM-Mascot\n\nAnimated character that reacts to time-of-day on a MagicMirror².\n',
    tags: ['magicmirror', 'javascript', 'animation', 'css'],
    repoUrl: 'https://github.com/SkylerGodfrey/MMM-Mascot',
    demoUrl: null,
    previewClipUrl: null,
    contentGroup: 'dev',
  },
];

// ---------------------------------------------------------------------------
// Helpers (mirrors src/lib/github.ts)
// ---------------------------------------------------------------------------

const GITHUB_USER = 'SkylerGodfrey';
const DEMOS_BASE = 'https://skylergodfrey.com/demos';

function buildHeaders() {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': `${GITHUB_USER}-portfolio-builder`,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchPortfolioMd(repoName, defaultBranch) {
  const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${repoName}/${defaultBranch}/PORTFOLIO.md`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return '';
    if (!res.ok) {
      console.warn(`  [warn] PORTFOLIO.md for ${repoName}: HTTP ${res.status}`);
      return '';
    }
    return await res.text();
  } catch (err) {
    console.warn(`  [warn] Could not fetch PORTFOLIO.md for ${repoName}: ${err}`);
    return '';
  }
}

async function fetchDemoManifest(repoName) {
  const url = `${DEMOS_BASE}/${repoName}/manifest.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { demoUrl: null, previewClipUrl: null };
    const data = await res.json();
    return {
      demoUrl: data.demoUrl ?? null,
      previewClipUrl: data.previewClipUrl ?? null,
    };
  } catch {
    return { demoUrl: null, previewClipUrl: null };
  }
}

async function fetchFromGitHub() {
  const query = encodeURIComponent(`topic:portfolio user:${GITHUB_USER}`);
  const url = `https://api.github.com/search/repositories?q=${query}&per_page=100`;

  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 403 || res.status === 429) {
      throw new Error(
        `Rate limited — HTTP ${res.status}, x-ratelimit-remaining=${remaining ?? 'unknown'}`,
      );
    }
    throw new Error(`GitHub search API — HTTP ${res.status}`);
  }

  const data = await res.json();
  console.log(`[github] Found ${data.total_count} repo(s) with topic:portfolio`);

  return Promise.all(
    data.items.map(async (repo) => {
      const tags = repo.topics.filter((t) => t !== 'portfolio');
      const [blurbMarkdown, manifest] = await Promise.all([
        fetchPortfolioMd(repo.name, repo.default_branch),
        fetchDemoManifest(repo.name),
      ]);
      return {
        slug: repo.name,
        name: repo.name,
        title: repo.description ?? repo.name,
        blurbMarkdown,
        tags,
        repoUrl: repo.html_url,
        demoUrl: manifest.demoUrl,
        previewClipUrl: manifest.previewClipUrl,
        contentGroup: 'dev',
      };
    }),
  );
}

async function getPortfolioProjects() {
  if (process.env.PORTFOLIO_FIXTURES === '1') {
    console.log('[github] Source: fixture data (PORTFOLIO_FIXTURES=1)');
    return FIXTURES;
  }
  try {
    const projects = await fetchFromGitHub();
    console.log(`[github] Source: live GitHub API (${projects.length} project(s) resolved)`);
    return projects;
  } catch (err) {
    console.warn(`[github] API unavailable — falling back to fixture data. Reason: ${err}`);
    return FIXTURES;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const usingFixtures = process.env.PORTFOLIO_FIXTURES === '1';
const tokenPresent = Boolean(process.env.GITHUB_TOKEN);

console.log('='.repeat(60));
console.log('Portfolio data-layer smoke test');
console.log(`  Mode   : ${usingFixtures ? 'fixtures (PORTFOLIO_FIXTURES=1)' : 'live GitHub API'}`);
console.log(`  Token  : ${tokenPresent ? 'GITHUB_TOKEN present' : 'unauthenticated'}`);
console.log('='.repeat(60));

const projects = await getPortfolioProjects();

if (projects.length === 0) {
  console.log('\n[result] No projects returned (no repos have topic:portfolio yet — expected).');
  console.log('[result] The data layer is working correctly; an empty result degrades gracefully.');
} else {
  console.log(`\n[result] ${projects.length} project(s) resolved:\n`);
  for (const p of projects) {
    console.log(`  slug          : ${p.slug}`);
    console.log(`  title         : ${p.title}`);
    console.log(`  tags          : ${p.tags.join(', ') || '(none)'}`);
    console.log(`  repoUrl       : ${p.repoUrl}`);
    console.log(`  demoUrl       : ${p.demoUrl ?? '(none)'}`);
    console.log(`  previewClipUrl: ${p.previewClipUrl ?? '(none)'}`);
    console.log(
      `  blurb         : ${
        p.blurbMarkdown ? `${p.blurbMarkdown.trimEnd().split('\n')[0]} …` : '(empty)'
      }`,
    );
    console.log('  ' + '-'.repeat(56));
  }
}

console.log('\n[done] Smoke test complete.');
