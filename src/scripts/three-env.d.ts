/*
 * The `three` package ships no type definitions and PORT-19 keeps it the
 * only new dependency (no @types/three). This ambient shim keeps editors
 * and `astro check` quiet; the runtime API used in businessCard.ts is the
 * stable documented surface.
 */
declare module 'three';
