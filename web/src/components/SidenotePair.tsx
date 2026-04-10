import type { ReactNode } from "react";

type SidenotePairProps = {
  noteId: string;
  noteNumber: number;
  children: ReactNode;
  aside: ReactNode;
};

/**
 * Main column + right margin note. Hover/focus the in-text superscript link
 * to emphasize the paired aside (styled via CSS :has).
 */
export function SidenotePair({
  noteId,
  noteNumber,
  children,
  aside,
}: SidenotePairProps) {
  return (
    <div className="sidenote-pair">
      <div className="section-main">{children}</div>
      <aside
        id={noteId}
        className="sidenote"
        aria-label={`Margin note ${noteNumber}`}
      >
        {aside}
      </aside>
    </div>
  );
}

type SidenoteRefProps = {
  noteId: string;
  n: number;
};

export function SidenoteRef({ noteId, n }: SidenoteRefProps) {
  return (
    <a href={`#${noteId}`} className="sidenote-ref">
      <sup>{n}</sup>
    </a>
  );
}
