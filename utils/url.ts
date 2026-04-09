
/**
 * Tracking/campaign query parameters that should be stripped from URLs
 * before using them as canonical keys for annotations.
 */
const TRACKING_PARAMS = [
  // Facebook
  'fbclid',
  // Google
  'gclid', 'gclsrc',
  // Google Analytics / UTM
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  // Microsoft / Bing
  'msclkid',
  // HubSpot
  '_hsenc', '_hsmi', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
  // Mailchimp
  'mc_cid', 'mc_eid',
  // Twitter / X
  'twclid',
  // TikTok
  'ttclid',
  // LinkedIn
  'li_fat_id',
  // Pinterest
  'epik',
  // Snapchat
  'ScCid',
];

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash from pathname if present
    u.pathname = u.pathname.replace(/\/$/, '') || '/';
    // Strip known tracking/campaign parameters
    for (const param of TRACKING_PARAMS) {
      u.searchParams.delete(param);
    }
    return u.href;
  } catch {
    return url; // fallback for invalid URLs
  }
};

// ─── Site-slug helpers ───────────────────────────────────────────────────────

/**
 * Convert an origin to a URL-friendly slug stored in the `websites` table.
 *   "https://plato.stanford.edu" → "plato-stanford-edu"
 *   "https://www.cambridge.org"  → "cambridge-org"
 *   "https://en.wikipedia.org"   → "en-wikipedia-org"
 *
 * www. is stripped so the slug stays short and recognisable.
 * Slug uniqueness is enforced by the database (see /api/websites).
 */
export function originToSlug(origin: string): string {
  try {
    const host = new URL(origin).hostname.toLowerCase().replace(/^www\./, '');
    return host.replace(/\./g, '-');
  } catch {
    return origin
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}


/**
 * Reconstruct the original page URL from its component parts.
 *   ("https://plato.stanford.edu", ["entries", "axiom-choice"], "?section=3")
 *   → "https://plato.stanford.edu/entries/axiom-choice?section=3"
 */
export function appPathToPageUrl(
  origin: string,
  pathSegments: string[] | undefined,
  search: string,
): string {
  const path = pathSegments?.length ? '/' + pathSegments.join('/') : '/';
  return normalizeUrl(`${origin}${path}${search}`);
}
