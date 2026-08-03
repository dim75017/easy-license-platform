import { desc } from "drizzle-orm";
import { ensureLeadSchema, getDb } from "../../../db";
import { leads, leadTypes, type LeadType } from "../../../db/schema";

const MAX_BODY_BYTES = 16_384;
const MAX_RECENT_LEADS = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const SINGLE_LINE_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const MULTI_LINE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const allowedPayloadKeys = new Set([
  "type",
  "email",
  "name",
  "company",
  "project",
  "use_case",
  "budget",
  "timeline",
]);

class RequestValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type JsonObject = Record<string, unknown>;

function errorResponse(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function assertJsonObject(value: unknown): asserts value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RequestValidationError("The request body must be a JSON object.");
  }

  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedPayloadKeys.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new RequestValidationError(
      `Unknown field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}.`,
    );
  }
}

function requiredString(
  payload: JsonObject,
  key: string,
  maxLength: number,
  options: { multiline?: boolean } = {},
) {
  const value = payload[key];
  if (typeof value !== "string") {
    throw new RequestValidationError(`${key} must be a string.`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new RequestValidationError(`${key} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new RequestValidationError(
      `${key} must be at most ${maxLength} characters.`,
    );
  }

  const invalidCharacters = options.multiline
    ? MULTI_LINE_CONTROL_CHARACTERS
    : SINGLE_LINE_CONTROL_CHARACTERS;
  if (invalidCharacters.test(normalized)) {
    throw new RequestValidationError(`${key} contains invalid characters.`);
  }

  return normalized;
}

function optionalString(payload: JsonObject, key: string, maxLength: number) {
  const value = payload[key];
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new RequestValidationError(`${key} must be a string when provided.`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new RequestValidationError(
      `${key} must be at most ${maxLength} characters.`,
    );
  }
  if (SINGLE_LINE_CONTROL_CHARACTERS.test(normalized)) {
    throw new RequestValidationError(`${key} contains invalid characters.`);
  }

  return normalized;
}

function validateLeadType(value: unknown): LeadType {
  if (
    typeof value !== "string" ||
    !leadTypes.includes(value as LeadType)
  ) {
    throw new RequestValidationError(
      "type must be either sync or retail_waitlist.",
    );
  }

  return value as LeadType;
}

function validateEmail(payload: JsonObject) {
  const email = requiredString(payload, "email", 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new RequestValidationError("email must be a valid email address.");
  }

  return email;
}

async function parseJsonBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    throw new RequestValidationError(
      "Content-Type must be application/json.",
      415,
    );
  }

  const advertisedLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_BODY_BYTES) {
    throw new RequestValidationError("The request body is too large.", 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    throw new RequestValidationError("The request body is too large.", 413);
  }
  if (rawBody.trim().length === 0) {
    throw new RequestValidationError("The request body cannot be empty.");
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new RequestValidationError("The request body contains invalid JSON.");
  }
}

function serializeLead(lead: typeof leads.$inferSelect) {
  return {
    id: lead.id,
    type: lead.type,
    email: lead.email,
    name: lead.name,
    company: lead.company,
    project: lead.project,
    use_case: lead.useCase,
    budget: lead.budget,
    timeline: lead.timeline,
    status: lead.status,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  };
}

export async function GET(request: Request) {
  try {
    const authenticatedEmail = request.headers
      .get("oai-authenticated-user-email")
      ?.trim()
      .toLowerCase();
    if (!authenticatedEmail?.endsWith("@lofigirl.com")) {
      return errorResponse("Admin access required.", 403);
    }

    await ensureLeadSchema();
    const db = getDb();
    const recentLeads = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(MAX_RECENT_LEADS);

    return Response.json(
      { leads: recentLeads.map(serializeLead) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse("Unable to load lead requests.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    assertJsonObject(payload);

    const type = validateLeadType(payload.type);
    const email = validateEmail(payload);
    const name = requiredString(payload, "name", 120);
    const company = requiredString(payload, "company", 160);
    const budget = optionalString(payload, "budget", 120);
    const timeline = optionalString(payload, "timeline", 120);

    let project: string | null = null;
    let useCase: string | null = null;

    if (type === "sync") {
      project = requiredString(payload, "project", 4000, { multiline: true });
      if (payload.use_case !== undefined && payload.use_case !== null) {
        throw new RequestValidationError(
          "use_case is only available for retail_waitlist requests.",
        );
      }
    } else {
      useCase = requiredString(payload, "use_case", 4000, { multiline: true });
      if (payload.project !== undefined && payload.project !== null) {
        throw new RequestValidationError(
          "project is only available for sync requests.",
        );
      }
    }

    await ensureLeadSchema();
    const db = getDb();
    const [createdLead] = await db
      .insert(leads)
      .values({
        type,
        email,
        name,
        company,
        project,
        useCase,
        budget,
        timeline,
      })
      .returning();

    return Response.json(
      { lead: serializeLead(createdLead) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse("Unable to submit the request.", 500);
  }
}
