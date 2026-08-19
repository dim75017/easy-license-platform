import { ingestMetadataBatch } from "@/db/catalog-ingest";
import { requireCatalogWrite } from "../../_lib/auth";
import {
  catalogErrorResponse,
  CatalogApiError,
  noStoreJson,
  parseJsonObject,
} from "../../_lib/http";
import { parseMetadataBatch } from "../../_lib/metadata";

const MAX_METADATA_BODY_BYTES = 512 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const writer = await requireCatalogWrite(request);
    const payload = await parseJsonObject(request, MAX_METADATA_BODY_BYTES);
    const batch = parseMetadataBatch(payload);
    if (
      writer.kind !== "pipeline" &&
      batch.items.some(
        (item) => item.verificationMode === "catalog_owner_direct",
      )
    ) {
      throw new CatalogApiError(
        "Catalog-owner evidence can only be recorded by the authenticated catalogue pipeline.",
        403,
        "catalog_owner_direct_pipeline_required",
      );
    }
    const items = await ingestMetadataBatch(batch);

    return noStoreJson(
      {
        batch: {
          accepted: items.length,
          ready: items.filter((item) => item.state === "ready").length,
          inProgress: items.filter((item) => item.state === "in_progress").length,
        },
        // The source keys are intentionally never echoed back by the API.
        items,
      },
      { status: 202 },
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
