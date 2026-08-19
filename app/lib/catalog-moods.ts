export const catalogueMoodFilters = [
  "Dreamy",
  "Laid Back",
  "Relaxing",
  "Peaceful",
  "Smooth",
  "Hopeful",
  "Dark",
  "Mysterious",
  "Romantic",
  "Sad",
  "Sentimental",
  "Warm",
  "Cozy",
  "Reflective",
  "Happy",
  "Floating",
] as const;

export type CatalogueMood = (typeof catalogueMoodFilters)[number];

const catalogueMoodAliases: Record<CatalogueMood, readonly string[]> = {
  Dreamy: ["Dreamy"],
  "Laid Back": ["Laid Back", "Easygoing", "Calm"],
  Relaxing: ["Relaxing", "Calm", "Gentle", "Restful"],
  Peaceful: ["Peaceful", "Calm", "Gentle"],
  Smooth: ["Smooth", "Easygoing", "Gentle"],
  Hopeful: ["Hopeful", "Open", "Bright"],
  Dark: ["Dark", "Spooky"],
  Mysterious: ["Mysterious", "Dark", "Dreamy"],
  Romantic: ["Romantic", "Intimate", "Warm"],
  Sad: ["Sad", "Reflective", "Intimate"],
  Sentimental: ["Sentimental", "Reflective", "Intimate"],
  Warm: ["Warm"],
  Cozy: ["Cozy", "Warm"],
  Reflective: ["Reflective"],
  Happy: ["Happy", "Bright", "Sunny"],
  Floating: ["Floating", "Open", "Dreamy", "Weightless"],
};

const canonicalMoodByLabel = new Map(catalogueMoodFilters.map((mood) => [mood.toLocaleLowerCase(), mood]));

export function moodFilterAliases(value: string): readonly string[] {
  const canonicalMood = canonicalMoodByLabel.get(value.trim().toLocaleLowerCase());
  return canonicalMood ? catalogueMoodAliases[canonicalMood] : [value.trim()];
}

export function trackMatchesMood(trackMoods: readonly string[], selectedMood: string): boolean {
  const normalizedTrackMoods = new Set(trackMoods.map((mood) => mood.trim().toLocaleLowerCase()));
  return moodFilterAliases(selectedMood).some((mood) => normalizedTrackMoods.has(mood.toLocaleLowerCase()));
}
