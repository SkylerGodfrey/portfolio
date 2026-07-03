// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Custom domain (CNAME -> skylergodfrey.com); served from the site root.
  site: 'https://skylergodfrey.com',
  base: '/',
  // Static output for GitHub Pages.
  output: 'static',
});
