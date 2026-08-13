import {
  catalogAdminEmails,
  catalogPipelineToken,
} from "@/db/catalog-runtime";
import { CatalogApiError } from "./http";

export type CatalogIdentity = {
  userId: string;
  email: string;
};

export type CatalogWriteIdentity =
  | { kind: "admin"; identity: CatalogIdentity }
  | { kind: "pipeline" };

export function requireCatalogIdentity(request: Request): CatalogIdentity {
  // These headers are injected by the private Sites access layer. Catalogue
  // APIs must not be exposed through a second origin that forwards client
  // supplied copies of them unchanged.
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();

  if (!userId || !email) {
    throw new CatalogApiError(
      "Sign in with ChatGPT to access the catalogue.",
      401,
      "authentication_required",
    );
  }

  return { userId, email };
}

export function requireCatalogAdmin(request: Request): CatalogIdentity {
  const identity = requireCatalogIdentity(request);
  const allowedEmails = catalogAdminEmails();

  // The write surface fails closed if the deployment has not explicitly
  // configured its owner allowlist. Hosting access rules remain an additional
  // perimeter; they are never treated as a substitute for API authorization.
  if (allowedEmails.size === 0) {
    throw new CatalogApiError(
      "Catalogue administration is not configured.",
      503,
      "admin_allowlist_unconfigured",
    );
  }

  if (!allowedEmails.has(identity.email)) {
    throw new CatalogApiError(
      "Catalogue administrator access is required.",
      403,
      "admin_access_required",
    );
  }

  return identity;
}

export async function requireCatalogPipeline(request: Request): Promise<void> {
  const configuredToken = catalogPipelineToken();
  if (!configuredToken || configuredToken.length < 32) {
    throw new CatalogApiError(
      "Catalogue pipeline authentication is not configured.",
      503,
      "pipeline_auth_unconfigured",
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/u.exec(authorization);
  const suppliedToken = match?.[1] ?? "";
  if (!suppliedToken || !(await constantTimeTokenMatch(configuredToken, suppliedToken))) {
    throw new CatalogApiError(
      "Catalogue pipeline authentication is required.",
      401,
      "pipeline_authentication_required",
    );
  }
}

export async function requireCatalogWrite(
  request: Request,
): Promise<CatalogWriteIdentity> {
  if (request.headers.has("authorization")) {
    await requireCatalogPipeline(request);
    return { kind: "pipeline" };
  }

  return { kind: "admin", identity: requireCatalogAdmin(request) };
}

async function constantTimeTokenMatch(
  expected: string,
  supplied: string,
): Promise<boolean> {
  // Hashing normalises both inputs to a fixed length. The XOR loop always
  // visits every byte and avoids an early-exit string comparison.
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const suppliedBytes = new Uint8Array(suppliedHash);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ suppliedBytes[index];
  }
  return difference === 0;
}
