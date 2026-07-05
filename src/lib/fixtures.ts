/**
 * Fixture projects for local development and CI builds that don't hit the
 * live GitHub API.  Used when PORTFOLIO_FIXTURES=1 or when the API is
 * unreachable / rate-limited.
 *
 * Keep these realistic — they mirror the actual repos that will eventually
 * carry the `portfolio` topic once Terraform has applied.
 */

import type { Project } from './types.js';

export const FIXTURES: Project[] = [
  {
    slug: 'MMM-Canvas',
    name: 'MMM-Canvas',
    title: 'MagicMirror Canvas LMS Module',
    blurbMarkdown: `# MMM-Canvas

Displays upcoming Canvas LMS assignments on a MagicMirror² smart mirror.

## What this showcases
- OAuth token flow with the Canvas REST API
- Real-time countdown timers for assignment due dates
- Configurable course filtering and display limits
- MagicMirror² module architecture (frontend + Node helper)
`,
    tags: ['magicmirror', 'canvas-lms', 'javascript', 'education'],
    repoUrl: 'https://github.com/SkylerGodfrey/MMM-Canvas',
    demoUrl: null,
    previewClipUrl: null,
    contentGroup: 'dev',
    isPrivate: false,
  },
  {
    slug: 'MMM-Chores',
    name: 'MMM-Chores',
    title: 'MagicMirror Chores Tracker',
    blurbMarkdown: `# MMM-Chores

A MagicMirror² module that displays household chore schedules and tracks completion.

## What this showcases
- Persistent JSON state managed by the Node.js helper process
- Recurring schedule logic — daily, weekly, and custom intervals
- Clean at-a-glance UI layout built for mirror viewing distance
- IPC between the browser DOM module and the Node helper
`,
    tags: ['magicmirror', 'javascript', 'productivity'],
    repoUrl: 'https://github.com/SkylerGodfrey/MMM-Chores',
    demoUrl: null,
    previewClipUrl: null,
    contentGroup: 'dev',
    isPrivate: false,
  },
  {
    slug: 'pokemon-tcg-tracker',
    name: 'pokemon-tcg-tracker',
    title: 'Pokémon TCG Living Dex Tracker',
    blurbMarkdown: `# Pokémon TCG Living Dex Tracker

Full-stack app for tracking a Pokémon TCG living dex — one physical copy of
every card in every set ever printed.

## What this showcases
- PostgreSQL schema design for a large hierarchical dataset (sets → cards → variants)
- Incremental sync with the TCG API — only new sets and cards are fetched each run
- Filterable, sortable card grid with lazy-loaded card images
- Set and overall collection completion statistics
`,
    tags: ['typescript', 'postgresql', 'react', 'pokemon'],
    repoUrl: 'https://github.com/SkylerGodfrey/pokemon-tcg-tracker',
    demoUrl: 'https://skylergodfrey.com/demos/pokemon-tcg-tracker/',
    previewClipUrl: 'https://skylergodfrey.com/demos/pokemon-tcg-tracker/preview.mp4',
    contentGroup: 'dev',
    isPrivate: true,
  },
  {
    slug: 'MMM-Mascot',
    name: 'MMM-Mascot',
    title: 'MagicMirror Animated Mascot',
    blurbMarkdown: `# MMM-Mascot

Adds an animated character to a MagicMirror² display that reacts to the time
of day and to events broadcast by other modules.

## What this showcases
- CSS sprite-sheet animation driven by JavaScript state machine
- Event-driven cross-module communication via MagicMirror's notification bus
- Configurable mascot states and trigger conditions with sane defaults
`,
    tags: ['magicmirror', 'javascript', 'animation', 'css'],
    repoUrl: 'https://github.com/SkylerGodfrey/MMM-Mascot',
    demoUrl: null,
    previewClipUrl: null,
    contentGroup: 'dev',
    isPrivate: false,
  },
];
