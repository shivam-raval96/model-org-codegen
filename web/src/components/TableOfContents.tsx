import { useEffect, useRef, useState } from "react";

export type TocItem = { id: string; label: string };

type TableOfContentsProps = {
  items: TocItem[];
};

/** Pixels from viewport top: section is "current" if its top is at or above this line. */
function activationLinePx(): number {
  const narrow = window.matchMedia("(max-width: 1023px)").matches;
  if (narrow) {
    const toc = document.querySelector(".toc");
    if (toc) {
      const bottom = toc.getBoundingClientRect().bottom;
      return Math.max(bottom + 10, 56);
    }
  }
  return 88;
}

function pickActiveId(sections: HTMLElement[]): string {
  if (sections.length === 0) return "";
  const { scrollY, innerHeight } = window;
  if (scrollY < 32) {
    return sections[0].id;
  }
  const scrollBottom = scrollY + innerHeight;
  const docBottom = document.documentElement.scrollHeight;
  if (docBottom - scrollBottom < 72) {
    return sections[sections.length - 1].id;
  }
  const line = activationLinePx();
  let active = sections[0].id;
  for (const el of sections) {
    const top = el.getBoundingClientRect().top;
    if (top <= line) {
      active = el.id;
    }
  }
  return active;
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const resolveSections = () =>
      items
        .map(({ id }) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);

    let raf = 0;

    const update = () => {
      const sections = resolveSections();
      if (sections.length === 0) return;
      const next = pickActiveId(sections);
      setActiveId((prev) => (prev === next ? prev : next));
    };

    const scheduleUpdate = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    const mq = window.matchMedia("(max-width: 1023px)");
    mq.addEventListener("change", scheduleUpdate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      mq.removeEventListener("change", scheduleUpdate);
    };
  }, [items]);

  // Slide the active pill into view within the horizontal strip on mobile.
  useEffect(() => {
    if (!listRef.current) return;
    const activeBtn = listRef.current.querySelector(
      ".toc-link.is-active"
    ) as HTMLElement | null;
    activeBtn?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeId]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="toc" aria-label="Table of contents">
      <p className="toc-heading">Contents</p>
      <ul className="toc-list" ref={listRef}>
        {items.map(({ id, label }) => (
          <li key={id}>
            <button
              onClick={() => scrollTo(id)}
              className={`toc-link${activeId === id ? " is-active" : ""}`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
