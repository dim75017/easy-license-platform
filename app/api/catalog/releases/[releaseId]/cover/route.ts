import {
  requireCatalogAudioBucket,
  requireCatalogDatabase,
} from "@/db/catalog-runtime";
import {
  catalogErrorResponse,
  CatalogApiError,
  requiredPositiveId,
} from "../../../_lib/http";
import {
  publicCatalogOptionsResponse,
  publicCatalogResponse,
} from "../../../_lib/public-read";
import {
  COVER_CACHE_CONTROL,
  COVER_THUMBNAIL_FALLBACK_CACHE_CONTROL,
  coverThumbnailStorageKey,
  ifNoneMatchMatches,
} from "../../../_lib/cover-artwork";

type RouteContext = { params: Promise<{ releaseId: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { releaseId: rawReleaseId } = await context.params;
    const releaseId = requiredPositiveId(rawReleaseId, "releaseId");
    const database = requireCatalogDatabase();
    const release = await database
      .prepare(
        `SELECT r.cover_storage_key
         FROM releases r
         WHERE r.id = ?
           AND r.status = 'published'
           AND EXISTS (
             SELECT 1
             FROM tracks t
             WHERE t.release_id = r.id
               AND t.status = 'published'
               AND t.rights_status = 'cleared'
           )
         LIMIT 1`,
      )
      .bind(releaseId)
      .first<{ cover_storage_key: string | null }>();

    if (!release?.cover_storage_key) {
      throw new CatalogApiError("Cover artwork is unavailable.", 404, "cover_not_found");
    }

    const url = new URL(request.url);
    const variant = url.searchParams.get("variant");
    if (variant !== null && variant !== "thumbnail") {
      throw new CatalogApiError("Unknown cover variant.", 400, "cover_variant_invalid");
    }
    const bucket = requireCatalogAudioBucket();
    const thumbnailStorageKey = variant === "thumbnail"
      ? coverThumbnailStorageKey(releaseId, release.cover_storage_key)
      : null;
    let object = thumbnailStorageKey ? await bucket.get(thumbnailStorageKey) : null;
    const thumbnailFallback = variant === "thumbnail" && !object;
    object ??= await bucket.get(release.cover_storage_key);
    if (!object) {
      throw new CatalogApiError("Cover artwork is unavailable.", 404, "cover_not_found");
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set(
      "Cache-Control",
      thumbnailFallback
        ? COVER_THUMBNAIL_FALLBACK_CACHE_CONTROL
        : COVER_CACHE_CONTROL,
    );
    headers.set("X-Cover-Variant", thumbnailFallback ? "original-fallback" : variant ?? "original");
    headers.set("X-Content-Type-Options", "nosniff");
    if (ifNoneMatchMatches(request.headers.get("if-none-match"), object.httpEtag)) {
      return publicCatalogResponse(new Response(null, { status: 304, headers }));
    }
    headers.set("Content-Length", String(object.size));
    return publicCatalogResponse(new Response(object.body, { status: 200, headers }));
  } catch (error) {
    return publicCatalogResponse(catalogErrorResponse(error));
  }
}

export function OPTIONS(): Response {
  return publicCatalogOptionsResponse();
}
