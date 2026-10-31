// Pages that must not appear in the generated sitemap. The form confirmation
// is a functional page, not a search landing page (LIP-91).
const EXCLUDED_PATHS = new Set(['/contact-us/thank-you/']);

/** @astrojs/sitemap `filter`: keep every page except the excluded paths. */
export const includeInSitemap = (page) => !EXCLUDED_PATHS.has(new URL(page).pathname);
