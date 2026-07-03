/**
 * Typed data contracts for the portfolio's build-time GitHub data layer.
 */

/**
 * Shape of the per-project demo manifest published by the CI pipeline at
 * https://skylergodfrey.com/demos/<repo-name>/manifest.json
 */
export interface DemoManifest {
  /** Absolute URL to the live embedded demo */
  demoUrl: string;
  /** Absolute URL to a short muted preview clip; null when auto-capture hasn't run */
  previewClipUrl: string | null;
}

/**
 * A portfolio project derived at build time from a GitHub repo that carries
 * the `portfolio` topic.
 */
export interface Project {
  /** Repo name used as the URL slug, e.g. "MMM-Canvas" */
  slug: string;
  /** Repo name exactly as returned by GitHub */
  name: string;
  /** Human-readable title — repo description when available, otherwise the slug */
  title: string;
  /**
   * Markdown content fetched from the repo's PORTFOLIO.md file.
   * Empty string when the file is absent or unreachable.
   */
  blurbMarkdown: string;
  /** GitHub topics with "portfolio" removed */
  tags: string[];
  /** Full GitHub HTTPS URL, e.g. "https://github.com/SkylerGodfrey/MMM-Canvas" */
  repoUrl: string;
  /** Live demo URL from the pipeline manifest; null when no demo has been published */
  demoUrl: string | null;
  /** Short muted preview clip URL from the manifest; null when none exists */
  previewClipUrl: string | null;
  /** Content group this project belongs to — defaults to "dev" */
  contentGroup: string;
}
