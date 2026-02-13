/**
 * Environment utilities.
 *
 * Uses NEXT_PUBLIC_APP_ENV (client + server) with a fallback to NODE_ENV.
 * All dev-only seeding features MUST check `isDevelopment()` on the server
 * and `isDevClient` on the client before rendering or executing.
 */

/** Server-side check — call inside Server Actions / API routes */
export function isDevelopment(): boolean {
  return (
    process.env.NEXT_PUBLIC_APP_ENV === "development" ||
    process.env.NODE_ENV === "development"
  );
}

/** Server-side guard — throws if not in development */
export function assertDevelopment(): void {
  if (!isDevelopment()) {
    throw new Error("Action not allowed in this environment");
  }
}

/**
 * Client-side constant for conditional rendering.
 * Since NEXT_PUBLIC_ vars are inlined at build time this is safe.
 */
export const isDevClient =
  process.env.NEXT_PUBLIC_APP_ENV === "development" ||
  process.env.NODE_ENV === "development";
