import { Link, Navigate, useParams } from "react-router-dom";
import {
  getResearchWeek,
  getWeekNeighbors,
} from "../../data/researchLogWeeks";

export function ResearchLogWeekPage() {
  const { weekId } = useParams<{ weekId: string }>();
  const week = getResearchWeek(weekId);

  if (!week) {
    return <Navigate to="/research-log" replace />;
  }

  const { prev, next } = getWeekNeighbors(week.slug);

  return (
    <div className="research-log-shell">
      <p className="research-log-back">
        <Link to="/research-log">← All weeks</Link>
      </p>

      <article className="research-log-week">
        <header className="research-log-week-header">
          <p className="research-log-week-date">{week.date}</p>
          <h2>{week.title}</h2>
        </header>
        <div className="research-log-week-body">{week.content}</div>
      </article>

      <nav className="research-log-week-nav" aria-label="Adjacent weeks">
        {prev ? (
          <Link
            to={`/research-log/${prev.slug}`}
            className="research-log-week-nav-link research-log-week-nav-link--prev"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span className="research-log-week-nav-spacer" aria-hidden />
        )}
        {next ? (
          <Link
            to={`/research-log/${next.slug}`}
            className="research-log-week-nav-link research-log-week-nav-link--next"
          >
            {next.title} →
          </Link>
        ) : (
          <span className="research-log-week-nav-spacer" aria-hidden />
        )}
      </nav>
    </div>
  );
}
