"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { genres, tracks, useCategories, type MusicUseSlug } from "../data/catalog";
import { useTrackPreview } from "../hooks/useTrackPreview";
import "../catalog-v26.css";
import { PlatformLogo } from "./PlatformLogo";

const useNames = new Map(useCategories.map((category) => [category.slug, category.label]));

const wavePattern = [26, 54, 36, 72, 46, 92, 58, 34, 68, 42, 80, 52, 30, 64, 44, 88, 38, 60, 28, 56, 76, 40, 66, 32];
const waveHeights = Array.from({ length: 48 }, (_, index) => wavePattern[index % wavePattern.length]);

function Waveform({ active, progress, trackId }: { active: boolean; progress: number; trackId: string }) {
  const offset = trackId.charCodeAt(trackId.length - 1) % waveHeights.length;
  return (
    <span className="catalogue-v26-waveform" aria-hidden="true">
      {waveHeights.map((_, index) => (
        <i
          className={active && index / waveHeights.length < progress ? "is-played" : undefined}
          key={index}
          style={{ height: `${waveHeights[(index + offset) % waveHeights.length]}%` }}
        />
      ))}
    </span>
  );
}

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("easy-license-urlchange", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("easy-license-urlchange", onStoreChange);
  };
}

function getLocationSearch() {
  return window.location.search;
}

function getServerLocationSearch() {
  return "";
}

