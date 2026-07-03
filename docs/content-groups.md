# Content Groups

Content groups are the site's named sections — **Dev**, **Art**, **Soccer**, and
whatever comes next. Everything is config-driven: adding a group or a page never
requires template work.

## How it fits together

| Piece | File | Role |
|---|---|---|
| Group config | `src/lib/contentGroups.ts` | The single source of truth (`CONTENT_GROUPS`) |
| Group landing pages | `src/pages/[group]/index.astro` | One per enabled group (Dev = the home page `/`) |
| Group content pages | `src/pages/[group]/[page].astro` | Routes markdown at `/<group>/<slug>/` |
| Markdown content | `src/content/pages/<group>/<slug>.md` | The actual pages |
| Collection schema | `src/content.config.ts` | Frontmatter validation |
| Nav | `src/components/GroupNav.astro` | Rendered from the config automatically |

## Add a content group

Add one entry to `CONTENT_GROUPS` in `src/lib/contentGroups.ts`:

```ts
{ slug: 'woodworking', name: 'Woodworking', tagline: 'CNC projects and shop notes.', accent: 'orange', enabled: true },
```

That's it. The nav link, the landing page at `/woodworking/` (with a "coming
soon" card until content exists), and routing for its pages all follow from the
config. Set `enabled: false` to hide a group without deleting it.

## Add a page to a group

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

It appears on the group's landing page (newest first) and is routed at
`/soccer/2027-season-plan/`. While `draft: true`, the page gets no route and is
hidden from listings.

## How projects join a group

Each showcased project has a `contentGroup` field (see `src/lib/types.ts`),
defaulting to `"dev"`. Group landing pages show the project card grid (with tag
filtering) for any projects whose `contentGroup` matches. The planned convention
for setting it from GitHub is a `group:<slug>` topic in the repo's
`repository-definitions` entry — not implemented yet; today all discovered
projects land in Dev.
