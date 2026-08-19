import { env } from "cloudflare:workers";

type CatalogRuntimeEnv = {
  DB?: D1Database;
  AUDIO?: R2Bucket;
  CATALOG_ADMIN_EMAILS?: string;
  CATALOG_PIPELINE_TOKEN?: string;
  GOOGLE_DRIVE_ACCESS_TOKEN?: string;
};

function runtimeEnv(): CatalogRuntimeEnv {
  return env as unknown as CatalogRuntimeEnv;
}

export function requireCatalogDatabase(): D1Database {
  const database = runtimeEnv().DB;
  if (!database) {
    throw new Error("Catalog database binding is unavailable.");
  }
  return database;
}

export function requireCatalogAudioBucket(): R2Bucket {
  const bucket = runtimeEnv().AUDIO;
  if (!bucket) {
    throw new Error("Catalog audio storage binding is unavailable.");
  }
  return bucket;
}

export function catalogAdminEmails(): ReadonlySet<string> {
  const configured = runtimeEnv().CATALOG_ADMIN_EMAILS ?? "";
  return new Set(
    configured
      .split(/[\s,;]+/u)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function catalogPipelineToken(): string | null {
  const token = runtimeEnv().CATALOG_PIPELINE_TOKEN?.trim();
  return token || null;
}

export function googleDriveAccessToken(): string | null {
  const token = runtimeEnv().GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
  return token || null;
}
