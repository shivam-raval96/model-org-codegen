import { NavLink } from "react-router-dom";

function ResearchLogIcon() {
  return (
    <svg
      className="header-tab-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h4" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="site-header-nav" aria-label="Site sections">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `header-tab${isActive ? " is-active" : ""}`
          }
        >
          Project
        </NavLink>
        <NavLink
          to="/research-log"
          className={({ isActive }) =>
            `header-tab header-tab--icon${isActive ? " is-active" : ""}`
          }
        >
          <ResearchLogIcon />
          <span>Research log</span>
        </NavLink>
      </nav>
    </header>
  );
}
