import { requireCatalogIdentity } from "../../../_lib/auth";
import {
  catalogErrorResponse,
  CatalogApiError,
  requiredPositiveId,
} from "../../../_lib/http";

type RouteContext = { params: Promise<{ trackId: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    await requireCatalogIdentity(request);
    const { trackId: rawTrackId } = await context.params;
    requiredPositiveId(rawTrackId, "trackId");

    // Masters deliberately remain unreachable until a server-side subscription
    // entitlement or issued licence can be checked. This endpoint must never
    // fall back to serving the streaming copy.
    throw new CatalogApiError(
      "Master downloads are not enabled until subscription entitlements are connected.",
      501,
      "download_entitlement_not_implemented",
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
