/**
 * Floating business-card button configuration.
 *
 * Visibility rules (PORT-20):
 *   - `enabled: false`            → the button appears on NO pages.
 *   - `enabled: true, pages: []`  → the button appears on ALL pages.
 *   - `enabled: true, pages: [...]` → the button appears ONLY on the declared
 *     pages. Entries are pathnames ("/", "/soccer/") or prefix patterns ending
 *     in "*" ("/projects/*"). Trailing slashes are normalized.
 *
 * The /card/ page is always excluded — the card is already there.
 */

export interface BusinessCardButtonConfig {
  enabled: boolean;
  pages: string[];
}

export const BUSINESS_CARD_BUTTON: BusinessCardButtonConfig = {
  enabled: true,
  pages: [], // empty = every page; add paths to restrict
};

function normalize(path: string): string {
  return path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function showBusinessCardButton(
  pathname: string,
  config: BusinessCardButtonConfig = BUSINESS_CARD_BUTTON,
): boolean {
  if (!config.enabled) return false;
  const path = normalize(pathname);
  if (path === '/card') return false;
  if (config.pages.length === 0) return true;
  return config.pages.some((entry) => {
    if (entry.endsWith('*')) return path.startsWith(normalize(entry.slice(0, -1)));
    return path === normalize(entry);
  });
}
