"use client";

import { FormEvent, useState } from "react";

type LeadType = "sync" | "retail_waitlist" | "business";
export type BusinessNeed = "existing_track" | "custom_music" | "physical_places";

const businessNeedLabels: Record<BusinessNeed, string> = {
  existing_track: "License an existing track",
  custom_music: "Commission original music",
  physical_places: "Music for a physical place — Coming soon",
};

const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

export function LeadForm({ type, initialBusinessNeed = "existing_track" }: { type: LeadType; initialBusinessNeed?: BusinessNeed }) {
  const isBusiness = type === "business";
  const isSync = type === "sync" || isBusiness;
  const isGuidedBusinessForm = isBusiness;
  const [businessNeed, setBusinessNeed] = useState<BusinessNeed>(initialBusinessNeed);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const isPhysicalPlacesRequest = isGuidedBusinessForm && businessNeed === "physical_places";
    const project = String(form.get("project") ?? "");
    const payload = isPhysicalPlacesRequest
      ? {
          type: "retail_waitlist" as const,
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          company: String(form.get("company") ?? ""),
          use_case: String(form.get("use_case") ?? ""),
        }
      : {
          type: isBusiness ? "sync" as const : type,
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          company: String(form.get("company") ?? ""),
          ...(isSync
            ? {
                project: isGuidedBusinessForm ? `${businessNeedLabels[businessNeed]}\n\n${project}` : project,
                budget: String(form.get("budget") ?? ""),
                timeline: String(form.get("timeline") ?? ""),
              }
            : { use_case: String(form.get("use_case") ?? "") }),
        };

    if (isStaticDemo) {
      setState("sent");
      setMessage("Public demo only — nothing was sent or stored.");
      event.currentTarget.reset();
      setBusinessNeed(initialBusinessNeed);
      return;
    }

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to send your request.");
      setState("sent");
      setMessage(isPhysicalPlacesRequest || !isSync ? "You’re on the early access list." : "Brief received. Our licensing team will review it next.");
      event.currentTarget.reset();
      setBusinessNeed(initialBusinessNeed);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="form-success" role="status">
        <span>✓</span>
        <p>{message}</p>
        <button type="button" className="text-link" onClick={() => setState("idle")}>Send another request</button>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      {isGuidedBusinessForm && (
        <label className="business-need-field">
          <span>What do you need?</span>
          <select name="business_need" value={businessNeed} onChange={(event) => setBusinessNeed(event.target.value as BusinessNeed)}>
            <option value="existing_track">License an existing track</option>
            <option value="custom_music">Commission original music</option>
            <option value="physical_places">Music for a physical place — Coming soon</option>
          </select>
        </label>
      )}

      {isGuidedBusinessForm && businessNeed === "physical_places" ? (
        <>
          <div className="business-coming-soon" id="physical-places-status" role="status">
            <strong>Physical places is coming soon.</strong>
            <p>Leave your email and we will contact you when the first venues can join.</p>
          </div>
          <div className="form-grid">
            <label>
              <span>Your name</span>
              <input name="name" maxLength={100} required placeholder="Alex Martin" />
            </label>
            <label>
              <span>Work email</span>
              <input name="email" type="email" maxLength={254} required placeholder="alex@company.com" aria-describedby="physical-places-status" />
            </label>
          </div>
          <label>
            <span>Company or venue</span>
            <input name="company" maxLength={140} required placeholder="Your business" />
          </label>
          <label>
            <span>What kind of space are you planning for?</span>
            <select name="use_case" defaultValue="Café / restaurant" required>
              <option>Café / restaurant</option>
              <option>Retail store</option>
              <option>Hotel / hospitality</option>
              <option>Office / coworking</option>
              <option>Gym / fitness studio</option>
              <option>Spa / wellness</option>
              <option>Multi-location group</option>
              <option>Other physical space</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <div className="form-grid">
            <label>
              <span>Your name</span>
              <input name="name" maxLength={100} required placeholder="Alex Martin" />
            </label>
            <label>
              <span>Work email</span>
              <input name="email" type="email" maxLength={254} required placeholder="alex@company.com" />
            </label>
          </div>
          <label>
            <span>Company or channel</span>
            <input name="company" maxLength={140} required placeholder={isSync ? "Your company" : "Your space or brand"} />
          </label>
          {isSync ? (
            <>
              <label>
                <span>{isGuidedBusinessForm
                  ? businessNeed === "custom_music"
                    ? "Tell us what you want us to create"
                    : "Tell us about the project and track"
                  : "Tell us about the project"}</span>
                <textarea
                  name="project"
                  maxLength={2000}
                  required
                  rows={5}
                  placeholder={isGuidedBusinessForm
                    ? businessNeed === "custom_music"
                      ? "Describe the project, musical direction, deliverables and where the original music will be used."
                      : "Tell us which track or musical direction you have in mind, where it will be used and for how long."
                    : "Campaign, film, game, podcast… Tell us where the music will live and what it should feel like."}
                />
              </label>
              <div className="form-grid">
                <label>
                  <span>Indicative budget</span>
                  <select name="budget" defaultValue="">
                    <option value="" disabled>Select a range</option>
                    <option>Under €5k</option>
                    <option>€5k – €15k</option>
                    <option>€15k – €50k</option>
                    <option>€50k+</option>
                    <option>Not defined yet</option>
                  </select>
                </label>
                <label>
                  <span>Ideal timing</span>
                  <input name="timeline" maxLength={100} placeholder="e.g. October 2026" />
                </label>
              </div>
            </>
          ) : (
            <label>
              <span>What kind of space are you planning for?</span>
              <select name="use_case" defaultValue="Café / restaurant" required>
                <option>Café / restaurant</option>
                <option>Retail store</option>
                <option>Hotel / hospitality</option>
                <option>Office / coworking</option>
                <option>Multi-location group</option>
                <option>Other physical space</option>
              </select>
            </label>
          )}
        </>
      )}
      <button className="button button-primary button-full cta-swipe" type="submit" disabled={state === "sending"}>
        {state === "sending"
          ? "Sending…"
          : isGuidedBusinessForm && businessNeed === "physical_places"
            ? "Join physical places early access"
            : isGuidedBusinessForm && businessNeed === "custom_music"
              ? "Request a custom music quote"
              : isGuidedBusinessForm
                ? "Request a track licence quote"
                : isSync
                  ? "Send music brief"
                  : "Join the first pilot"}
      </button>
      {state === "error" && <p className="form-error" role="alert">{message}</p>}
      <p className="form-privacy">
        {isStaticDemo
          ? "Public prototype: no information is sent or stored."
          : "No spam. Your information is only used to review this request."}
      </p>
    </form>
  );
}
