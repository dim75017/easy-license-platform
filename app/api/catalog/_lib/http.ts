export class CatalogApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "invalid_request",
  ) {
    super(message);
  }
}

export function catalogErrorResponse(error: unknown): Response {
  if (error instanceof CatalogApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  console.error("Catalog API request failed", error);
  return Response.json(
    {
      error: {
        code: "catalog_unavailable",
        message: "The catalogue service is temporarily unavailable.",
      },
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function noStoreJson(
  value: unknown,
  init: Omit<ResponseInit, "headers"> & { headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(value, { ...init, headers });
}

export async function parseJsonObject(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    throw new CatalogApiError(
      "Content-Type must be application/json.",
      415,
      "unsupported_media_type",
    );
  }

  const advertisedLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(advertisedLength) && advertisedLength > maxBytes) {
    throw new CatalogApiError(
      "The request body is too large.",
      413,
      "payload_too_large",
    );
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    throw new CatalogApiError(
      "The request body is too large.",
      413,
      "payload_too_large",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new CatalogApiError(
      "The request body contains invalid JSON.",
      400,
      "invalid_json",
    );
  }

  if (!isPlainObject(parsed)) {
    throw new CatalogApiError("The request body must be a JSON object.");
  }

  return parsed;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label = "request body",
): void {
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new CatalogApiError(
      `Unknown field${unknownKeys.length === 1 ? "" : "s"} in ${label}: ${unknownKeys.join(", ")}.`,
    );
  }
}

export function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new CatalogApiError(`${label} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new CatalogApiError(`${label} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new CatalogApiError(
      `${label} must be at most ${maxLength} characters.`,
    );
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new CatalogApiError(`${label} contains invalid characters.`);
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  label: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, label, maxLength);
}

export function optionalInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new CatalogApiError(
      `${label} must be an integer between ${min} and ${max}.`,
    );
  }
  return value as number;
}

export function requiredPositiveId(value: string, label: string): number {
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new CatalogApiError(`${label} must be a positive integer.`);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) {
    throw new CatalogApiError(`${label} is outside the supported range.`);
  }
  return id;
}
