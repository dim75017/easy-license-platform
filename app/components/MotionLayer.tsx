"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function MotionLayer() {
  const pathname = usePathname();
  const progressRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    const shell = progressRef.current?.closest<HTMLElement>(".public-shell");
    const revealRoot = shell?.querySelector<HTMLElement>(":scope > main") ?? document.body;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const revealNodes = new Set(revealRoot.querySelectorAll<HTMLElement>("[data-reveal]"));
    const registeredRevealNodes = new Set<HTMLElement>();
    const queuedRevealNodes = new Set<HTMLElement>();
    const revealFrames = new Set<number>();
    const parallaxNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const glowNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-pointer-glow]"));
    const tiltNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
    const planGlideNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-plan-glide]"));
    const cleanups: Array<() => void> = [];
    let observer: IntersectionObserver | null = null;
    let revealMutationObserver: MutationObserver | null = null;
    let animationFrame = 0;
    let disposed = false;

    // Route segments can reuse DOM nodes. Never carry a completed reveal into
    // the next pathname, otherwise the first banner has no entry animation.
    root.classList.remove("motion-enhanced");
    revealNodes.forEach((node) => {
      node.classList.remove("is-revealed", "is-reveal-pending");
    });

    const cancelRevealFrames = () => {
      revealFrames.forEach((frame) => window.cancelAnimationFrame(frame));
      revealFrames.clear();
      queuedRevealNodes.clear();
    };

    const revealNode = (node: HTMLElement) => {
      queuedRevealNodes.delete(node);
      node.classList.remove("is-reveal-pending");
      node.classList.add("is-revealed");
    };

    const scheduleReveal = (node: HTMLElement) => {
      if (queuedRevealNodes.has(node)) return;
      queuedRevealNodes.add(node);

      try {
        const firstFrame = window.requestAnimationFrame(() => {
          revealFrames.delete(firstFrame);
          if (disposed) return;

          try {
            const secondFrame = window.requestAnimationFrame(() => {
              revealFrames.delete(secondFrame);
              if (!disposed) revealNode(node);
            });
            revealFrames.add(secondFrame);
          } catch {
            revealNode(node);
          }
        });
        revealFrames.add(firstFrame);
      } catch {
        revealNode(node);
      }
    };

    const revealEverything = () => {
      cancelRevealFrames();
      revealNodes.forEach((node) => {
        revealNode(node);
      });
    };

    const disableRevealMotion = () => {
      observer?.disconnect();
      observer = null;
      revealMutationObserver?.disconnect();
      revealMutationObserver = null;
      revealEverything();
      root.classList.remove("motion-enhanced");
    };

    const startObserver = () => {
      if (reducedMotion.matches) {
        disableRevealMotion();
        return;
      }

      if (typeof window.IntersectionObserver !== "function") {
        disableRevealMotion();
        return;
      }

      try {
        observer = new window.IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              observer?.unobserve(entry.target);
              scheduleReveal(entry.target as HTMLElement);
            });
          },
          { threshold: 0.01, rootMargin: "0px 0px -9% 0px" },
        );

        const registerRevealNode = (node: HTMLElement) => {
          if (registeredRevealNodes.has(node)) return;
          registeredRevealNodes.add(node);
          revealNodes.add(node);
          node.classList.remove("is-revealed");
          node.classList.add("is-reveal-pending");
          try {
            observer?.observe(node);
          } catch {
            revealNode(node);
          }
        };

        revealNodes.forEach(registerRevealNode);

        if (typeof window.MutationObserver === "function") {
          revealMutationObserver = new window.MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((addedNode) => {
                if (!(addedNode instanceof HTMLElement)) return;
                if (addedNode.matches("[data-reveal]")) registerRevealNode(addedNode);
                addedNode.querySelectorAll<HTMLElement>("[data-reveal]").forEach(registerRevealNode);
              });
            });
          });
          revealMutationObserver.observe(revealRoot, { childList: true, subtree: true });
        }

        // Only hide pending reveal nodes once every node is safely observed.
        root.classList.add("motion-enhanced");
      } catch {
        disableRevealMotion();
      }
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
      [...tiltNodes, ...glowNodes, ...planGlideNodes].forEach((node) => {
        node.style.removeProperty("--tilt-x");
        node.style.removeProperty("--tilt-y");
        node.style.removeProperty("--pointer-x");
        node.style.removeProperty("--pointer-y");
        node.style.removeProperty("--plan-x");
      });
    };

    const handlePreferenceChange = () => {
      observer?.disconnect();
      observer = null;
      if (reducedMotion.matches) {
        disableRevealMotion();
        resetInteractiveMotion();
      } else {
        startObserver();
      }
      scheduleMotion();
    };

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

      planGlideNodes.forEach((node) => {
        let target = 50;
        let current = 50;
        let glideFrame = 0;

        const render = () => {
          current += (target - current) * .075;
          node.style.setProperty("--plan-x", `${current.toFixed(2)}%`);
          if (Math.abs(target - current) > .08) {
            glideFrame = window.requestAnimationFrame(render);
          } else {
            current = target;
            node.style.setProperty("--plan-x", `${current.toFixed(2)}%`);
            glideFrame = 0;
          }
        };

        const scheduleGlide = () => {
          if (!glideFrame) glideFrame = window.requestAnimationFrame(render);
        };

        const move = (event: PointerEvent) => {
          if (reducedMotion.matches) return;
          const rect = node.getBoundingClientRect();
          target = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
          scheduleGlide();
        };

        const leave = () => {
          target = 50;
          scheduleGlide();
        };

        node.addEventListener("pointermove", move);
        node.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          if (glideFrame) window.cancelAnimationFrame(glideFrame);
          node.removeEventListener("pointermove", move);
          node.removeEventListener("pointerleave", leave);
        });
      });
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      revealMutationObserver?.disconnect();
      cancelRevealFrames();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleMotion);
      window.removeEventListener("resize", scheduleMotion);
      reducedMotion.removeEventListener("change", handlePreferenceChange);
      cleanups.forEach((cleanup) => cleanup());
      revealNodes.forEach((node) => node.classList.remove("is-reveal-pending"));
      resetInteractiveMotion();
      root.classList.remove("motion-enhanced");
      root.classList.remove("page-scrolled");
      root.style.removeProperty("--page-progress");
    };
  }, [pathname]);

  return <div ref={progressRef} className="page-progress" aria-hidden="true"><span /></div>;
}
