export const COVER_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

export const COVER_THUMBNAIL_FALLBACK_CACHE_CONTROL =
  "public, max-age=60, s-maxage=60, stale-while-revalidate=300";

const coverStorageKeyPattern =
  /^catalog\/releases\/(\d+)\/cover_artwork\/([a-f0-9]{64})\.(?:jpe?g|png|webp)$/u;

export function coverSourceSha256(
  releaseId: number,
  storageKey: string,
): string | null {
  const match = coverStorageKeyPattern.exec(storageKey);
  if (!match || Number(match[1]) !== releaseId) return null;
  return match[2];
}

export function coverThumbnailStorageKey(
  releaseId: number,
  coverStorageKey: string,
): string | null {
  const sourceSha256 = coverSourceSha256(releaseId, coverStorageKey);
  return sourceSha256
    ? `catalog/releases/${releaseId}/cover_thumbnail/${sourceSha256}.webp`
    : null;
}

function normalizedEtag(value: string): string {
  const normalized = value.trim();
  return normalized.startsWith("W/") ? normalized.slice(2) : normalized;
}

export function ifNoneMatchMatches(
  value: string | null,
  etag: string,
): boolean {
  if (!value) return false;
  return value.split(",").some((candidate) => (
    candidate.trim() === "*"
    || normalizedEtag(candidate) === normalizedEtag(etag)
  ));
}
