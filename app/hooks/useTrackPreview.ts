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
  const [progress, setProgress] = useState(0);

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

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    setProgress(Math.min(1, audio.currentTime / audio.duration));
  }, []);

  const onEnded = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const onError = useCallback(() => {
    setErrorTrackId(activeTrackIdRef.current);
    setIsPlaying(false);
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  return {
    activeTrackId,
    audioRef,
    errorTrackId,
    isPlaying,
    onEnded,
    onError,
    onPause: () => setIsPlaying(false),
    onPlay: () => setIsPlaying(true),
    onTimeUpdate,
    progress,
    stop,
    toggle,
  };
}
