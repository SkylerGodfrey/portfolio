# Portfolio — Claude Context

## Project Overview

Personal portfolio site — **Astro** static site, deployed to GitHub Pages at
skylergodfrey.com. See `docs/overhaul-plan.md` for the full overhaul plan.

## Key Files

| File | Purpose |
|---|---|
| `src/pages/index.astro` | Home page (hero, projects grid, about) |
| `src/pages/card.astro` | 3D business card (Three.js, full-viewport) |
| `src/pages/projects/[slug].astro` | Project page template (PORTFOLIO.md + demo embed) |
| `src/pages/[group]/index.astro` | Group landing page (non-Dev groups) |
| `src/pages/[group]/[page].astro` | Content-group markdown page router |
| `src/lib/github.ts` | Build-time data layer — discovers repos, fetches PORTFOLIO.md + demo manifests |
| `src/lib/types.ts` | `Project` and `DemoManifest` types |
| `src/lib/contentGroups.ts` | `CONTENT_GROUPS` config — add/disable content groups here |
| `src/lib/businessCardButton.ts` | `BUSINESS_CARD_BUTTON` config — button visibility rules |
| `src/lib/fixtures.ts` | Fixture data used when `PORTFOLIO_FIXTURES=1` or API is unavailable |
| `src/content.config.ts` | Content collection schema (frontmatter validation for `pages`) |
| `src/layouts/Base.astro` | Shared HTML shell / layout |
| `astro.config.mjs` | Astro config (`site`, static output) |
| `public/` | Static assets copied verbatim at build (`CNAME`, `.nojekyll`, `.well-known/`) |
| `.github/workflows/deploy.yml` | Build + deploy to GitHub Pages; triggers: push/main, daily 06:00 UTC, `repository_dispatch` |
| `docs/workflows.md` | How-to recipes for all common tasks (start here) |
| `docs/content-groups.md` | Content groups deep-dive |
| `.claude/settings.local.json` | Claude Code permissions |

> The **Pokemon TCG Living Dex Tracker** has been moved to its own repo at
> `/Users/Skyler/Desktop/Skyler_Dev_Stuff/pokemon-tcg-tracker`.
