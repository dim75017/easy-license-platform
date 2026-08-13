"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { creatorPlaylistTracks, useCategories, type CreatorPlaylistTrack, type MusicUseSlug } from "../data/catalog";
import { CreatorTrackShowcase } from "./CreatorTrackShowcase";

const useLabels = new Map(useCategories.map((category) => [category.slug, category.label]));
const validUses = new Set<MusicUseSlug>(useCategories.map((category) => category.slug));

export function FilteredCreatorTrackShowcase() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const requestedUse = searchParams.get("use");
  const use = requestedUse && validUses.has(requestedUse as MusicUseSlug) ? requestedUse as MusicUseSlug : null;
  const genre = searchParams.get("genre")?.trim() ?? "";

  const tracks = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase();
    const normalizedGenre = genre.toLocaleLowerCase();

    return creatorPlaylistTracks.slice(0, 8).filter((track: CreatorPlaylistTrack) => {
      const haystack = `${track.title} ${track.artist} ${track.playlistTitle} ${track.genre} ${track.moods.join(" ")}`.toLocaleLowerCase();
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (!use || track.suggestedUses.includes(use)) &&
        (!normalizedGenre || track.genre.toLocaleLowerCase() === normalizedGenre)
      );
    });
  }, [genre, query, use]);

  const filterLabel = [query, use ? useLabels.get(use) : null, genre].filter(Boolean).join(" · ");
  return <CreatorTrackShowcase tracks={tracks} filterLabel={filterLabel || undefined} />;
}
