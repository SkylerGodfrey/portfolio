/**
 * Build-time GitHub data layer.
 *
 * Discovers repos owned by SkylerGodfrey that carry the `portfolio` topic,
 * enriches each with its PORTFOLIO.md blurb and the pipeline-published demo
 * manifest, and returns a typed Project array.
 *
 * Data source priority (first match wins):
 *   1. Module-level in-process cache — stable for the lifetime of one Astro build
 *   2. Fixture data    — when PORTFOLIO_FIXTURES=1
 *   3. Live GitHub API — authenticated via GITHUB_TOKEN when present
 *   4. Fixture fallback — when the API is unreachable or rate-limited
 */

import type { DemoManifest, Project } from './types.js';
import { FIXTURES } from './fixtures.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_USER = 'SkylerGodfrey';
const DEMOS_BASE = 'https://skylergodfrey.com/demos';
const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';

// ---------------------------------------------------------------------------
// Module-level cache — reset between Node processes but stable within a build
// ---------------------------------------------------------------------------

let cache: Project[] | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': `${GITHUB_USER}-portfolio-builder`,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Fetch the raw PORTFOLIO.md for a repo.
 * Returns an empty string — not an error — when the file is absent (404) or
 * the request fails; callers just get no blurb.
 */
async function fetchPortfolioMd(repoName: string, defaultBranch: string): Promise<string> {
  const url = `${RAW_BASE}/${GITHUB_USER}/${repoName}/${defaultBranch}/PORTFOLIO.md`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return '';
    if (!res.ok) {
      console.warn(`[github] PORTFOLIO.md for ${repoName}: HTTP ${res.status} — using empty blurb`);
      return '';
    }
    return await res.text();
  } catch (err) {
    console.warn(`[github] Could not fetch PORTFOLIO.md for ${repoName}: ${err} — using empty blurb`);
    return '';
  }
}

/**
 * Attempt to load the demo manifest that the CI pipeline publishes.
 * Returns null fields — not an error — when no manifest has been published yet.
 */
async function fetchDemoManifest(
  repoName: string,
): Promise<{ demoUrl: string | null; previewClipUrl: string | null }> {
  const url = `${DEMOS_BASE}/${repoName}/manifest.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { demoUrl: null, previewClipUrl: null };
    const data = (await res.json()) as Partial<DemoManifest>;
    return {
      demoUrl: data.demoUrl ?? null,
      previewClipUrl: data.previewClipUrl ?? null,
    };
  } catch {
    // Network error or JSON parse failure — demo not yet published, fine
    return { demoUrl: null, previewClipUrl: null };
  }
}

// ---------------------------------------------------------------------------
// GitHub API types (minimal subset of what we use)
// ---------------------------------------------------------------------------

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  topics: string[];
}

interface SearchResult {
  total_count: number;
  items: GitHubRepo[];
}

// ---------------------------------------------------------------------------
// Core fetch logic
// ---------------------------------------------------------------------------

async function fetchFromGitHub(): Promise<Project[]> {
  const query = encodeURIComponent(`topic:portfolio user:${GITHUB_USER}`);
  const url = `${GITHUB_API}/search/repositories?q=${query}&per_page=100`;

  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 403 || res.status === 429) {
      throw new Error(
        `GitHub rate limited — HTTP ${res.status}, x-ratelimit-remaining=${remaining ?? 'unknown'}`,
      );
    }
    throw new Error(`GitHub search API — HTTP ${res.status}`);
  }

  const data = (await res.json()) as SearchResult;
  console.log(`[github] Found ${data.total_count} repo(s) with topic:portfolio`);

  return Promise.all(
    data.items.map(async (repo): Promise<Project> => {
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all portfolio projects.
 *
 * Call from any Astro page or content collection — results are memoised so
 * the GitHub API is only hit once per build regardless of how many pages
 * call this function.
 */
export async function getPortfolioProjects(): Promise<Project[]> {
  // 1. In-process cache
  if (cache !== null) return cache;

  // 2. Fixture mode
  if (process.env.PORTFOLIO_FIXTURES === '1') {
    console.log('[github] Source: fixture data (PORTFOLIO_FIXTURES=1)');
    cache = FIXTURES;
    return cache;
  }

  // 3. Live API with graceful fallback
  try {
    const projects = await fetchFromGitHub();
    console.log(`[github] Source: live GitHub API (${projects.length} project(s) resolved)`);
    cache = projects;
    return cache;
  } catch (err) {
    console.warn(`[github] API unavailable — falling back to fixture data. Reason: ${err}`);
    cache = FIXTURES;
    return cache;
  }
}
