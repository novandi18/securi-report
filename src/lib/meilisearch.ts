/**
 * Meilisearch client configuration.
 *
 * Server-side uses the ADMIN API key for indexing (create/update/delete).
 * Client-side uses a SEARCH-ONLY API key for querying.
 *
 * Environment variables:
 *   MEILISEARCH_HOST          – Meilisearch instance URL (e.g. http://localhost:7700)
 *   MEILISEARCH_ADMIN_KEY     – Admin / Master key (server-only, never expose)
 *   NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY – Search-only key (safe for browser)
 */

import { MeiliSearch } from "meilisearch";

// ─── Server-side admin client (for indexing) ──────────────
function getAdminClient() {
  const host = process.env.MEILISEARCH_HOST;
  const apiKey = process.env.MEILISEARCH_ADMIN_KEY;

  if (!host) {
    throw new Error("MEILISEARCH_HOST environment variable is not set.");
  }

  return new MeiliSearch({ host, apiKey: apiKey || undefined });
}

let _adminClient: MeiliSearch | null = null;

/** Lazy singleton for the server-side admin client */
export function adminClient(): MeiliSearch {
  if (!_adminClient) {
    _adminClient = getAdminClient();
  }
  return _adminClient;
}

// ─── Client-side search client ────────────────────────────
function getSearchClient() {
  const host = process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? process.env.MEILISEARCH_HOST;
  const apiKey = process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY;

  if (!host) {
    throw new Error("MEILISEARCH_HOST / NEXT_PUBLIC_MEILISEARCH_HOST is not set.");
  }

  return new MeiliSearch({ host, apiKey: apiKey || undefined });
}

let _searchClient: MeiliSearch | null = null;

/** Lazy singleton for the client-side search-only client */
export function searchClient(): MeiliSearch {
  if (!_searchClient) {
    _searchClient = getSearchClient();
  }
  return _searchClient;
}

// ─── Index Names ──────────────────────────────────────────
export const INDEX = {
  CUSTOMERS: "customers",
  REPORTS: "reports",
  TEMPLATES: "finding_templates",
} as const;

// ─── Index Configuration ─────────────────────────────────
/** Configure index settings — call once during reindex or setup */
export async function configureIndexes() {
  const client = adminClient();

  // Customers
  const customersIdx = client.index(INDEX.CUSTOMERS);
  await customersIdx.updateSettings({
    searchableAttributes: ["name", "email", "description"],
    displayedAttributes: ["id", "name", "email", "description"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
  });

  // Reports
  const reportsIdx = client.index(INDEX.REPORTS);
  await reportsIdx.updateSettings({
    searchableAttributes: [
      "title",
      "reportIdCustom",
      "customerName",
      "executiveSummary",
    ],
    displayedAttributes: [
      "id",
      "title",
      "reportIdCustom",
      "customerName",
      "status",
      "auditDate",
    ],
    filterableAttributes: ["status"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
  });

  // Finding Templates
  const templatesIdx = client.index(INDEX.TEMPLATES);
  await templatesIdx.updateSettings({
    searchableAttributes: [
      "title",
      "severity",
      "description",
      "impact",
      "recommendation",
    ],
    displayedAttributes: [
      "id",
      "title",
      "severity",
      "cvssScore",
    ],
    filterableAttributes: ["severity"],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
  });
}

// ─── Sync Helpers (used by server actions) ────────────────

/** Add or update a single document in an index */
export async function syncDocument(
  indexName: string,
  document: Record<string, unknown>,
) {
  try {
    const idx = adminClient().index(indexName);
    await idx.addDocuments([document]);
  } catch (error) {
    console.error(`[Meilisearch] Failed to sync document to ${indexName}:`, error);
    // Non-blocking: don't throw — DB is source of truth
  }
}

/** Remove a single document from an index */
export async function removeDocument(indexName: string, documentId: string) {
  try {
    const idx = adminClient().index(indexName);
    await idx.deleteDocument(documentId);
  } catch (error) {
    console.error(`[Meilisearch] Failed to remove document from ${indexName}:`, error);
  }
}

/** Replace all documents in an index (used for full reindex) */
export async function replaceAllDocuments(
  indexName: string,
  documents: Record<string, unknown>[],
) {
  try {
    const idx = adminClient().index(indexName);
    // deleteAllDocuments + addDocuments to do a full replace
    await idx.deleteAllDocuments();
    if (documents.length > 0) {
      await idx.addDocuments(documents);
    }
  } catch (error) {
    console.error(`[Meilisearch] Failed to replace documents in ${indexName}:`, error);
    throw error; // re-throw for reindex action to catch
  }
}
