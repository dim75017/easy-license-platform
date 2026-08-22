const secureSiteOrigin = "https://easy-license.dsomoguy.chatgpt.site";

const accountReturnTo = {
  login: "/create-account?mode=login",
  create: "/create-account",
} as const;

export type PublicAccountMode = keyof typeof accountReturnTo;
export type PublicAccountPlan = "creator" | "pro";

export function publicAccountSignOutHref(
  mode: PublicAccountMode,
  plan?: PublicAccountPlan,
): string {
  const separator = mode === "login" ? "&" : "?";
  const returnTo = `${accountReturnTo[mode]}${plan ? `${separator}plan=${plan}` : ""}`;
  return `${secureSiteOrigin}/signout-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}

export function publicGuestViewHref(): string {
  return `${secureSiteOrigin}/signout-with-chatgpt?return_to=${encodeURIComponent("/app/guest")}`;
}
