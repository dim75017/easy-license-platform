import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sitesIdentityFromHeaders } from "./_lib/sites-identity";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const identity = await sitesIdentityFromHeaders(requestHeaders);
  if (!identity) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId: identity.userId,
    displayName: fullName ?? identity.email,
    email: identity.email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export async function requireCompletedSymbiomeProfile(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await requireChatGPTUser(returnTo);
  const { accountDatabase } = await import("../db/account-runtime");
  const database = await accountDatabase();
  const profile = await database
    .prepare(
      `SELECT onboarding_completed_at, policies_acknowledged_at
       FROM user_profiles
       WHERE external_user_id = ?1
       LIMIT 1`,
    )
    .bind(user.userId)
    .first<{
      onboarding_completed_at: string | null;
      policies_acknowledged_at: string | null;
    }>();

  if (!profile?.onboarding_completed_at || !profile.policies_acknowledged_at) {
    redirect("/create-account?auth=resume");
  }
  return user;
}

export async function requireSymbiomeAdmin(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await requireChatGPTUser(returnTo);
  const { catalogAdminEmails } = await import("../db/catalog-runtime");
  if (!catalogAdminEmails().has(user.email)) {
    redirect("/app");
  }
  return user;
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
