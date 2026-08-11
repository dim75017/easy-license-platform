"use client";

import { useEffect, useRef, useState } from "react";

export type ArtistMarqueeItem = {
  name: string;
  style: string;
  image: string;
};

function ArtistSequence({ artists, duplicate = false }: { artists: ArtistMarqueeItem[]; duplicate?: boolean }) {
  return (
    <div className={`home26-artist-sequence${duplicate ? " is-duplicate" : ""}`} role={duplicate ? undefined : "list"} aria-hidden={duplicate ? "true" : undefined}>
      {artists.map((artist) => (
        <article role={duplicate ? undefined : "listitem"} key={`${duplicate ? "duplicate-" : ""}${artist.name}`}>
          <div className="home26-artist-photo">
            <img
              className={artist.name === "Hoogway" ? "home26-artist-image-hoogway" : undefined}
              src={artist.image}
              alt=""
              width={640}
              height={640}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          </div>
          <div className="home26-artist-meta"><strong>{artist.name}</strong><span>{artist.style}</span></div>
        </article>
      ))}
    </div>
  );
}

export function ArtistMarquee({ artists }: { artists: ArtistMarqueeItem[] }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "180px 0px",
      threshold: 0.02,
    });
    const handleVisibility = () => setPageVisible(document.visibilityState === "visible");

    observer.observe(region);
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const motionPaused = paused || !inView || !pageVisible;

  return (
    <div ref={regionRef} className="home26-artist-grid" data-reveal="group" role="region" aria-label="Featured Symbiose artists">
      <button
        className="home26-artist-motion"
        type="button"
        aria-label={paused ? "Play the artist carousel" : "Pause the artist carousel"}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
      </button>
      <div className="home26-artist-track" data-paused={motionPaused ? "true" : undefined}>
        <ArtistSequence artists={artists} />
        <ArtistSequence artists={artists} duplicate />
      </div>
    </div>
  );
}
