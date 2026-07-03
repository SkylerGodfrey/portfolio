/**
 * Content group configuration.
 *
 * A "content group" is a named section of the site (Dev, Art, Soccer, …).
 * Adding a new group requires only a new entry in CONTENT_GROUPS — no template
 * work. See docs/content-groups.md for the full workflow.
 *
 * Fields:
 *   slug    — URL segment and primary key used throughout the system.
 *   name    — Display name for nav links and headings.
 *   tagline — One-line description shown on the group landing page.
 *   accent  — Palette accent token ('orange' | 'pine' | 'sky').
 *   enabled — Set false to hide a group without deleting the config entry.
 */

export type AccentToken = 'orange' | 'pine' | 'sky';

export interface ContentGroup {
  slug: string;
  name: string;
  tagline: string;
  accent: AccentToken;
  enabled: boolean;
}

export const CONTENT_GROUPS: ContentGroup[] = [
  {
    slug: 'dev',
    name: 'Dev',
    tagline: 'Software projects, tools, and experiments.',
    accent: 'pine',
    enabled: true,
  },
  {
    slug: 'art',
    name: 'Art',
    tagline: 'Creative work, visuals, and design explorations.',
    accent: 'orange',
    enabled: true,
  },
  {
    slug: 'soccer',
    name: 'Soccer',
    tagline: 'Season plans, field notes, and match stats.',
    accent: 'sky',
    enabled: true,
  },
];

/** Return all enabled content groups in config order. */
export function getEnabledGroups(): ContentGroup[] {
  return CONTENT_GROUPS.filter((g) => g.enabled);
}

/** Look up a group by slug (enabled groups only). Returns undefined if not found. */
export function getContentGroup(slug: string): ContentGroup | undefined {
  return CONTENT_GROUPS.find((g) => g.slug === slug && g.enabled);
}

/**
 * Canonical href for a content group.
 * "dev" maps to the home page ("/"); all others get "/<slug>/".
 */
export function groupHref(slug: string): string {
  return slug === 'dev' ? '/' : `/${slug}/`;
}
