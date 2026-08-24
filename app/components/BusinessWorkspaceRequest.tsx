"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export type BusinessRequestKind = "license" | "custom";

const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
const draftStoragePrefix = "symbiome-business-request-draft-v1";
const draftFieldNames = [
  "name",
  "email",
  "company",
  "project_name",
  "track",
  "creative_direction",
  "deliverables",
  "usage",
  "territory",
  "rights_term",
  "exclusivity",
  "budget",
  "timeline",
  "notes",
] as const;

const requestCopy: Record<BusinessRequestKind, {
  eyebrow: string;
  title: string;
  description: string;
  submit: string;
  success: string;
}> = {
  license: {
    eyebrow: "CLEAR AN EXISTING TRACK",
    title: "License a song",
    description: "Tell us where the track will live. We will qualify the rights, scope and quote without sending you away from Symbiome.",
    submit: "Request a licence quote",
    success: "Licence request received. Our team will review the track and usage scope next.",
  },
  custom: {
    eyebrow: "COMMISSION ORIGINAL MUSIC",
    title: "Request a custom song",
    description: "Share the creative direction, deliverables and commercial scope. A human artist and the licensing team will shape the next step.",
    submit: "Send custom song brief",
    success: "Custom song brief received. Our team will review the creative and production scope next.",
  },
};

function value(form: FormData, field: string): string {
  return String(form.get(field) ?? "").trim();
}

function draftStorageKey(kind: BusinessRequestKind): string {
  return `${draftStoragePrefix}:${kind}`;
}

function saveBusinessRequestDraft(kind: BusinessRequestKind, form: HTMLFormElement, hasSelectedTrack: boolean) {
  try {
    const formData = new FormData(form);
    const draft = Object.fromEntries(draftFieldNames.flatMap((field) => {
      if (field === "track" && hasSelectedTrack) return [];
      const fieldValue = value(formData, field);
      return fieldValue ? [[field, fieldValue]] : [];
    }));
    window.sessionStorage.setItem(draftStorageKey(kind), JSON.stringify(draft));
  } catch {
    // The form remains fully usable when browser storage is unavailable.
  }
}

function restoreBusinessRequestDraft(kind: BusinessRequestKind, form: HTMLFormElement, hasSelectedTrack: boolean) {
  try {
    const rawDraft = window.sessionStorage.getItem(draftStorageKey(kind));
    const draft = rawDraft ? JSON.parse(rawDraft) as unknown : null;
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return;
    for (const field of draftFieldNames) {
      if (field === "track" && hasSelectedTrack) continue;
      const fieldValue = (draft as Record<string, unknown>)[field];
      if (typeof fieldValue !== "string") continue;
      const control = form.elements.namedItem(field);
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
        if (control.type !== "hidden") control.value = fieldValue;
      }
    }
  } catch {
    // Ignore malformed or unavailable session storage without blocking the form.
  }
}

function clearBusinessRequestDraft(kind: BusinessRequestKind) {
  try {
    window.sessionStorage.removeItem(draftStorageKey(kind));
  } catch {
    // A successful request does not depend on browser storage cleanup.
  }
}

function buildProjectBrief(kind: BusinessRequestKind, form: FormData): string {
  const fields: Array<[string, string]> = [
    ["Request", kind === "license" ? "License an existing song" : "Commission a custom song"],
    ["Project / campaign", value(form, "project_name")],
    ...(kind === "license" ? [["Track", value(form, "track")]] as Array<[string, string]> : []),
    ...(kind === "license" ? [["Catalog track ID", value(form, "track_id")]] as Array<[string, string]> : []),
    ["Usage / media", value(form, "usage")],
    ["Territory", value(form, "territory")],
    ["Rights term", value(form, "rights_term")],
    ...(kind === "license" ? [["Exclusivity", value(form, "exclusivity")]] as Array<[string, string]> : []),
    ...(kind === "custom"
      ? [
          ["Creative direction", value(form, "creative_direction")],
          ["Deliverables", value(form, "deliverables")],
        ] as Array<[string, string]>
      : []),
    ["Additional notes", value(form, "notes")],
  ];

  return fields
    .filter(([, fieldValue]) => fieldValue.length > 0)
    .map(([label, fieldValue]) => `${label}: ${fieldValue}`)
    .join("\n");
}

