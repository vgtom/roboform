/** Max binary size for a form field cover image stored in Postgres (BYTEA). */
export const MAX_FORM_FIELD_COVER_BYTES = 1024 * 1024;

export const FORM_FIELD_COVER_MIME_TYPES = [
  "image/jpeg",
  "image/png",
] as const;
