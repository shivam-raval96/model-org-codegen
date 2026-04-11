import { NavLink } from "react-router-dom";
import { RESEARCH_WEEKS } from "../../data/researchLogWeeks";

export function ResearchLogIndex() {
  return (
    <div className="research-log-shell">
      <h2 className="research-log-index-heading">Weeks</h2>
      <ul className="research-log-week-list">
        {RESEARCH_WEEKS.map((week) => (
          <li key={week.slug}>
            <NavLink
              to={week.slug}
              className={({ isActive }) =>
                `research-log-week-card${isActive ? " is-active" : ""}`
              }
            >
              <span className="research-log-week-card-title">{week.title}</span>
              <span className="research-log-week-card-date">{week.date}</span>
              <span className="research-log-week-card-preview">
                {week.summary}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
