import {
  requireCatalogAudioBucket,
  requireCatalogDatabase,
} from "@/db/catalog-runtime";
import { requireCatalogIdentity } from "../../../_lib/auth";
import {
  catalogErrorResponse,
  CatalogApiError,
  requiredPositiveId,
} from "../../../_lib/http";

type RouteContext = { params: Promise<{ trackId: string }> };

type StreamAsset = {
  storage_key: string;
  mime_type: string;
  byte_size: number | null;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    await requireCatalogIdentity(request);
    const { trackId: rawTrackId } = await context.params;
    const trackId = requiredPositiveId(rawTrackId, "trackId");
    const asset = await requireCatalogDatabase()
      .prepare(
        `SELECT ta.storage_key, ta.mime_type, ta.byte_size
         FROM track_assets ta
         JOIN tracks t ON t.id = ta.track_id
         JOIN releases r ON r.id = t.release_id
         WHERE ta.track_id = ?
           AND ta.kind = 'streaming_copy'
           AND ta.status = 'available'
           AND t.status = 'published'
           AND t.rights_status = 'cleared'
           AND r.status = 'published'
         ORDER BY ta.id DESC
         LIMIT 1`,
      )
      .bind(trackId)
      .first<StreamAsset>();

    if (!asset) {
      throw new CatalogApiError(
        "This track is not available for playback.",
        404,
        "stream_not_found",
      );
    }

    const bucket = requireCatalogAudioBucket();
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const head = await bucket.head(asset.storage_key);
      if (!head) {
        throw new CatalogApiError(
          "This track is not available for playback.",
          404,
          "stream_not_found",
        );
      }
      const range = parseSingleByteRange(rangeHeader, head.size);
      if (!range) {
        return new Response(null, {
          status: 416,
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes */${head.size}`,
            "Cache-Control": "no-store",
          },
        });
      }

      const object = await bucket.get(asset.storage_key, {
        range: { offset: range.start, length: range.length },
      });
      if (!object) {
        throw new CatalogApiError(
          "This track is not available for playback.",
          404,
          "stream_not_found",
        );
      }

      const headers = streamHeaders(object, asset.mime_type);
      headers.set("Content-Length", String(range.length));
      headers.set(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${head.size}`,
      );
      return new Response(object.body, { status: 206, headers });
    }

    const object = await bucket.get(asset.storage_key);
    if (!object) {
      throw new CatalogApiError(
        "This track is not available for playback.",
        404,
        "stream_not_found",
      );
    }
    const headers = streamHeaders(object, asset.mime_type);
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

function streamHeaders(object: R2ObjectBody, fallbackMimeType: string): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", fallbackMimeType);
  }
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

function parseSingleByteRange(
  value: string,
  size: number,
): { start: number; end: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  if (!match || size < 1) return null;

  const rawStart = match[1];
  const rawEnd = match[2];
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    const boundedLength = Math.min(suffixLength, size);
    start = size - boundedLength;
    end = size - 1;
  } else {
    start = Number(rawStart);
    if (!Number.isSafeInteger(start) || start < 0 || start >= size) return null;
    if (rawEnd) {
      end = Number(rawEnd);
      if (!Number.isSafeInteger(end) || end < start) return null;
      end = Math.min(end, size - 1);
    } else {
      end = size - 1;
    }
  }

  return { start, end, length: end - start + 1 };
}
