/**
 * The largest deck a user can upload. Shared by the dropzone, which refuses
 * bigger files up front, and `/api/analyze`, which refuses them again in case
 * the browser check is skipped.
 *
 * The host sets the ceiling, not Next.js: Vercel cuts request bodies off at
 * ~4.5MB, and Lambda at 6MB after base64 encoding (so ~4.5MB of file). Past
 * either one the upload dies with an opaque 413 from the platform.
 */
export const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
