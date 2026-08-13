"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Plan = "creator" | "pro";
type Platform =
  | "youtube"
  | "twitch"
  | "podcast"
  | "instagram"
  | "tiktok"
  | "other";

type Profile = {
  displayName: string;
  company: string | null;
  plan: Plan;
  platform: Platform;
  marketingOptIn: boolean;
  onboardingCompletedAt: string;
};

type Identity = { email: string; displayName: string };
type LoadState = "checking" | "signed-out" | "ready" | "complete" | "demo";

const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

export function AccountSetup() {
  const [state, setState] = useState<LoadState>(isStaticDemo ? "demo" : "checking");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [plan, setPlan] = useState<Plan>("creator");
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const signInReturnTo = `/create-account?plan=${plan}`;

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("plan");
    if (requested === "pro" || requested === "creator") setPlan(requested);
    if (isStaticDemo) return;

    const controller = new AbortController();
    fetch("/api/account/profile", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setState("signed-out");
          return;
        }
        if (!response.ok) throw new Error("account_lookup_failed");
        const payload = (await response.json()) as {
          identity?: Identity;
          profile?: Profile | null;
        };
        if (!payload.identity?.email || !payload.identity.displayName) {
          throw new Error("invalid_identity");
        }
        setIdentity(payload.identity);
        if (payload.profile) {
          setDisplayName(payload.profile.displayName);
          setCompany(payload.profile.company ?? "");
          setPlan(payload.profile.plan);
          setPlatform(payload.profile.platform);
          setMarketingOptIn(payload.profile.marketingOptIn);
          setAcceptPolicies(true);
          setState("complete");
          return;
        }
        setDisplayName(payload.identity.displayName);
        setState("ready");
      })
      .catch((requestError: unknown) => {
        if ((requestError as { name?: string }).name !== "AbortError") {
          setState("signed-out");
        }
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!acceptPolicies) {
      setError("Please acknowledge the Legal information and Privacy Policy to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          company,
          plan,
          platform,
          acceptPolicies,
          marketingOptIn,
        }),
      });
      if (response.status === 401) {
        setState("signed-out");
        return;
      }
      if (!response.ok) throw new Error("profile_save_failed");
      setState("complete");
    } catch {
      setError("We could not save your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="account-page">
      <section className="account-intro" aria-labelledby="account-title">
        <div className="account-intro-copy">
          <span className="account-kicker">SYMBIOME ACCOUNT</span>
          <h1 id="account-title">Music ready for<br />your next upload.</h1>
          <p>
            Build a workspace around your channels, save tracks and keep your
            licences in one clear place.
          </p>
        </div>
        <ol className="account-steps" aria-label="Account setup steps">
          <li className="is-active"><span>01</span><strong>Secure identity</strong></li>
          <li><span>02</span><strong>Your setup</strong></li>
          <li><span>03</span><strong>Music workspace</strong></li>
        </ol>
        <div className="account-proof">
          <span>10,000+ human-made tracks</span>
          <span>0 generative AI music</span>
        </div>
      </section>

      <section className="account-panel" aria-label="Create your Symbiome account">
        <div className="account-card">
          {state === "checking" && (
            <div className="account-state" role="status">
              <span className="account-state-index">01 / 03</span>
              <h2>Checking your account…</h2>
              <p>This only takes a moment.</p>
              <span className="account-loader" aria-hidden="true" />
            </div>
          )}

          {state === "demo" && (
            <div className="account-state">
              <span className="account-state-index">01 / 03</span>
              <h2>Create your account.</h2>
              <p>
                Account creation is available on the secure Symbiome app. The
                public catalogue remains open for browsing.
              </p>
              <a
                className="button button-primary button-full cta-swipe"
                href="https://easy-license.dsomoguy.chatgpt.site/create-account"
              >
                Open the secure app
              </a>
              <Link className="account-secondary-link" href="/catalog">
                Browse music first
              </Link>
            </div>
          )}

          {state === "signed-out" && (
            <div className="account-state">
              <span className="account-state-index">01 / 03</span>
              <h2>Create your account.</h2>
              <p>
                Continue securely with ChatGPT. Symbiome never receives or
                stores your password.
              </p>
              <a
                className="button button-primary button-full cta-swipe"
                href={`/signin-with-chatgpt?return_to=${encodeURIComponent(signInReturnTo)}`}
              >
                Continue with ChatGPT
              </a>
              <div className="account-trust-note">
                <span aria-hidden="true">✓</span>
                <p>Your identity is used only to create and protect your workspace.</p>
              </div>
              <p className="account-legal-copy">
                By continuing, you acknowledge our <Link href="/legal">Legal information</Link>
                {" "}and <Link href="/privacy">Privacy Policy</Link>.
              </p>
            </div>
          )}

          {state === "ready" && (
            <form className="account-form" onSubmit={submit} noValidate>
              <div className="account-card-heading">
                <span className="account-state-index">02 / 03</span>
                <h2>Set up your workspace.</h2>
                <p>Signed in as <strong>{identity?.email}</strong></p>
              </div>

              {error && <div className="account-error" role="alert">{error}</div>}

              <div className="account-fields">
                <label>
                  <span>Your name</span>
                  <input
                    autoComplete="name"
                    aria-invalid={error === "Please enter your name."}
                    maxLength={120}
                    required
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
                <label>
                  <span>Company or team <small>Optional</small></span>
                  <input
                    autoComplete="organization"
                    maxLength={160}
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                  />
                </label>
              </div>

              <fieldset className="account-choice-group">
                <legend>Choose your setup</legend>
                <div className="account-plan-grid">
                  <label className={plan === "creator" ? "is-selected" : ""}>
                    <input
                      type="radio"
                      name="account-plan"
                      value="creator"
                      checked={plan === "creator"}
                      onChange={() => setPlan("creator")}
                    />
                    <span><strong>Creator</strong><small>One channel per platform</small></span>
                    <b>€6.67<small>/mo</small></b>
                  </label>
                  <label className={plan === "pro" ? "is-selected" : ""}>
                    <input
                      type="radio"
                      name="account-plan"
                      value="pro"
                      checked={plan === "pro"}
                      onChange={() => setPlan("pro")}
                    />
                    <span><strong>Pro</strong><small>Teams and multiple channels</small></span>
                    <b>€16.67<small>/mo</small></b>
                  </label>
                </div>
                <p className="account-plan-note">Plan preference only. No payment is taken today.</p>
              </fieldset>

              <label className="account-platform-field">
                <span>Where do you publish most?</span>
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as Platform)}
                >
                  <option value="youtube">YouTube</option>
                  <option value="twitch">Twitch</option>
                  <option value="podcast">Podcasts</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="other">Another platform</option>
                </select>
              </label>

              <div className="account-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={acceptPolicies}
                    onChange={(event) => setAcceptPolicies(event.target.checked)}
                  />
                  <span>I have read the <Link href="/legal">Legal information</Link> and <Link href="/privacy">Privacy Policy</Link>.</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(event) => setMarketingOptIn(event.target.checked)}
                  />
                  <span>Send me occasional catalogue and product updates.</span>
                </label>
              </div>

              <button
                className="button button-primary button-full cta-swipe"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Creating your workspace…" : "Create my account"}
              </button>
            </form>
          )}

          {state === "complete" && (
            <div className="account-state account-complete" role="status">
              <span className="account-complete-mark" aria-hidden="true">✓</span>
              <span className="account-state-index">03 / 03</span>
              <h2>Your workspace is ready.</h2>
              <p>
                Start exploring the catalogue, save directions and keep your
                music activity together.
              </p>
              <Link className="button button-primary button-full cta-swipe" href="/app">
                Enter the music workspace
              </Link>
              <button className="account-text-button" type="button" onClick={() => setState("ready")}>
                Update account details
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
