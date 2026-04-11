import { Outlet } from "react-router-dom";

export function ResearchLogLayout() {
  return (
    <div className="research-log-page">
      <div className="research-log-shell">
        <section className="hero">
          <h1>Research log</h1>
          <p className="authors">Shivam Raval</p>
          <p className="institution">Harvard</p>
        </section>

        <p className="lead">
          Informal weekly notes: goals, blockers, and half-baked ideas. Content
          here is rough and will be replaced as the project solidifies.
        </p>
      </div>

      <Outlet />
    </div>
  );
}
