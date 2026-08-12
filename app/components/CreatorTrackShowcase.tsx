"use client";

import { creatorPlaylistTracks } from "../data/catalog";
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

export function CreatorTrackShowcase() {
  const preview = useTrackPreview();

  return (
    <div className="creator-editorial-showcase">
      <div className="creator-editorial-grid" aria-label="Eight tracks selected across featured Symbiome playlists">
        {creatorPlaylistTracks.slice(0, 8).map((track, index) => {
          const isActive = preview.activeTrackId === track.spotifyId;
          const isPlaying = isActive && preview.isPlaying;
          const hasError = preview.errorTrackId === track.spotifyId;

          return (
            <article
              className={`${isActive ? "creator-editorial-track is-selected" : "creator-editorial-track"}${hasError ? " has-preview-error" : ""}`}
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
                <span className="creator-editorial-meta">
                  <span className="creator-editorial-genre">{track.genre}</span>
                  <a href={`https://open.spotify.com/track/${track.spotifyId}`} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} on Spotify`}>
                    <PlatformLogo platform="Spotify" bare />
                    <span>Spotify ↗</span>
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
                  Preview unavailable. <a href={`https://open.spotify.com/track/${track.spotifyId}`} target="_blank" rel="noreferrer">Open on Spotify ↗</a>
                </span>
              )}
            </article>
          );
        })}
      </div>

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