export function CatalogueExplorer({ showUseCases = true, editorial = false }: { showUseCases?: boolean; editorial?: boolean }) {
  const locationSearch = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerLocationSearch);
  const urlParams = useMemo(() => new URLSearchParams(locationSearch), [locationSearch]);
  const urlUse = urlParams.get("use");
  const urlGenre = urlParams.get("genre");
  const validUrlUse = useCategories.some((category) => category.slug === urlUse) ? urlUse as MusicUseSlug : "all";
  const validUrlGenre = genres.includes(urlGenre ?? "") ? urlGenre! : "All genres";
  const [queryDraft, setQueryDraft] = useState<string | null>(null);
  const [useDraft, setUseDraft] = useState<MusicUseSlug | "all" | null>(null);
  const [genreDraft, setGenreDraft] = useState<string | null>(null);
  const preview = useTrackPreview();
  const query = queryDraft ?? urlParams.get("q") ?? "";
  const activeUse = useDraft ?? validUrlUse;
  const genre = genreDraft ?? validUrlGenre;

  const updateLocation = (nextQuery: string, nextUse: MusicUseSlug | "all", nextGenre: string) => {
    const url = new URL(window.location.href);
    if (nextQuery.trim()) url.searchParams.set("q", nextQuery.trim());
    else url.searchParams.delete("q");
    if (nextUse !== "all") url.searchParams.set("use", nextUse);
    else url.searchParams.delete("use");
    if (nextGenre !== "All genres") url.searchParams.set("genre", nextGenre);
    else url.searchParams.delete("genre");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new Event("easy-license-urlchange"));
  };

  const updateQuery = (nextQuery: string) => {
    setQueryDraft(nextQuery);
    updateLocation(nextQuery, activeUse, genre);
  };

  const updateUse = (nextUse: MusicUseSlug | "all") => {
    setUseDraft(nextUse);
    updateLocation(query, nextUse, genre);
  };

  const updateGenre = (nextGenre: string) => {
    setGenreDraft(nextGenre);
    updateLocation(query, activeUse, nextGenre);
  };

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tracks.filter((track) => {
      const suggestedUses = track.suggestedUses.map((slug) => useNames.get(slug) ?? slug).join(" ");
      const haystack = `${track.title} ${track.artist} ${track.genre} ${track.moods.join(" ")} ${suggestedUses}`.toLowerCase();
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (genre === "All genres" || track.genre === genre) &&
        (activeUse === "all" || track.suggestedUses.includes(activeUse))
      );
    });
  }, [activeUse, genre, query]);

  useEffect(() => {
    if (preview.activeTrackId && !results.some((track) => track.id === preview.activeTrackId)) preview.stop();
  }, [preview.activeTrackId, preview.stop, results]);

  const resetFilters = () => {
    setQueryDraft("");
    setGenreDraft("All genres");
    setUseDraft("all");
    updateLocation("", "all", "All genres");
  };

  return (
    <div className={editorial ? "catalogue-v26 catalogue-v26-editorial" : "catalogue-v26"}>
      <div className="catalogue-v26-search-row">
        <label className="catalogue-v26-search">
          <span>Search the catalogue</span>
          <div><i aria-hidden="true">⌕</i><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Track, artist, mood or use" /></div>
        </label>
        <label className="catalogue-v26-select">
          <span>Genre</span>
          <select value={genre} onChange={(event) => updateGenre(event.target.value)}>
            {genres.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {showUseCases && <section className="catalogue-v26-uses" aria-labelledby="catalogue-use-heading">
        <div className="catalogue-v26-subhead">
          <div><span>Browse by use</span><h3 id="catalogue-use-heading">Start with what you&apos;re making.</h3></div>
          {activeUse !== "all" && <button type="button" onClick={() => updateUse("all")}>Show every use</button>}
        </div>
        <div className="catalogue-v26-use-grid">
          {useCategories.map((category) => (
            <button
              className={activeUse === category.slug ? "catalogue-v26-use is-active" : "catalogue-v26-use"}
              type="button"
              onClick={() => updateUse(activeUse === category.slug ? "all" : category.slug)}
              aria-pressed={activeUse === category.slug}
              key={category.slug}
            >
              <img src={category.image} alt="" />
              <span><strong>{category.label}</strong><small>{category.description}</small></span>
            </button>
          ))}
        </div>
      </section>}

      <section className="catalogue-v26-results" aria-labelledby="catalogue-results-heading">
        <div className="catalogue-v26-subhead catalogue-v26-results-head">
          <div>
            <span>{activeUse === "all" ? "Curated selection" : useNames.get(activeUse)}</span>
            <h3 id="catalogue-results-heading">{results.length} {results.length === 1 ? "track" : "tracks"}</h3>
          </div>
          <p>Play a preview, then check eligibility for your intended use before downloading.</p>
        </div>

        <div className="catalogue-v26-track-list">
          {results.map((track, index) => {
            const isActive = preview.activeTrackId === track.id;
            const isPlaying = isActive && preview.isPlaying;
            const hasError = preview.errorTrackId === track.id;

            return (
              <article className={`${isActive ? "catalogue-v26-track is-open" : "catalogue-v26-track"}${hasError ? " has-preview-error" : ""}`} key={track.id}>
                <span className="catalogue-v26-track-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {editorial && <img className="catalogue-v26-track-cover" src={track.cover} alt={`Album cover for ${track.title} by ${track.artist}`} width={640} height={640} loading="lazy" decoding="async" />}
                <div className="catalogue-v26-track-copy">
                  <span>{track.genre}</span>
                  <h4>{track.title}</h4>
                  <p>{track.artist}</p>
                  <a className="catalogue-v26-preview-source" href={track.spotifyUrl} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} on Spotify`}>
                    <PlatformLogo platform="Spotify" bare />
                    <span>Spotify</span>
                  </a>
                </div>
                <Waveform active={isActive} progress={isActive ? preview.progress : 0} trackId={track.id} />
                <div className="catalogue-v26-track-uses" aria-label="Suggested uses">
                  {track.suggestedUses.slice(0, 3).map((slug) => <span key={slug}>{useNames.get(slug)}</span>)}
                </div>
                <span className="catalogue-v26-streams">{track.streams}</span>
                <button
                  className="catalogue-v26-listen"
                  type="button"
                  onClick={() => preview.toggle({ id: track.id, previewUrl: track.previewUrl })}
                  data-playing={isPlaying || undefined}
                  aria-label={`${isPlaying ? "Pause" : "Play"} preview of ${track.title} by ${track.artist}`}
                >
                  <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>{isPlaying ? "Pause" : "Play"}
                </button>
                {hasError && (
                  <span className="catalogue-v26-preview-error" role="status">
                    Preview unavailable. <a href={track.spotifyUrl} target="_blank" rel="noreferrer">Open on Spotify</a>
                  </span>
                )}
              </article>
            );
          })}
          {results.length === 0 && (
            <div className="catalogue-v26-empty">
              <span aria-hidden="true">⌕</span><h4>No track matches these filters.</h4><p>Try a broader search or return to the full selection.</p>
              <button type="button" onClick={resetFilters}>Clear filters</button>
            </div>
          )}
        </div>
      </section>

      <audio
        ref={preview.audioRef}
        preload="none"
        onPlay={preview.onPlay}
        onPause={preview.onPause}
        onTimeUpdate={preview.onTimeUpdate}
        onEnded={preview.onEnded}
        onError={preview.onError}
        hidden
      />
    </div>
  );
}
