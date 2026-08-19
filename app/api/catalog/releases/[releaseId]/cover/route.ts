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

    const object = await requireCatalogAudioBucket().get(
      release.cover_storage_key,
    );
    if (!object) {
      throw new CatalogApiError("Cover artwork is unavailable.", 404, "cover_not_found");
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Length", String(object.size));
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return publicCatalogResponse(new Response(object.body, { headers }));
  } catch (error) {
    return publicCatalogResponse(catalogErrorResponse(error));
  }
}

export function OPTIONS(): Response {
  return publicCatalogOptionsResponse();
}
