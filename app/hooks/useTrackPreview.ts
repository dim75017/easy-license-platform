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
  const [volume, setVolumeState] = useState(.8);
  const [isMuted, setIsMuted] = useState(false);
  const lastAudibleVolumeRef = useRef(.8);

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

  const setVolume = useCallback((nextValue: number) => {
    const nextVolume = Number.isFinite(nextValue) ? Math.min(1, Math.max(0, nextValue)) : .8;
    if (nextVolume > 0) lastAudibleVolumeRef.current = nextVolume;
    setVolumeState(nextVolume);
    setIsMuted(nextVolume === 0);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = nextVolume;
      audio.muted = nextVolume === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (isMuted || volume === 0) {
      const restoredVolume = Math.max(.05, lastAudibleVolumeRef.current || .8);
      setVolumeState(restoredVolume);
      setIsMuted(false);
      if (audio) {
        audio.volume = restoredVolume;
        audio.muted = false;
      }
      return;
    }

    lastAudibleVolumeRef.current = volume;
    setIsMuted(true);
    if (audio) audio.muted = true;
  }, [isMuted, volume]);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [isMuted, volume]);

  return {
    activeTrackId,
    audioRef,
    canSeek: duration > 0,
    currentTime,
    duration,
    errorTrackId,
    isMuted,
    isPlaying,
    onEnded,
    onError,
    onLoadedMetadata: syncTimeline,
    onPause: () => setIsPlaying(false),
    onPlay: () => setIsPlaying(true),
    onTimeUpdate,
    progress,
    seekTo,
    setVolume,
    stop,
    toggle,
    toggleMute,
    volume,
  };
}
