export type SitesIdentity = {
  userId: string;
  email: string;
};

type HeaderReader = Pick<Headers, "get">;

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const MAX_USER_ID_LENGTH = 256;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_ID_NAMESPACE = "symbiome-sites-email-v1";

/**
 * Reads the identity asserted by the Sites dispatcher.
 *
 * Some Sites deployments currently forward the authenticated email and full
 * name without forwarding the site-scoped user ID. In that exact case, derive
 * a stable, site-local opaque key from the required normalized email. Missing
 * or invalid email still fails closed, as does a malformed supplied user ID.
 */
export async function sitesIdentityFromHeaders(
  requestHeaders: HeaderReader,
): Promise<SitesIdentity | null> {
  const email = requestHeaders
    .get(USER_EMAIL_HEADER)
    ?.trim()
    .toLowerCase();
  if (!email || !validEmail(email)) return null;

  const rawUserId = requestHeaders.get(USER_ID_HEADER);
  if (rawUserId !== null && rawUserId.trim() !== "") {
    const userId = rawUserId.trim();
    if (
      userId.length > MAX_USER_ID_LENGTH ||
      /[\u0000-\u001f\u007f]/u.test(userId)
    ) {
      return null;
    }
    return { userId, email };
  }

  return { userId: await emailFallbackUserId(email), email };
}

function validEmail(value: string): boolean {
  return (
    value.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
  );
}

async function emailFallbackUserId(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${EMAIL_ID_NAMESPACE}\u0000${email}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sites-email-sha256:${hex}`;
}
