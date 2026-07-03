import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * "pages" — markdown pages that live inside a content group (Dev/Art/Soccer…).
 * File location: src/content/pages/<group>/<slug>.md
 * Routed at /<group>/<slug>/ by src/pages/[group]/[page].astro.
 * Drafts are excluded from routes and listings.
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    group: z.string(),
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { pages };
