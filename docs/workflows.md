# Portfolio Workflows

Single entry-point for "how do I…" questions about the skylergodfrey.com
portfolio. Each section is a numbered recipe — copy the paths, swap the names,
done. Where a deeper doc exists this guide links rather than repeats.

**Jump to:**
[1. Add a showcase project](#1-add-a-new-showcase-project) ·
[2. Onboard a live demo](#2-onboard-a-projects-live-demo) ·
[3. Override the hover preview clip](#3-override-or-customize-the-hover-preview-clip) ·
[4. Add a page or content group](#4-add-a-content-page-or-a-new-content-group) ·
[5. Business-card button](#5-configure-the-floating-business-card-button) ·
[6. Deploy and rebuild](#6-deployrebuild-mechanics) ·
[7. Repository map](#7-repository-map)

---

## 1. Add a new showcase project

A project card appears on the site when its GitHub repo carries the topic
`portfolio`. Topics are managed by Terraform in `repository-definitions`.

Full topic/naming reference: `repository-definitions/docs/portfolio-showcase.md`.

**Step 1. Declare the repo in `repository-definitions/repos/<your-repo>/terragrunt.hcl`**

```hcl
inputs = {
  name        = "my-project"
  description = "One-line description (becomes the card title)."
  visibility  = "public"      # see private-repo caveat below
  portfolio   = true
  topics      = ["typescript", "react", "web-app"]
  has_issues  = true
  has_wiki    = false
  has_projects = false
}
```

`portfolio = true` causes the `github-repo` module to inject the `portfolio`
topic automatically. Do **not** add `portfolio` to the `topics` list — the
module deduplicates it (`_modules/github-repo/main.tf`). Every other topic
becomes a display tag on the project card.

**Step 2. Apply** (manual, run from the unit directory)

```bash
cd repository-definitions/repos/my-project
terragrunt apply
```

If the repo already exists on GitHub and its state isn't imported yet, run
`terragrunt import github_repository.this my-project` first.
Full import flow: `repository-definitions/docs/managing-repos.md`.

**Step 3. Write `PORTFOLIO.md` in the project repo**

The site fetches `PORTFOLIO.md` from the repo's default branch at build time
(`src/lib/github.ts`). Missing or unreachable → the card has no blurb
(graceful, not an error). Write whatever visitors should read on the project
page.

**Step 4. Optionally onboard a live demo** — see [Workflow 2](#2-onboard-a-projects-live-demo).

**Step 5. The site picks it up** on the next scheduled or manually triggered
build. See [Workflow 6](#6-deployrebuild-mechanics).

### Private repos (read-only PAT)

The site discovers repos via the GitHub Search API. The Actions ephemeral
`GITHUB_TOKEN` is scoped only to the `portfolio` repo, so it will **not** return
private repos — the build logs `0 repo(s) with topic:portfolio` even though the
`portfolio` topic is applied. To showcase private repos (e.g. the flagged `MMM-*`
modules and `Pokemon-tracker`, all `visibility = "private"`), give the build a
dedicated read-only PAT:

**1. Create a fine-grained read-only PAT** (manual, one-time):

GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token:

- **Name:** `portfolio-read`
- **Expiration:** 90 days (rotate on expiry)
- **Repository access:** the flagged private repos (or **All repositories** for
  simplicity — the token is read-only either way).
- **Permissions:** Contents: **Read-only**, Metadata: **Read-only** (auto). No
  write scopes are needed — the build only reads.

**2. Store it on the `portfolio` repo** as `PORTFOLIO_READ_TOKEN`:

```bash
gh secret set PORTFOLIO_READ_TOKEN \
  --repo SkylerGodfrey/portfolio \
  --body "github_pat_XXXX"
```

The build step reads `${{ secrets.PORTFOLIO_READ_TOKEN || secrets.GITHUB_TOKEN }}`
(`.github/workflows/deploy.yml`), so it uses the PAT when present and falls back
to the Actions token otherwise. When a token is present, `src/lib/github.ts`
fetches `PORTFOLIO.md` through the authenticated Contents API instead of
`raw.githubusercontent.com`, so private blurbs resolve too.

**What differs for a private project on the site:**

- The **"View on GitHub" link is hidden** — a private repo URL isn't publicly
  reachable, so the project page shows a muted `source: private` note instead
  (`ProjectHero.astro` / `DemoFrame.astro`, driven by `Project.isPrivate`).
- **Live demos still work.** The demo pipeline runs inside the project repo, so
  it can build and publish the bundle regardless of the repo's visibility. The
  embed and hover preview behave exactly as for public projects.

---

## 2. Onboard a project's live demo

A live demo gives the project page an embeddable iframe and supplies the hover
preview clip. The demo is served at `skylergodfrey.com/demos/<slug>/`.

**Prerequisite:** the repo must be flagged first (Workflow 1).

Full reference: `repository-definitions/docs/demo-pipeline.md`.

### A. Create `portfolio-demo.json` in the project repo

Place it at the repo root. Required fields: `buildCommand` and `outputDir`.

```json
{
  "buildCommand": "npm ci && npm run demo:build",
  "outputDir": "demo-dist"
}
```

| Field | Required | Notes |
|---|---|---|
| `buildCommand` | yes | Shell command; runs on `ubuntu-latest` with Node pre-installed |
| `outputDir` | yes | Must contain `index.html`; default size cap is 50 MB |
| `slug` | no | Defaults to the repo name — keep it equal to the repo name |
| `previewClip` | no | Manual preview clip override — see [Workflow 3](#3-override-or-customize-the-hover-preview-clip) |
| `captureScript` | no | Custom auto-capture driver — see [Workflow 3](#3-override-or-customize-the-hover-preview-clip) |

JSON Schema: `repository-definitions/pipeline/portfolio-demo.schema.json`.

### B. Add the caller workflow to the project repo

Copy `repository-definitions/pipeline/caller-workflow.template.yml` to
`.github/workflows/portfolio-demo.yml` in the project repo:

```yaml
name: Publish portfolio demo

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  demo:
    uses: SkylerGodfrey/portfolio-demos/.github/workflows/portfolio-demo.yml@main
    secrets:
      PORTFOLIO_PIPELINE_TOKEN: ${{ secrets.PORTFOLIO_PIPELINE_TOKEN }}
```

For Godot and MagicMirror module projects, use the stack-specific templates
instead (see [Per-stack notes](#per-stack-notes) below).

### C. Set the `PORTFOLIO_PIPELINE_TOKEN` secret (manual, one-time per project repo)

The pipeline pushes built bundles to `portfolio-demos` and dispatches a rebuild
trigger to `portfolio`. The built-in `GITHUB_TOKEN` cannot make those
cross-repo writes, so a fine-grained PAT is needed.

**1. Create the PAT** (manual, one-time):

GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token:

- **Name:** `portfolio-pipeline`
- **Expiration:** 90 days (rotate on expiry)
- **Repository access → Only select repositories:** `portfolio-demos` and `portfolio`
- **Permissions:** Contents: Read and write on both; Metadata: Read-only (auto)

**2. Set it on the project repo** (recommended — keeps the value out of Terraform state):

```bash
gh secret set PORTFOLIO_PIPELINE_TOKEN \
  --repo SkylerGodfrey/my-project \
  --body "github_pat_XXXX"
```

Or via the UI: project repo → Settings → Secrets and variables → Actions →
New repository secret → name `PORTFOLIO_PIPELINE_TOKEN`.

For the Terraform-managed alternative and its state-file caveat, see
`repository-definitions/docs/demo-pipeline.md` ("Auth setup").

### D. Push to main (or run the workflow manually)

The reusable workflow will:
1. Checkout the project repo
2. Run `buildCommand`
3. Validate `outputDir/index.html` exists and bundle is within the size cap
4. Capture a preview clip (unless `previewClip` is set — see Workflow 3)
5. Write `manifest.json` (`{ demoUrl, previewClipUrl }`)
6. Commit and push the bundle + manifest to `portfolio-demos/<slug>/`
7. Dispatch `portfolio-content-updated` → portfolio site rebuilds

The demo will be live at `skylergodfrey.com/demos/<slug>/` after the site
rebuild completes.

### Per-stack notes

| Stack | Template to use | Full guide |
|---|---|---|
| Plain web / Node | `pipeline/caller-workflow.template.yml` | `demo-pipeline.md` |
| Godot 4.x HTML5/WASM | `pipeline/adapter-godot.template.yml` | `demo-adapters.md` |
| MagicMirror module (MMM-*) | `pipeline/adapter-mmm.template.yml` | `demo-adapters.md` |

**Godot.** The `buildCommand` must download the headless Godot binary and Web
export templates itself (composite Actions cannot run before a reusable
workflow's job). Vendor the export script as `scripts/godot-export.sh` — full
script in `repository-definitions/docs/demo-adapters.md`. The script pins Godot
4.3-stable, runs the Web export, and injects `coi-serviceworker.min.js` so
SharedArrayBuffer works on GitHub Pages (Godot 4 web exports require
cross-origin isolation, which the static host cannot set via headers; the shim
handles it client-side). Godot WASM bundles are large — raise `size-cap-mb` in
the caller `with:` block if needed (default 50 MB).

**MagicMirror modules.** `buildCommand` fetches the static harness
(`index.html`, `harness.js`, `harness.css`) from `portfolio-demos` at build
time and combines it with the module's front-end files and a `demo.config.json`
fixture. Vendor the build script as `scripts/demo-build.sh` — full script in
`repository-definitions/docs/demo-adapters.md`. The harness stubs the full
MagicMirror front-end API (Module.register, lifecycle, notifications, config
merge). No MagicMirror install, no `node_helper` — fully static at runtime.

---

## 3. Override or customize the hover preview clip

Precedence (first match wins): **manual `previewClip` > auto-captured clip > `null`**.

### Option A — Commit a manual clip (full control)

Commit a short muted video in the project repo and declare it in
`portfolio-demo.json`:

```json
{
  "buildCommand": "...",
  "outputDir": "demo-dist",
  "previewClip": "media/preview.webm"
}
```

The pipeline copies the file next to the bundle and sets
`previewClipUrl` to `https://skylergodfrey.com/demos/<slug>/<filename>`.
Auto-capture is skipped entirely when `previewClip` is set.

### Option B — Custom auto-capture script

To drive specific footage (click a button, start a game, step through a flow)
without committing a pre-made clip, add an ES module and reference it:

```json
{
  "buildCommand": "...",
  "outputDir": "demo-dist",
  "captureScript": "media/capture.mjs"
}
```

The module must export a default `async (page) => void`, where `page` is the
Puppeteer `Page` that is being recorded:

```js
// media/capture.mjs
export default async function drive(page) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await page.waitForSelector('#start', { timeout: 5000 });
  await page.click('#start');
  await sleep(3000);
}
```

`captureScript` is ignored when `previewClip` is also set. If the script
throws, the clip is kept up to the failure point and a warning is annotated;
the publish is not failed.

### Default auto-capture (no override)

When neither field is set, the pipeline records a ~6–8 s muted WebM at 800×500:
waits for `load` + web fonts, does a gentle full-page autoscroll down and back,
then a short idle. Clips over ~4 MB are re-encoded/trimmed (VP9, ≤640px, ≤6 s);
if they still exceed the cap, `previewClipUrl` degrades to `null` — no build
failure.

Source of truth: `repository-definitions/pipeline/capture-preview.mjs`.
Terraform deploys it to `portfolio-demos/pipeline/capture-preview.mjs`; the
reusable workflow fetches it from there at run time.

---

## 4. Add a content page or a new content group

Content groups are the site's named sections (Dev, Art, Soccer, …). Full
reference: `portfolio/docs/content-groups.md`.

### Add a page to an existing group

Create `src/content/pages/<group>/<slug>.md`:

```markdown
---
group: soccer
title: 2027 Season Plan
description: Formations and rotations for the 2027 season.
date: 2027-03-01
draft: false
---

Content here…
```

- `group` must match a `slug` in `CONTENT_GROUPS` (`src/lib/contentGroups.ts`).
- `draft: true` — excluded from the group landing and gets no route.
- Routed at `/<group>/<slug>/` by `src/pages/[group]/[page].astro`.
- Full frontmatter schema: `src/content.config.ts`.

### Add a new content group

Add one entry to `CONTENT_GROUPS` in `src/lib/contentGroups.ts`:

```ts
{
  slug: 'woodworking',
  name: 'Woodworking',
  tagline: 'CNC projects and shop notes.',
  accent: 'orange',   // 'orange' | 'pine' | 'sky'
  enabled: true,
},
```

That's it. The nav link, the landing page at `/woodworking/`, and routing for
its markdown pages all derive from this config entry. Set `enabled: false` to
hide a group without removing the config entry.

> **Project cards in groups.** The `contentGroup` field on each `Project`
> defaults to `"dev"` (hardcoded in `src/lib/github.ts`). A planned
> `group:<slug>` topic convention to assign projects to non-Dev groups is
> **not yet implemented** — all discovered projects currently land in Dev.

---

## 5. Configure the floating business-card button

File: `src/lib/businessCardButton.ts` — edit the `BUSINESS_CARD_BUTTON` export.

```ts
export const BUSINESS_CARD_BUTTON: BusinessCardButtonConfig = {
  enabled: true,
  pages: [], // empty = every page; add paths to restrict
};
```

| Config | Behaviour |
|---|---|
| `enabled: false` | Button never appears on any page |
| `enabled: true, pages: []` | Button appears on every page |
| `enabled: true, pages: ['/soccer/', '/projects/*']` | Button appears only on declared paths |

**Path syntax:**

- Exact pathname: `"/"`, `"/soccer/"`.
- Prefix wildcard: `"/projects/*"` — matches any pathname starting with `/projects/`.
- Trailing slashes are normalized before matching.
- `/card` is **always excluded** regardless of config — the card is already
  on that page.

The matching logic is in `showBusinessCardButton(pathname, config)` in the
same file; it is called by `src/components/BusinessCardButton.astro`.

---

## 6. Deploy/rebuild mechanics

### Triggers

The deploy workflow (`.github/workflows/deploy.yml`) runs on:

| Event | When |
|---|---|
| Push to `main` | Every commit on the default branch |
| Schedule | Daily at **06:00 UTC** — picks up `PORTFOLIO.md` edits and new topics |
| `repository_dispatch: portfolio-content-updated` | Dispatched by the demo pipeline after publishing a new bundle |
| `workflow_dispatch` | Manual run from the Actions tab |

### What a build does

1. **Fetch demos.** Shallow-clones `SkylerGodfrey/portfolio-demos` into
   `public/demos/` (`--depth 1`) so demo bundles and `manifest.json` files
   are served same-origin at `skylergodfrey.com/demos/<slug>/`. The
   `public/demos/` directory is gitignored.
2. **Astro build.** `withastro/action@v3` builds the site. During the build,
   `src/lib/github.ts` searches the GitHub API for repos owned by
   `SkylerGodfrey` with the `portfolio` topic, then fetches `PORTFOLIO.md`
   and `manifest.json` for each. Results are memoised in-process so the API
   is only called once per build.
3. **Deploy.** `actions/deploy-pages@v4` pushes the built artifact to GitHub
   Pages.

### Manual rebuild trigger

```bash
gh workflow run deploy.yml --repo SkylerGodfrey/portfolio
```

Or push any commit to `main`.

### GitHub Pages source (manual, one-time setup)

For `deploy-pages` to work, Pages must be set to deploy from Actions:

> portfolio repo on GitHub → Settings → Pages → **Source: GitHub Actions**

This is a one-time click in the GitHub UI; it persists until changed.

### Local development — fixture mode

```bash
PORTFOLIO_FIXTURES=1 npm run dev
```

With `PORTFOLIO_FIXTURES=1`, `src/lib/github.ts` loads the hardcoded fixture
data from `src/lib/fixtures.ts` instead of calling the GitHub API. The fixture
also fires automatically as a fallback when the API is unreachable or
rate-limited.

---

## 7. Repository map

| Repo | Visibility | Role |
|---|---|---|
| `SkylerGodfrey/portfolio` | public | The Astro site — all source code, deploy workflow, and `docs/` |
| `SkylerGodfrey/repository-definitions` | private | Terraform/Terragrunt for all repos; pipeline source of truth (`pipeline/`) |
| `SkylerGodfrey/portfolio-demos` | public | Built demo bundles + manifests + reusable publish workflow; Terraform-managed — **never hand-edit** |

**Who owns what:**

| Thing to change | Where to change it |
|---|---|
| Project topics / portfolio flag | `repository-definitions/repos/<name>/terragrunt.hcl` → `terragrunt apply` |
| Reusable publish workflow | `repository-definitions/pipeline/portfolio-demo.yml` → re-apply `repos/portfolio-demos` unit |
| MMM harness files | `repository-definitions/pipeline/mmm-harness/` → re-apply `repos/portfolio-demos` unit |
| Preview capture script | `repository-definitions/pipeline/capture-preview.mjs` → re-apply `repos/portfolio-demos` unit |
| Content group config | `portfolio/src/lib/contentGroups.ts` |
| Business-card button config | `portfolio/src/lib/businessCardButton.ts` |
| Site docs | `portfolio/docs/` |
| Infrastructure docs | `repository-definitions/docs/` |
