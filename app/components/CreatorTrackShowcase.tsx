"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef } from "react";
import { creatorPlaylistTracks, type CreatorPlaylistTrack } from "../data/catalog";
import { useTrackPreview } from "../hooks/useTrackPreview";

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

const TrackWave = memo(function TrackWave({
  active,
  canSeek,
  currentTime,
  duration,
  progress,
  seed,
  title,
  onSeek,
}: {
  active: boolean;
  canSeek: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  seed: string;
  title: string;
  onSeek: (seconds: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const progressRef = useRef(clampedProgress);

  const drawWave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.max(1, Math.round(width * pixelRatio));
    const targetHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(canvas);
    const baseColor = styles.color;
    const playedColor = styles.getPropertyValue("--public-wave-played").trim() || "#e06343";
    const seedValue = Array.from(seed).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
    const pitch = width < 220 ? 5 : 6;
    const barWidth = 2.4;
    const snappedBarWidth = Math.max(1, Math.round(barWidth * pixelRatio)) / pixelRatio;
    const count = Math.max(1, Math.floor(width / pitch));
    const playedBars = Math.round(progressRef.current * count);

    for (let index = 0; index < count; index += 1) {
      const position = count > 1 ? index / (count - 1) : 0;
      const fastDetail = Math.abs(Math.sin((index + seedValue) * .613));
      const midDetail = Math.abs(Math.sin((index + seedValue) * .173 + 1.4));
      const slowEnvelope = .66 + Math.abs(Math.sin((index + seedValue) * .041 + .8)) * .34;
      const tail = position > .86 ? Math.max(.13, (1 - position) / .14) : 1;
      const amplitude = Math.max(.22, Math.min(1, (.3 + fastDetail * .42 + midDetail * .31) * slowEnvelope * tail));
      const barHeight = Math.max(3, Math.round(height * amplitude * pixelRatio) / pixelRatio);
      const x = Math.round(index * pitch * pixelRatio) / pixelRatio;
      const y = Math.round(((height - barHeight) / 2) * pixelRatio) / pixelRatio;

      context.globalAlpha = index < playedBars ? 1 : .2;
      context.fillStyle = index < playedBars ? playedColor : baseColor;
      context.fillRect(x, y, snappedBarWidth, barHeight);
    }

    context.globalAlpha = 1;
  }, [seed]);

  useEffect(() => {
    progressRef.current = clampedProgress;
    drawWave();
  }, [clampedProgress, drawWave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", drawWave);
      return () => window.removeEventListener("resize", drawWave);
    }
    const observer = new ResizeObserver(drawWave);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawWave]);

  return (
    <span className="creator-editorial-wave">
      <canvas ref={canvasRef} aria-hidden="true" />
      <input
        type="range"
        min="0"
        max={active && canSeek ? duration : 1}
        step="0.1"
        value={active ? currentTime : 0}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
        disabled={!active || !canSeek}
        aria-label={`Seek in preview of ${title}`}
        aria-valuetext={`${formatPlaybackTime(active ? currentTime : 0)} of ${active && canSeek ? formatPlaybackTime(duration) : "not loaded"}`}
      />
    </span>
  );
});

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

      {tracks.length > 0 ? <>
        <div className="creator-editorial-table-head" aria-hidden="true">
          <span>Track</span>
          <span>Player</span>
          <span>Genre</span>
          <span>Mood</span>
        </div>
        <div className="creator-editorial-grid" role="list" aria-label={`${tracks.length} tracks selected across featured Symbiome playlists`}>
        {tracks.map((track) => {
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
              <span className="creator-editorial-identity">
                <span className="creator-editorial-cover">
                  <img src={track.cover} alt={`Album cover for ${track.title} by ${track.artist}`} width={640} height={640} loading="lazy" decoding="async" />
                </span>
                <span className="creator-editorial-copy">
                  <strong>{track.title}</strong>
                  <em>{track.artist}</em>
                </span>
              </span>
              <span className="creator-editorial-inline-player" role="group" aria-label={`Preview player for ${track.title}`}>
                <button
                  className="creator-editorial-side"
                  type="button"
                  onClick={() => preview.toggle({ id: track.spotifyId, previewUrl: track.previewUrl })}
                  data-playing={isPlaying || undefined}
                  aria-label={`${isPlaying ? "Pause" : "Play"} preview of ${track.title} by ${track.artist}`}
                  aria-pressed={isPlaying}
                >
                  <i className={isPlaying ? "is-pause" : "is-play"} aria-hidden="true" />
                </button>
                <time dateTime={`PT${Math.floor(isActive ? preview.currentTime : 0)}S`}>{formatPlaybackTime(isActive ? preview.currentTime : 0)}</time>
                <TrackWave
                  active={isActive}
                  canSeek={preview.canSeek}
                  currentTime={isActive ? preview.currentTime : 0}
                  duration={preview.duration}
                  progress={isActive ? preview.progress : 0}
                  seed={track.spotifyId}
                  title={track.title}
                  onSeek={preview.seekTo}
                />
                <time dateTime={isActive && preview.canSeek ? `PT${Math.floor(preview.duration)}S` : track.durationIso}>
                  {isActive && preview.canSeek ? formatPlaybackTime(preview.duration) : track.duration}
                </time>
              </span>
              <span className="creator-editorial-taxonomy creator-editorial-genre">
                <small>Genre</small>
                <span>{track.genre}</span>
              </span>
              <span className="creator-editorial-taxonomy creator-editorial-mood">
                <small>Mood</small>
                <span>{track.moods.slice(0, 2).join(" · ")}</span>
              </span>
              {hasError && (
                <span className="creator-editorial-error" role="status">
                  Preview unavailable.
                </span>
              )}
            </article>
          );
        })}
        </div>
      </> : (
        <div className="creator-editorial-empty" role="status">
          <strong>No tracks match this selection yet.</strong>
          <Link href="/catalog#music-library">Show all editor-selected tracks</Link>
        </div>
      )}

      <div className="creator-editorial-library-cta">
        <span>Keep listening with every track in one place.</span>
        <Link className="creator-editorial-library-link" href="/app?view=music">
          Listen to the full library
          <i aria-hidden="true">→</i>
        </Link>
      </div>

      <audio
        ref={preview.audioRef}
        preload="none"
        playsInline
        onPlay={preview.onPlay}
        onPause={preview.onPause}
        onTimeUpdate={preview.onTimeUpdate}
        onLoadedMetadata={preview.onLoadedMetadata}
        onDurationChange={preview.onLoadedMetadata}
        onEnded={preview.onEnded}
        onError={preview.onError}
        hidden
      />
    </div>
  );
}
