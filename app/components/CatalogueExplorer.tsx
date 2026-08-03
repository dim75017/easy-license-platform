"use client";

import { useMemo, useState } from "react";
import { moods, tracks, uses } from "../data/catalog";

const wave = [22, 58, 36, 76, 48, 64, 30, 84, 44, 66, 34, 54, 72, 40, 60, 26];

export function CatalogueExplorer({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState("All moods");
  const [use, setUse] = useState("All uses");
  const [playing, setPlaying] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<string[]>([]);

  const results = useMemo(() => {
    const filtered = tracks.filter((track) => {
      const haystack = `${track.title} ${track.artist} ${track.mood} ${track.use}`.toLowerCase();
      return (
        haystack.includes(query.toLowerCase()) &&
        (mood === "All moods" || track.mood === mood) &&
        (use === "All uses" || track.use === use)
      );
    });
    return compact ? filtered.slice(0, 4) : filtered;
  }, [compact, mood, query, use]);

  const toggleDownload = (id: string) => {
    setDownloaded((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  };

  return (
    <div className={compact ? "catalogue-explorer is-compact" : "catalogue-explorer"}>
      <div className="catalogue-toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by mood, track or use"
            aria-label="Search catalogue"
          />
          <kbd>⌘ K</kbd>
        </label>
        <label className="select-field">
          <span>Mood</span>
          <select value={mood} onChange={(event) => setMood(event.target.value)}>
            {moods.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="select-field">
          <span>Use</span>
          <select value={use} onChange={(event) => setUse(event.target.value)}>
            {uses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className="track-list" aria-live="polite">
        {results.map((track) => {
          const isPlaying = playing === track.id;
          const isDownloaded = downloaded.includes(track.id);
          return (
            <article className={isPlaying ? `track-row accent-${track.accent} is-playing` : `track-row accent-${track.accent}`} key={track.id}>
              <button
                className="track-play"
                type="button"
                aria-label={`${isPlaying ? "Pause" : "Play"} ${track.title}`}
                onClick={() => setPlaying(isPlaying ? null : track.id)}
              >
                {isPlaying ? "Ⅱ" : "▶"}
              </button>
              <div className="track-title">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </div>
              <div className="track-wave" aria-hidden="true">
                {wave.map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} className={isPlaying && index < 7 ? "active" : ""} />
                ))}
              </div>
              <div className="track-tag"><span>{track.mood}</span><small>{track.use}</small></div>
              <div className="track-bpm"><strong>{track.bpm}</strong><small>BPM</small></div>
              <span className="track-duration">{track.duration}</span>
              <button
                className={isDownloaded ? "track-download is-done" : "track-download"}
                type="button"
                onClick={() => toggleDownload(track.id)}
                aria-label={`${isDownloaded ? "Remove" : "Add"} ${track.title} ${isDownloaded ? "from" : "to"} downloads`}
              >
                {isDownloaded ? "✓" : "↓"}
              </button>
            </article>
          );
        })}
        {results.length === 0 && (
          <div className="empty-state">
            <span>⌕</span>
            <strong>No track found</strong>
            <p>Try another mood or remove a filter.</p>
          </div>
        )}
      </div>
      {!compact && (
        <div className="catalogue-footnote">
          <span><i /> Catalogue data shown for product demonstration.</span>
          <span>{results.length} of {tracks.length} preview tracks</span>
        </div>
      )}
    </div>
  );
}
