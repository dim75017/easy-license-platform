import { catalogAdminEmails } from "@/db/catalog-runtime";
import { CatalogApiError } from "./http";

export type CatalogIdentity = {
  userId: string;
  email: string;
};

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