export function BusinessWorkspaceRequest({
  kind,
  onBrowseLibrary,
  selectedTrack = null,
}: {
  kind: BusinessRequestKind;
  onBrowseLibrary: () => void;
  selectedTrack?: { id: string; title: string; artist: string } | null;
}) {
  const copy = requestCopy[kind];
  const selectedTrackId = selectedTrack?.id ?? null;
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [kind]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || (document.activeElement && form.contains(document.activeElement))) return;
    restoreBusinessRequestDraft(kind, form, Boolean(selectedTrackId));
  }, [kind, selectedTrackId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setState("sending");
    setMessage("");

    const payload = {
      type: "sync" as const,
      name: value(form, "name"),
      email: value(form, "email"),
      company: value(form, "company"),
      project: buildProjectBrief(kind, form),
      budget: value(form, "budget"),
      timeline: value(form, "timeline"),
    };

    if (isStaticDemo) {
      formElement.reset();
      clearBusinessRequestDraft(kind);
      setState("sent");
      setMessage("Public demo only — nothing was sent or stored.");
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
      formElement.reset();
      clearBusinessRequestDraft(kind);
      setState("sent");
      setMessage(copy.success);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <section className="business-request-view music-workspace-view" aria-labelledby={`business-${kind}-title`}>
      <header className="business-request-hero">
        <div>
          <span>{copy.eyebrow}</span>
          <h2 id={`business-${kind}-title`} ref={headingRef} tabIndex={-1}>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <button className="business-workspace-cta is-secondary" type="button" onClick={onBrowseLibrary}>Browse the library</button>
      </header>

      {state === "sent" ? (
        <div className="business-request-success" role="status">
          <span aria-hidden="true">✓</span>
          <div><strong>Brief received</strong><p>{message}</p></div>
          <button className="business-workspace-cta" type="button" onClick={() => setState("idle")}>Send another request</button>
        </div>
      ) : (
        <form
          ref={formRef}
          className="business-request-form"
          onInput={(event) => saveBusinessRequestDraft(kind, event.currentTarget, Boolean(selectedTrack))}
          onSubmit={submit}
        >
          <div className="business-request-section">
            <div className="business-request-section-heading"><span>01</span><div><strong>Contact</strong><small>Who should receive the scope and quote?</small></div></div>
            <div className="business-request-fields is-three-columns">
              <label><span>Your name</span><input name="name" maxLength={120} required autoComplete="name" placeholder="Alex Martin" /></label>
              <label><span>Work email</span><input name="email" type="email" maxLength={254} required autoComplete="email" placeholder="alex@company.com" /></label>
              <label><span>Company</span><input name="company" maxLength={160} required autoComplete="organization" placeholder="Company or agency" /></label>
            </div>
          </div>

          <div className="business-request-section">
            <div className="business-request-section-heading"><span>02</span><div><strong>{kind === "license" ? "Song and project" : "Project and creative direction"}</strong><small>{kind === "license" ? "Name the track and the project it will support." : "Give the artist a clear creative starting point."}</small></div></div>
            <div className="business-request-fields">
              {kind === "license" && selectedTrack && (
                <div className="business-selected-track is-full">
                  <span>SELECTED FROM THE LIBRARY</span>
                  <div><strong>{selectedTrack.title}</strong><small>{selectedTrack.artist}</small></div>
                  <button type="button" onClick={onBrowseLibrary}>Choose another song</button>
                  <input type="hidden" name="track" value={`${selectedTrack.title} — ${selectedTrack.artist}`} />
                  <input type="hidden" name="track_id" value={selectedTrack.id} />
                </div>
              )}
              {kind === "license" && !selectedTrack && <label className="is-full"><span>Track title and artist</span><input name="track" maxLength={240} required placeholder="Track title — Artist" /></label>}
              <label className={kind === "license" ? undefined : "is-full"}><span>Project or campaign</span><input name="project_name" maxLength={240} required placeholder="Campaign, film, series, game, podcast…" /></label>
              {kind === "custom" && <label className="is-full"><span>Creative direction</span><textarea name="creative_direction" maxLength={1200} rows={5} required placeholder="Mood, tempo, references, story, audience and what the music should make people feel." /></label>}
              {kind === "custom" && <label className="is-full"><span>Deliverables</span><input name="deliverables" maxLength={500} required placeholder="e.g. 60-second master, 30/15-second cutdowns, stems and instrumental" /></label>}
            </div>
          </div>

          <div className="business-request-section">
            <div className="business-request-section-heading"><span>03</span><div><strong>Usage and rights</strong><small>These details define the commercial scope.</small></div></div>
            <div className="business-request-fields is-three-columns">
              <label><span>Usage / media</span><select name="usage" required defaultValue=""><option value="" disabled>Select usage</option><option>Advertising / paid media</option><option>Film / series / documentary</option><option>Video game</option><option>Social content</option><option>Podcast / audio</option><option>Event / experiential</option><option>Website / owned channels</option><option>Other</option></select></label>
              <label><span>Territory</span><select name="territory" required defaultValue=""><option value="" disabled>Select territory</option><option>One country</option><option>Multiple countries</option><option>Europe</option><option>North America</option><option>Worldwide</option><option>To be defined</option></select></label>
              <label><span>Rights term</span><select name="rights_term" required defaultValue=""><option value="" disabled>Select duration</option><option>3 months</option><option>6 months</option><option>1 year</option><option>2 years</option><option>3–5 years</option><option>Perpetual</option><option>To be defined</option></select></label>
              {kind === "license" && <label><span>Exclusivity</span><select name="exclusivity" defaultValue="Non-exclusive"><option>Non-exclusive</option><option>Category exclusive</option><option>Full exclusive</option><option>To be defined</option></select></label>}
              <label><span>Indicative budget</span><select name="budget" required defaultValue=""><option value="" disabled>Select a range</option><option>Under €5k</option><option>€5k – €15k</option><option>€15k – €50k</option><option>€50k – €100k</option><option>€100k+</option><option>Not defined yet</option></select></label>
              <label><span>Launch / delivery deadline <small>Optional</small></span><input name="timeline" type="date" /></label>
            </div>
          </div>

          <div className="business-request-section">
            <div className="business-request-section-heading"><span>04</span><div><strong>Anything else?</strong><small>Optional context for the music and licensing teams.</small></div></div>
            <div className="business-request-fields"><label className="is-full"><span>Additional notes <small>Optional</small></span><textarea name="notes" maxLength={1000} rows={4} placeholder="Links, reference cuts, legal constraints, stakeholders or approval process." /></label></div>
          </div>

          <footer className="business-request-footer">
            <p>{isStaticDemo ? "Public prototype: no information is sent or stored." : <>Symbiome stores these details to review and answer your request. Read the <a href="/privacy">Privacy notice</a>.</>}</p>
            <button className="business-workspace-cta" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : copy.submit}</button>
          </footer>
          {state === "error" && <p className="business-request-error" role="alert">{message}</p>}
        </form>
      )}
    </section>
  );
}
