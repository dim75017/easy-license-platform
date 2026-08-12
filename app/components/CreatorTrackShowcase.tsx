"use client";

import Link from "next/link";
import { useEffect } from "react";
import { creatorPlaylistTracks, type CreatorPlaylistTrack } from "../data/catalog";
import { useTrackPreview } from "../hooks/useTrackPreview";
import { PlatformLogo } from "./PlatformLogo";

const wavePattern = [38, 72, 52, 88, 46, 64, 32, 78, 56, 92, 42, 68, 28, 58, 84, 48, 76, 36, 66, 94, 44, 62, 34, 80];
const waveHeights = Array.from({ length: 48 }, (_, index) => wavePattern[index % wavePattern.length]);

function TrackWave({ active, offset, progress }: { active: boolean; offset: number; progress: number }) {
  return (
    <span className="creator-editorial-wave" aria-hidden="true">
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

const defaultTracks = creatorPlaylistTracks.slice(0, 8);

export function CreatorTrackShowcase({ tracks = defaultTracks, filterLabel }: { tracks?: readonly CreatorPlaylistTrack[]; filterLabel?: string }) {
  const preview = useTrackPreview();

  useEffect(() => {
    if (preview.activeTrackId && !tracks.some((track) => track.spotifyId === preview.activeTrackId)) preview.stop();
  }, [preview.activeTrackId, preview.stop, tracks]);

  return (
    <div className="creator-editorial-showcase">
      {filterLabel && (
        <div className="creator-editorial-filter" role="status">
          <span>{tracks.length} {tracks.length === 1 ? "track" : "tracks"} for <strong>{filterLabel}</strong></span>
          <Link href="/catalog#music-library">Show all tracks</Link>
        </div>
      )}

      {tracks.length > 0 ? <div className="creator-editorial-grid" role="list" aria-label={`${tracks.length} tracks selected across featured Symbiome playlists`}>
        {tracks.map((track, index) => {
          const isActive = preview.activeTrackId === track.spotifyId;
          const isPlaying = isActive && preview.isPlaying;
          const hasError = preview.errorTrackId === track.spotifyId;

          return (
            <article
              className={`${isActive ? "creator-editorial-track is-selected" : "creator-editorial-track"}${hasError ? " has-preview-error" : ""}`}
              key={track.playlistId}
              role="listitem"
              aria-label={`${track.title} by ${track.artist}`}
            >
              <span className="creator-editorial-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="creator-editorial-cover">
                <img src={track.cover} alt={`Album cover for ${track.title} by ${track.artist}`} width={640} height={640} loading="lazy" decoding="async" />
              </span>
              <span className="creator-editorial-copy">
                <small>From {track.playlistTitle}</small>
                <strong>{track.title}</strong>
                <em>{track.artist}</em>
                <span className="creator-editorial-meta">
                  <span className="creator-editorial-genre">{track.genre}</span>
                  <a href={`https://open.spotify.com/track/${track.spotifyId}`} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} on Spotify`}>
                    <PlatformLogo platform="Spotify" bare />
                    <span>Spotify</span>
                  </a>
                </span>
              </span>
              <TrackWave active={isActive} offset={index} progress={isActive ? preview.progress : 0} />
              <button
                className="creator-editorial-side"
                type="button"
                onClick={() => preview.toggle({ id: track.spotifyId, previewUrl: track.previewUrl })}
                data-playing={isPlaying || undefined}
                aria-label={`${isPlaying ? "Pause" : "Play"} preview of ${track.title} by ${track.artist}`}
              >
                <time dateTime={track.durationIso}>{track.duration}</time>
                <i className={isPlaying ? "is-pause" : "is-play"} aria-hidden="true" />
              </button>
              {hasError && (
                <span className="creator-editorial-error" role="status">
                  Preview unavailable. <a href={`https://open.spotify.com/track/${track.spotifyId}`} target="_blank" rel="noreferrer">Open on Spotify</a>
                </span>
              )}
            </article>
          );
        })}
      </div> : (
        <div className="creator-editorial-empty" role="status">
          <strong>No tracks match this selection yet.</strong>
          <Link href="/catalog#music-library">Show all editor-selected tracks</Link>
        </div>
      )}

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
