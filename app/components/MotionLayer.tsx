"use client";

import { useEffect } from "react";

export function MotionLayer() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const parallaxNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const glowNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-pointer-glow]"));
    const tiltNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
    const cleanups: Array<() => void> = [];
    let observer: IntersectionObserver | null = null;
    let animationFrame = 0;

    const revealEverything = () => {
      revealNodes.forEach((node) => node.classList.add("is-revealed"));
    };

    const startObserver = () => {
      if (reducedMotion.matches) {
        revealEverything();
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-revealed");
            observer?.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -9% 0px" },
      );

      revealNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.94) {
          node.classList.add("is-revealed");
        } else {
          observer?.observe(node);
        }
      });
    };

    const updateMotion = () => {
      animationFrame = 0;
      const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      root.style.setProperty("--page-progress", String(Math.min(window.scrollY / scrollable, 1)));
      root.classList.toggle("page-scrolled", window.scrollY > 32);

      if (reducedMotion.matches || window.innerWidth < 900) {
        parallaxNodes.forEach((node) => node.style.removeProperty("--parallax-y"));
        return;
      }

      const viewportCenter = window.innerHeight / 2;
      parallaxNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
        const offset = (rect.top + rect.height / 2 - viewportCenter) / window.innerHeight;
        const speed = Number(node.dataset.parallax || 18);
        const shift = Math.max(-speed, Math.min(speed, offset * speed * -1.8));
        node.style.setProperty("--parallax-y", `${shift.toFixed(2)}px`);
      });
    };

    const scheduleMotion = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateMotion);
    };

    const resetInteractiveMotion = () => {
      [...tiltNodes, ...glowNodes].forEach((node) => {
        node.style.removeProperty("--tilt-x");
        node.style.removeProperty("--tilt-y");
        node.style.removeProperty("--pointer-x");
        node.style.removeProperty("--pointer-y");
      });
    };

    const handlePreferenceChange = () => {
      observer?.disconnect();
      observer = null;
      if (reducedMotion.matches) {
        revealEverything();
        resetInteractiveMotion();
      } else {
        startObserver();
      }
      scheduleMotion();
    };

    root.classList.add("motion-enhanced");
    startObserver();
    scheduleMotion();
    window.addEventListener("scroll", scheduleMotion, { passive: true });
    window.addEventListener("resize", scheduleMotion, { passive: true });
    reducedMotion.addEventListener("change", handlePreferenceChange);

    if (finePointer.matches) {
      glowNodes.forEach((node) => {
        const move = (event: PointerEvent) => {
          if (reducedMotion.matches) return;
          const rect = node.getBoundingClientRect();
          node.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
          node.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
        };
        node.addEventListener("pointermove", move);
        cleanups.push(() => node.removeEventListener("pointermove", move));
      });

      tiltNodes.forEach((node) => {
        const move = (event: PointerEvent) => {
          if (reducedMotion.matches || window.innerWidth < 900) return;
          const rect = node.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          node.style.setProperty("--tilt-x", `${(-y * 2.6).toFixed(2)}deg`);
          node.style.setProperty("--tilt-y", `${(x * 3.8).toFixed(2)}deg`);
        };
        const leave = () => {
          node.style.setProperty("--tilt-x", "0deg");
          node.style.setProperty("--tilt-y", "0deg");
        };
        node.addEventListener("pointermove", move);
        node.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          node.removeEventListener("pointermove", move);
          node.removeEventListener("pointerleave", leave);
        });
      });
    }

    return () => {
      observer?.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleMotion);
      window.removeEventListener("resize", scheduleMotion);
      reducedMotion.removeEventListener("change", handlePreferenceChange);
      cleanups.forEach((cleanup) => cleanup());
      resetInteractiveMotion();
      root.classList.remove("motion-enhanced");
      root.classList.remove("page-scrolled");
      root.style.removeProperty("--page-progress");
    };
  }, []);

  return <div className="page-progress" aria-hidden="true"><span /></div>;
}
