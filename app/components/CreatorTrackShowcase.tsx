"use client";

import { useState } from "react";
import { creatorPlaylistTracks } from "../data/catalog";

const waveHeights = [38, 72, 52, 88, 46, 64, 32, 78, 56, 92, 42, 68];

function TrackWave({ offset }: { offset: number }) {
  return (
    <span className="creator-editorial-wave" aria-hidden="true">
      {waveHeights.map((_, index) => (
        <i key={index} style={{ height: `${waveHeights[(index + offset) % waveHeights.length]}%` }} />
      ))}
    </span>
  );
}

export function CreatorTrackShowcase() {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const selectedTrack = creatorPlaylistTracks.find((track) => track.spotifyId === selectedTrackId) ?? null;

  return (
    <div className="creator-editorial-showcase">
      <div className="creator-editorial-grid" aria-label="Eight tracks selected across featured Symbiome playlists">
        {creatorPlaylistTracks.slice(0, 8).map((track, index) => {
          const isSelected = selectedTrackId === track.spotifyId;
          return (
            <button
              className={isSelected ? "creator-editorial-track is-selected" : "creator-editorial-track"}
              type="button"
              onClick={() => setSelectedTrackId(isSelected ? null : track.spotifyId)}
              aria-expanded={isSelected}
              aria-controls={isSelected ? "creator-track-player" : undefined}
              aria-label={`${isSelected ? "Close" : "Play"} ${track.title} by ${track.artist}, from the ${track.playlistTitle} playlist`}
              key={track.playlistId}
            >
              <span className="creator-editorial-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="creator-editorial-cover">
                <img src={track.cover} alt={`Album cover for ${track.title} by ${track.artist}`} width={640} height={640} loading="lazy" decoding="async" />
              </span>
              <span className="creator-editorial-copy">
                <small>From {track.playlistTitle}</small>
                <strong>{track.title}</strong>
                <em>{track.artist}</em>
                <span className="creator-editorial-genre">{track.genre}</span>
              </span>
              <TrackWave offset={index} />
              <span className="creator-editorial-side">
                <time dateTime={track.durationIso}>{track.duration}</time>
                <i className={isSelected ? "is-close" : "is-play"} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      {selectedTrack && (
        <section className="creator-editorial-player" id="creator-track-player" aria-label={`Player for ${selectedTrack.title}`}>
          <div>
            <span>Now playing from {selectedTrack.playlistTitle}</span>
            <strong>{selectedTrack.title} <em>by {selectedTrack.artist}</em></strong>
            <button type="button" onClick={() => setSelectedTrackId(null)} aria-label="Close music player">Close player</button>
          </div>
          <iframe
            title={`Listen to ${selectedTrack.title} by ${selectedTrack.artist}`}
            src={`https://open.spotify.com/embed/track/${selectedTrack.spotifyId}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </section>
      )}
    </div>
  );
}
