"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { genres, tracks, useCategories, type MusicUseSlug, type Track } from "../data/catalog";
import "../catalog-v26.css";

const useNames = new Map(useCategories.map((category) => [category.slug, category.label]));

const waveHeights = [26, 54, 36, 72, 46, 92, 58, 34, 68, 42, 80, 52, 30, 64, 44, 88, 38, 60, 28, 56, 76, 40, 66, 32];

function Waveform({ trackId }: { trackId: string }) {
  const offset = trackId.charCodeAt(trackId.length - 1) % waveHeights.length;
  return (
    <span className="catalogue-v26-waveform" aria-hidden="true">
      {waveHeights.map((_, index) => <i key={index} style={{ height: `${waveHeights[(index + offset) % waveHeights.length]}%` }} />)}
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

export function CatalogueExplorer({ compact = false, showUseCases = true }: { compact?: boolean; showUseCases?: boolean }) {
  const locationSearch = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerLocationSearch);
  const urlParams = useMemo(() => new URLSearchParams(locationSearch), [locationSearch]);
  const urlUse = urlParams.get("use");
  const urlGenre = urlParams.get("genre");
  const validUrlUse = useCategories.some((category) => category.slug === urlUse) ? urlUse as MusicUseSlug : "all";
  const validUrlGenre = genres.includes(urlGenre ?? "") ? urlGenre! : "All genres";
  const [queryDraft, setQueryDraft] = useState<string | null>(null);
  const [useDraft, setUseDraft] = useState<MusicUseSlug | "all" | null>(null);
  const [genreDraft, setGenreDraft] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const query = queryDraft ?? urlParams.get("q") ?? "";
  const activeUse = useDraft ?? validUrlUse;
  const genre = genreDraft ?? validUrlGenre;

  const updateLocation = (nextQuery: string, nextUse: MusicUseSlug | "all", nextGenre: string) => {
    if (compact) return;
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

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const chooseTrack = (track: Track) => setSelectedTrackId((current) => current === track.id ? null : track.id);
  const resetFilters = () => {
    setQueryDraft("");
    setGenreDraft("All genres");
    setUseDraft("all");
    updateLocation("", "all", "All genres");
  };

  if (compact) {
    return (
      <div className="catalogue-v26 catalogue-v26-compact">
        <div className="catalogue-featured" aria-label="Featured tracks from the Easy License catalogue">
          {tracks.map((track, index) => (
            <button
              className={selectedTrackId === track.id ? "featured-track is-selected" : "featured-track"}
              type="button"
              onClick={() => chooseTrack(track)}
              aria-expanded={selectedTrackId === track.id}
              key={track.id}
            >
              <img src={track.cover} alt={`Cover art for ${track.title} by ${track.artist}`} />
              <span className="featured-track-number">0{index + 1}</span>
              <span className="featured-track-meta"><small>{track.genre} · {track.streams}</small><strong>{track.title}</strong><em>{track.artist}</em></span>
              <i aria-hidden="true">Listen</i>
              <Waveform trackId={track.id} />
              <i className="featured-track-play" aria-hidden="true">{selectedTrackId === track.id ? "×" : "▶"}</i>
            </button>
          ))}
        </div>
        {selectedTrack && <SpotifyPlayer track={selectedTrack} compact onClose={() => setSelectedTrackId(null)} />}
      </div>
    );
  }

  return (
    <div className="catalogue-v26">
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

        <div className="catalogue-v26-track-list" aria-live="polite">
          {results.map((track, index) => (
            <article className={selectedTrackId === track.id ? "catalogue-v26-track is-open" : "catalogue-v26-track"} key={track.id}>
              <span className="catalogue-v26-track-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div className="catalogue-v26-track-copy">
                <span>{track.genre}</span>
                <h4>{track.title}</h4>
                <p>{track.artist}</p>
              </div>
              <Waveform trackId={track.id} />
              <div className="catalogue-v26-track-uses" aria-label="Suggested uses">
                {track.suggestedUses.slice(0, 3).map((slug) => <span key={slug}>{useNames.get(slug)}</span>)}
              </div>
              <span className="catalogue-v26-streams">{track.streams}</span>
              <button className="catalogue-v26-listen" type="button" onClick={() => chooseTrack(track)} aria-expanded={selectedTrackId === track.id}>
                <span aria-hidden="true">{selectedTrackId === track.id ? "×" : "▶"}</span>{selectedTrackId === track.id ? "Close" : "Play"}
              </button>
              {selectedTrackId === track.id && <SpotifyPlayer track={track} onClose={() => setSelectedTrackId(null)} />}
            </article>
          ))}
          {results.length === 0 && (
            <div className="catalogue-v26-empty">
              <span aria-hidden="true">⌕</span><h4>No track matches these filters.</h4><p>Try a broader search or return to the full selection.</p>
              <button type="button" onClick={resetFilters}>Clear filters</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SpotifyPlayer({ track, compact = false, onClose }: { track: Track; compact?: boolean; onClose: () => void }) {
  return (
    <div className={compact ? "catalogue-v26-player is-compact" : "catalogue-v26-player"}>
      <div className="catalogue-v26-player-head">
        <span><small>TRACK PREVIEW</small><strong>{track.title}</strong><em>{track.artist}</em></span>
        <button type="button" onClick={onClose} aria-label={`Close ${track.title} player`}>Close</button>
      </div>
      <iframe
        src={`https://open.spotify.com/embed/track/${track.spotifyId}?utm_source=generator&theme=0`}
        title={`Spotify player for ${track.title} by ${track.artist}`}
        width="100%"
        height="152"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    </div>
  );
}
