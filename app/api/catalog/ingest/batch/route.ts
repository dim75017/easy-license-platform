import { ingestMetadataBatch } from "@/db/catalog-ingest";
import { requireCatalogWrite } from "../../_lib/auth";
import {
  catalogErrorResponse,
  noStoreJson,
  parseJsonObject,
} from "../../_lib/http";
import { parseMetadataBatch } from "../../_lib/metadata";

const MAX_METADATA_BODY_BYTES = 512 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    await requireCatalogWrite(request);
    const payload = await parseJsonObject(request, MAX_METADATA_BODY_BYTES);
    const batch = parseMetadataBatch(payload);
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
