"use client";

import { useSearchParams } from "next/navigation";
import { LeadForm, type BusinessNeed } from "./LeadForm";

const businessNeeds = new Set<BusinessNeed>(["existing_track", "custom_music", "physical_places"]);

export function BusinessLeadForm() {
  const searchParams = useSearchParams();
  const requestedNeed = searchParams.get("business_need");
  const initialBusinessNeed = requestedNeed && businessNeeds.has(requestedNeed as BusinessNeed)
    ? requestedNeed as BusinessNeed
    : "existing_track";

  return <LeadForm key={initialBusinessNeed} type="business" initialBusinessNeed={initialBusinessNeed} />;
}
