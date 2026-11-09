/** A Google Analytics 4 measurement ID, such as `G-ABC123XYZ9`. */
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;

/**
 * The GA4 measurement ID this build sends usage statistics to (`VITE_GA_MEASUREMENT_ID`),
 * or null to build without them. The ID is public: it is part of the page, like the Google
 * Drive settings. A value that is not a measurement ID counts as missing. Only production
 * builds send statistics: the dev server never does, so working on the app cannot skew them.
 */
export function analyticsConfig(
  env: Readonly<Record<string, unknown>> = import.meta.env,
): { measurementId: string } | null {
  if (env.PROD !== true) return null;
  const value = env.VITE_GA_MEASUREMENT_ID;
  const id = typeof value === 'string' ? value.trim() : '';
  return MEASUREMENT_ID.test(id) ? { measurementId: id } : null;
}
