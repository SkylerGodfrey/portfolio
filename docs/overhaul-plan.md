# Portfolio Overhaul — Execution Plan

_Interviewed & planned 2026-07-03. Tracked in YouTrack project "Portfolio"._

## Decisions (from interview)

| Decision | Choice |
|---|---|
| Site stack | **Astro** static site, deployed to GitHub Pages (keep `CNAME` → skylergodfrey.com) |
| Project flagging | **GitHub topics via Terraform** in `repository-definitions` — a `portfolio` topic flags inclusion; additional topics (`electron`, `3d`, `video-game`, …) become the project's tags |
| Project write-ups | **`PORTFOLIO.md`** in each flagged repo (what it showcases, highlights); fetched at site build time |
| Demo publishing | **Shared reusable GitHub Actions workflow** owned by repository-definitions; each project supplies a build command that outputs a static bundle; workflow publishes it to a demos location the portfolio iframes |
| Hover previews | **Short muted video clips**, auto-captured by the pipeline (headless Chrome) with **per-project manual override** |
| 3D business card | **Three.js, modeled procedurally in code** (no external asset) |
| Design direction | **Playful personal brand** — hockey, gaming, CNC, dogs/cats, Utah mountains |
| Phasing | **Foundation first** (site → pipeline → 3D card → docs) |
| First showcases | MMM-* MagicMirror modules, Pokemon TCG Tracker, Godot demo repos for FishyCarnival concepts (e.g. pathfinding) — FishyCarnival itself is early in development |

## UX / Design Direction — "Everything is a Card"

Unifying concept: the whole site trades in **collectible cards** — it ties together the
Pokemon TCG tracker, the project thumbnails, and the literal 3D business card.

- **Aesthetic**: warm "workshop + trail map" feel. Cream paper base (`#F7F2E7`), deep ink
  (`#1E2422`), accents of burnt orange (`#E4572E`), pine green (`#2F5D50`), and sky blue
  (`#87BCDE`). Subtle grain/noise overlay; card surfaces with soft layered shadows.
- **Typography**: characterful display font (e.g. Bricolage Grotesque) for headings,
  highly readable humanist body font, monospace (e.g. IBM Plex Mono) for tags/tech chips.
  No Inter/Roboto/system-font defaults.
- **Home page**:
  - Hero: name + tagline over a layered Utah-mountain-skyline SVG with gentle parallax;
    small easter-egg details (dog/cat silhouette, hockey puck, CNC bit) hidden in the scene.
  - Project grid: trading-card-style tiles, slightly offset/rotated for a hand-placed feel.
    On hover a card lifts with a 3D perspective tilt and its muted video preview fades in;
    tag badges (styled like card "energy" icons) reveal along the bottom.
  - Tag filter: chip row above the grid; selecting chips filters cards with a smooth
    FLIP-style reorder animation.
  - Content-group nav: Dev (default) / Art / Soccer, extensible.
- **Project page**: card-motif hero (title, tags, repo link), "What this showcases" section
  rendered from the repo's `PORTFOLIO.md`, then the embedded live demo in a framed
  "card table" container with a fullscreen toggle and graceful fallback (preview video +
  repo link) when a demo isn't published.
- **3D business card page**: full-viewport Three.js scene; card floats with idle motion,
  drag/inertia to flip and spin; front = identity, back = contact/QR.
- **Floating card button**: small circular button that floats *above* page content
  (fixed, high z-index, drop shadow so it reads as "on the screen"); opens the 3D card.
  Visibility rule: pages declare themselves in a config list — if the list has entries the
  button appears only on those pages; if the config is empty/unset it appears on all pages;
  if explicitly disabled it appears nowhere.
- **Hidden 3D world** (future): non-linked route (e.g. `/explore`) with an explorable 3D
  scene themed hockey / gaming / CNC / cooking with Utah mountains, dogs & cats as scenery.

## Architecture

### Data flow (build time)
1. Astro build queries the GitHub API for repos owned by SkylerGodfrey with topic `portfolio`.
2. For each repo: remaining topics → tags; `PORTFOLIO.md` → write-up; demo/preview manifest
   (published by the pipeline) → demo URL + preview clip URL.
3. Project pages and grid entries are generated statically. A scheduled/`repository_dispatch`
   rebuild keeps the site current when repos or demos change.

### Demo pipeline (owned by repository-definitions)
- **Contract**: a flagged repo provides a `portfolio-demo` config (build command, output dir,
  optional capture script, optional manual preview clip path).
- **Reusable workflow** (`repository-definitions` publishes it): checkout → run project build →
  upload static bundle to the demos location (per-project path) → auto-capture preview clip in
  headless Chrome unless a manual clip is supplied → write/update the project's demo manifest →
  trigger portfolio rebuild.
- **Stack adapters** because tech stacks differ:
  - *Web/Node*: generic static build.
  - *Godot*: HTML5/WASM export template (enables FishyCarnival concept demos like pathfinding).
  - *MagicMirror modules*: a lightweight MagicMirror shell harness that mounts the module with
    fixture data and builds to a static bundle.
- **Terraform**: `github-repo` module gains portfolio conventions (topic validation, standard
  secrets/permissions for the shared workflow, e.g. token to publish demos & dispatch rebuilds).

### Content groups
- Groups (Dev, Art, Soccer, …) are config-driven: each has a landing page with the same card
  grid template; pages within a group live under its route. Adding a group = one config entry
  + content, no template work.

## Phases

- **Phase 1 — Foundation**: Astro scaffold + deploy, design system, home page (hero, card grid,
  hover previews with placeholder media, tag filter), project page template, content groups,
  GitHub data layer, Terraform topic conventions + flag initial repos.
- **Phase 2 — Demo pipeline**: contract + reusable workflow, demos hosting/publishing + auth,
  auto preview capture w/ override, Godot + MagicMirror adapters, onboard first three demos.
- **Phase 3 — 3D business card**: Three.js card page, floating overlay button + visibility config.
- **Phase 4 — Documentation**: workflows for adding projects, pages, content groups, demo
  configuration, preview overrides.
- **Backlog**: hidden explorable 3D world page.
