"use client";

import { FormEvent, useState } from "react";

type LeadType = "sync" | "retail_waitlist";

export function LeadForm({ type }: { type: LeadType }) {
  const isSync = type === "sync";
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = {
      type,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      company: String(form.get("company") ?? ""),
      ...(isSync
        ? {
            project: String(form.get("project") ?? ""),
            budget: String(form.get("budget") ?? ""),
            timeline: String(form.get("timeline") ?? ""),
          }
        : { use_case: String(form.get("use_case") ?? "") }),
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to send your request.");
      setState("sent");
      setMessage(isSync ? "Brief received. Our licensing team will review it next." : "You’re on the early access list.");
      event.currentTarget.reset();
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
            <span>Tell us about the project</span>
            <textarea name="project" maxLength={2000} required rows={5} placeholder="Campaign, film, game, podcast… Tell us where the music will live and what it should feel like." />
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
      <button className="button button-primary button-full" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : isSync ? "Send music brief" : "Join the first pilot"}
      </button>
      {state === "error" && <p className="form-error" role="alert">{message}</p>}
      <p className="form-privacy">No spam. Your information is only used to review this request.</p>
    </form>
  );
}
