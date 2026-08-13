"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PreviewTrack = {
  id: string;
  previewUrl: string;
};

export function useTrackPreview() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeTrackIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [errorTrackId, setErrorTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const syncTimeline = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextCurrentTime = Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
    const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    setCurrentTime(nextCurrentTime);
    setDuration(nextDuration);
    setProgress(nextDuration > 0 ? Math.min(1, nextCurrentTime / nextDuration) : 0);
  }, []);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    activeTrackIdRef.current = null;
    setActiveTrackId(null);
    setErrorTrackId(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
  }, []);

  const toggle = useCallback(async ({ id, previewUrl }: PreviewTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setErrorTrackId(null);

    if (activeTrackId === id) {
      if (audio.paused) {
        try {
          await audio.play();
        } catch {
          if (requestIdRef.current === requestId) {
            setErrorTrackId(id);
            setIsPlaying(false);
          }
        }
      } else {
        audio.pause();
      }
      return;
    }

    activeTrackIdRef.current = id;
    audio.pause();
    audio.src = previewUrl;
    audio.currentTime = 0;
    audio.load();
    setActiveTrackId(id);
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);

    try {
      await audio.play();
    } catch {
      if (requestIdRef.current === requestId) {
        setErrorTrackId(id);
        setIsPlaying(false);
      }
    }
  }, [activeTrackId]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const nextTime = Math.min(audio.duration, Math.max(0, seconds));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    setProgress(nextTime / audio.duration);
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    seekTo(audio.currentTime + seconds);
  }, [seekTo]);

  const onTimeUpdate = syncTimeline;

  const onEnded = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress(0);
  }, []);

  const onError = useCallback(() => {
    setErrorTrackId(activeTrackIdRef.current);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setProgress(0);
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  return {
    activeTrackId,
    audioRef,
    canSeek: duration > 0,
    currentTime,
    duration,
    errorTrackId,
    isPlaying,
    onEnded,
    onError,
    onLoadedMetadata: syncTimeline,
    onPause: () => setIsPlaying(false),
    onPlay: () => setIsPlaying(true),
    onTimeUpdate,
    progress,
    seekBy,
    seekTo,
    stop,
    toggle,
  };
}
