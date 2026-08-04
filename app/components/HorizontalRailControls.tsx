"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type HorizontalRailControlsProps = {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  trackClassName?: string;
  controlsClassName?: string;
};

type ScrollAvailability = {
  previous: boolean;
  next: boolean;
};

const EDGE_TOLERANCE = 2;

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function HorizontalRailControls({
  children,
  ariaLabel,
  className,
  trackClassName,
  controlsClassName,
}: HorizontalRailControlsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const trackId = `horizontal-rail-${generatedId.replace(/:/g, "")}`;
  const [availability, setAvailability] = useState<ScrollAvailability>({
    previous: false,
    next: false,
  });

  const updateAvailability = useCallback(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const currentScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, track.scrollLeft),
    );

    const nextAvailability = {
      previous: currentScrollLeft > EDGE_TOLERANCE,
      next: currentScrollLeft < maxScrollLeft - EDGE_TOLERANCE,
    };

    setAvailability((currentAvailability) => {
      if (
        currentAvailability.previous === nextAvailability.previous &&
        currentAvailability.next === nextAvailability.next
      ) {
        return currentAvailability;
      }

      return nextAvailability;
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    updateAvailability();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateAvailability);
      return () => window.removeEventListener("resize", updateAvailability);
    }

    const resizeObserver = new ResizeObserver(updateAvailability);
    resizeObserver.observe(track);

    Array.from(track.children).forEach((child) => {
      if (child instanceof HTMLElement) {
        resizeObserver.observe(child);
      }
    });

    return () => resizeObserver.disconnect();
  }, [children, updateAvailability]);

  const scroll = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const trackBounds = track.getBoundingClientRect();
    const visibleChild = Array.from(track.children).find((child) => {
      if (!(child instanceof HTMLElement)) {
        return false;
      }

      const childBounds = child.getBoundingClientRect();
      return (
        childBounds.right > trackBounds.left + EDGE_TOLERANCE &&
        childBounds.left < trackBounds.right - EDGE_TOLERANCE
      );
    });

    const styles = window.getComputedStyle(track);
    const parsedGap = Number.parseFloat(styles.columnGap || styles.gap);
    const gap = Number.isFinite(parsedGap) ? parsedGap : 0;
    const itemWidth =
      visibleChild instanceof HTMLElement
        ? visibleChild.getBoundingClientRect().width
        : 0;
    const viewportStep = track.clientWidth * 0.86;
    const preferredStep = itemWidth > 0 ? itemWidth + gap : viewportStep;
    const step = Math.max(
      1,
      Math.min(preferredStep, viewportStep || preferredStep),
    );
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const remainingDistance =
      direction === 1
        ? maxScrollLeft - track.scrollLeft
        : Math.max(0, track.scrollLeft);
    const distance = Math.min(step, Math.max(0, remainingDistance));
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    track.scrollBy({
      left: direction * distance,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  return (
    <div className={joinClassNames("horizontal-rail", className)}>
      <div
        ref={trackRef}
        id={trackId}
        className={joinClassNames(
          "horizontal-rail__track",
          trackClassName,
        )}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={updateAvailability}
        style={{
          overflowX: "auto",
          overscrollBehaviorInline: "contain",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>

      <div
        className={joinClassNames(
          "horizontal-rail__controls",
          controlsClassName,
        )}
        role="group"
        aria-label={`${ariaLabel} controls`}
      >
        <button
          type="button"
          className="horizontal-rail__button horizontal-rail__button--previous"
          aria-label={`Previous item in ${ariaLabel}`}
          aria-controls={trackId}
          disabled={!availability.previous}
          onClick={() => scroll(-1)}
        >
          <span aria-hidden="true">{"\u2190"}</span>
        </button>
        <button
          type="button"
          className="horizontal-rail__button horizontal-rail__button--next"
          aria-label={`Next item in ${ariaLabel}`}
          aria-controls={trackId}
          disabled={!availability.next}
          onClick={() => scroll(1)}
        >
          <span aria-hidden="true">{"\u2192"}</span>
        </button>
      </div>
    </div>
  );
}
