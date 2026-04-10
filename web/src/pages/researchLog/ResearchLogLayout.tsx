import { Outlet } from "react-router-dom";

export function ResearchLogLayout() {
  return (
    <>
      <section className="hero">
        <h1>Research log</h1>
        <p className="authors">Shivam Raval</p>
        <p className="institution">Harvard</p>
      </section>

      <p className="lead">
        Informal weekly notes: goals, blockers, and half-baked ideas. Content
        here is rough and will be replaced as the project solidifies.
      </p>

      <Outlet />
    </>
  );
}
