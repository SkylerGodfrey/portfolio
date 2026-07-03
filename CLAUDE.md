# Portfolio — Claude Context

## Project Overview

Personal portfolio site — **Astro** static site, deployed to GitHub Pages at
skylergodfrey.com. See `docs/overhaul-plan.md` for the full overhaul plan.

## Key Files

| File | Purpose |
|---|---|
| `src/pages/index.astro` | Home page (hero, about, projects placeholder) |
| `src/layouts/Base.astro` | Shared HTML shell / layout |
| `astro.config.mjs` | Astro config (`site`, static output) |
| `public/` | Static assets copied to the site root at build (`CNAME`, `.nojekyll`, `.well-known/`, `valentine_cards/`) |
| `.github/workflows/deploy.yml` | Build + deploy to GitHub Pages (withastro/action + deploy-pages) |
| `.claude/settings.local.json` | Claude Code permissions |

> The **Pokemon TCG Living Dex Tracker** has been moved to its own repo at
> `/Users/Skyler/Desktop/Skyler_Dev_Stuff/pokemon-tcg-tracker`.
