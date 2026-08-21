export const catalogPlaylistRules = {
  "lofi-study": { genres: ["Lofi"] },
  "synthwave-night": { genres: ["Synthwave"] },
  "peaceful-piano": { genres: ["Piano"] },
  "dark-ambient": { genres: ["Dark Ambient", "Ambient"] },
  "jazz-lofi": { genres: ["Jazz", "Jazz Lofi"] },
  "chill-house": { genres: ["Chill House", "Synthwave"] },
  "sleep-ambient": { genres: ["Ambient"] },
  "chill-guitar": { genres: ["Guitar", "Acoustic"] },
  "relaxing-classical": { genres: ["Classical"] },
  "bossa-lofi": { genres: ["Bossa Lofi", "Lofi"] },
  "christmas-music": { genres: ["Seasonal Lofi", "Lofi"] },
  "halloween-music": { genres: ["Seasonal Lofi", "Dark Ambient"] },
} as const;

export type CatalogPlaylistId = keyof typeof catalogPlaylistRules;

export function isCatalogPlaylistId(value: string): value is CatalogPlaylistId {
  return Object.prototype.hasOwnProperty.call(catalogPlaylistRules, value);
}

export function catalogPlaylistRule(value: string) {
  return isCatalogPlaylistId(value) ? catalogPlaylistRules[value] : null;
}
