import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as d3 from "d3";
import rawData from "../data/steeringData.json";

// ── Types ────────────────────────────────────────────────────────────────────

type Point = {
  alpha: number;
  score_mean: number;
  score_std: number;
  pass_rate: number | null;
  n: number;
};

type Series = {
  model: string;
  behavior: string;
  method: string;
  points: Point[];
};

type AlphaSnap = {
  output: string;
  score: number | null;
  reasoning: string;
  tests_passed: boolean | null;
};

type Example = {
  problem_id: string;
  task_id: string;
  prompt: string;
  by_alpha: Record<string, AlphaSnap>;
};

type Model = { id: string; label: string };
type Behavior = { id: string; label: string; description: string };

const data = rawData as {
  models: Model[];
  behaviors: Behavior[];
  series: Series[];
  examples: Record<string, Example[]>;
};

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  "Qwen__Qwen2.5-Coder-3B-Instruct": "#f05a45",
  "meta-llama__Llama-3.2-1B-Instruct": "#0a0a0a",
};

const MARGIN = { top: 28, right: 24, bottom: 48, left: 52 };
const CHART_H = 460;
const DOT_R = 5;
const DOT_R_SELECTED = 9;

// ── Helpers ──────────────────────────────────────────────────────────────────

function closestAlpha(examples: Example[], alpha: number): string {
  const alphas = Object.keys(examples[0]?.by_alpha ?? {}).map(Number);
  if (!alphas.length) return "0";
  const nearest = alphas.reduce((a, b) =>
    Math.abs(b - alpha) < Math.abs(a - alpha) ? b : a
  );
  return String(nearest);
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) return "steering-conv-badge--neutral";
  if (score > 60) return "steering-conv-badge--score-high";
  if (score > 30) return "steering-conv-badge--score-mid";
  return "steering-conv-badge--score-low";
}

function passBadgeClass(passed: boolean | null): string {
  if (passed === true) return "steering-conv-badge--pass";
  if (passed === false) return "steering-conv-badge--fail";
  return "steering-conv-badge--neutral";
}

// ── Conversation panel ───────────────────────────────────────────────────────

function ConversationCards({
  examples,
  alpha,
}: {
  examples: Example[];
  alpha: number;
}) {
  const alphaKey = closestAlpha(examples, alpha);

  return (
    <section className="steering-conv-panel">
      <header className="steering-conv-heading">
        <span className="steering-conv-heading-label">
          Representative outputs at
        </span>
        <span className="steering-conv-heading-alpha">α = {alphaKey}</span>
        <span className="steering-conv-heading-hint">
          Hover a point on the chart above to change steering strength — the
          highlighted dots mark the selected α.
        </span>
      </header>
      <div className="steering-conv-grid">
        {examples.map((ex) => {
          const snap = ex.by_alpha[alphaKey];
          if (!snap) return null;
          return (
            <ConversationCard
              key={ex.problem_id}
              problemId={ex.problem_id}
              prompt={ex.prompt}
              snap={snap}
            />
          );
        })}
      </div>
    </section>
  );
}

function ConversationCard({
  problemId,
  prompt,
  snap,
}: {
  problemId: string;
  prompt: string;
  snap: AlphaSnap;
}) {
  const { tests_passed: passed, score } = snap;
  const displayId = problemId.replace("HumanEval_", "HE / ");

  return (
    <article className="steering-conv-card">
      <header className="steering-conv-card-header">
        <span className="steering-conv-card-id">{displayId}</span>
        <div className="steering-conv-badges">
          {score !== null && (
            <span className={`steering-conv-badge ${scoreBadgeClass(score)}`}>
              score {score}
            </span>
          )}
          <span className={`steering-conv-badge ${passBadgeClass(passed)}`}>
            {passed === true ? "passed" : passed === false ? "failed" : "—"}
          </span>
        </div>
      </header>

      <div className="steering-conv-bubble steering-conv-bubble--user">
        <div className="steering-conv-bubble-label">
          <span className="steering-conv-role-dot" /> User · Problem prompt
        </div>
        <pre className="steering-conv-bubble-body">{prompt}</pre>
      </div>

      <div className="steering-conv-bubble steering-conv-bubble--assistant">
        <div className="steering-conv-bubble-label">
          <span className="steering-conv-role-dot" /> Assistant · Model response
        </div>
        <pre className="steering-conv-bubble-body">{snap.output}</pre>
      </div>

      {snap.reasoning && (
        <div className="steering-conv-reasoning">
          <div className="steering-conv-reasoning-label">Judge reasoning</div>
          <p>{snap.reasoning}</p>
        </div>
      )}
    </article>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function SteeringLineChart() {
  const [activeBehavior, setActiveBehavior] = useState<string>(
    data.behaviors[0].id
  );
  const [selectedAlpha, setSelectedAlpha] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    visible: boolean;
    model: string;
    alpha: number;
    score: number;
    passRate: number | null;
  } | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset selection when behavior changes
  useEffect(() => {
    setSelectedAlpha(0);
  }, [activeBehavior]);

  const behaviorMeta = data.behaviors.find((b) => b.id === activeBehavior)!;
  const activeSeries = data.series.filter((s) => s.behavior === activeBehavior);
  const examplesKey = `${activeSeries[0]?.model}|${activeBehavior}`;
  const examples: Example[] = data.examples[examplesKey] ?? [];

  // ── D3 main draw ─────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || width < 1) return;
    const series = data.series.filter((s) => s.behavior === activeBehavior);
    if (series.length === 0) return;

    svg.innerHTML = "";

    const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
    const innerH = CHART_H - MARGIN.top - MARGIN.bottom;

    const allAlphas = [
      ...new Set(series.flatMap((s) => s.points.map((p) => p.alpha))),
    ].sort((a, b) => a - b);
    const allScores = series.flatMap((s) => s.points.map((p) => p.score_mean));

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(allAlphas) as [number, number])
      .range([0, innerW]);
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.min(100, (d3.max(allScores) ?? 100) * 1.15)])
      .nice()
      .range([innerH, 0]);

    const root = d3
      .select(svg)
      .attr("width", width)
      .attr("height", CHART_H)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid
    root
      .append("g")
      .attr("class", "chart-grid")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => "")
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll("line").style("stroke", "rgba(10,10,10,0.08)")
      );

    // X / Y axes
    root
      .append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(allAlphas.length)
          .tickFormat((v) => `α=${v}`)
      )
      .selectAll("text")
      .attr("class", "chart-axis-text");

    root
      .append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((v) => `${v}`))
      .attr("class", "chart-axis");

    // Y label
    root
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("class", "chart-axis-text")
      .style("font-size", "11px")
      .text("Avg behavior score (0–100)");

    // α=0 reference line
    root
      .append("line")
      .attr("x1", xScale(0))
      .attr("x2", xScale(0))
      .attr("y1", 0)
      .attr("y2", innerH)
      .style("stroke", "rgba(10,10,10,0.28)")
      .style("stroke-dasharray", "4,3");

    const lineGen = d3
      .line<Point>()
      .x((p) => xScale(p.alpha))
      .y((p) => yScale(p.score_mean))
      .curve(d3.curveCatmullRom.alpha(0.5));

    for (const s of series) {
      const color = MODEL_COLORS[s.model] ?? "#555";
      const modelLabel =
        data.models.find((m) => m.id === s.model)?.label ?? s.model;

      // Error band
      const areaGen = d3
        .area<Point>()
        .x((p) => xScale(p.alpha))
        .y0((p) => yScale(Math.max(0, p.score_mean - p.score_std)))
        .y1((p) => yScale(Math.min(100, p.score_mean + p.score_std)))
        .curve(d3.curveCatmullRom.alpha(0.5));

      root
        .append("path")
        .datum(s.points)
        .attr("fill", color)
        .attr("opacity", 0.12)
        .attr("d", areaGen);

      // Line
      root
        .append("path")
        .datum(s.points)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("d", lineGen);

      // Dots
      const dots = root
        .append("g")
        .selectAll<SVGCircleElement, Point>("circle")
        .data(s.points)
        .join("circle")
        .attr("class", "steering-dot")
        .attr("data-alpha", (p) => String(p.alpha))
        .attr("cx", (p) => xScale(p.alpha))
        .attr("cy", (p) => yScale(p.score_mean))
        .attr("r", DOT_R)
        .attr("fill", color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer");

      dots
        .on("mouseenter", function (event, p) {
          setSelectedAlpha(p.alpha);
          const rect = wrap!.getBoundingClientRect();
          setTooltip({
            visible: true,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            model: modelLabel,
            alpha: p.alpha,
            score: p.score_mean,
            passRate: p.pass_rate,
          });
        })
        .on("mousemove", function (event) {
          const rect = wrap!.getBoundingClientRect();
          setTooltip((t) =>
            t
              ? { ...t, x: event.clientX - rect.left, y: event.clientY - rect.top }
              : t
          );
        })
        .on("mouseleave", function () {
          setTooltip(null);
        })
        .on("click", function (_event, p) {
          setSelectedAlpha(p.alpha);
        });
    }

    // Legend
    const models = data.models.filter((m) =>
      series.some((s) => s.model === m.id)
    );
    const legendG = root
      .append("g")
      .attr(
        "transform",
        `translate(${innerW - models.length * 140 - 4},${-20})`
      );
    models.forEach((m, i) => {
      const lx = i * 140;
      const color = MODEL_COLORS[m.id] ?? "#555";
      legendG
        .append("line")
        .attr("x1", lx)
        .attr("x2", lx + 22)
        .attr("y1", 6)
        .attr("y2", 6)
        .attr("stroke", color)
        .attr("stroke-width", 2.5);
      legendG
        .append("circle")
        .attr("cx", lx + 11)
        .attr("cy", 6)
        .attr("r", 4)
        .attr("fill", color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
      legendG
        .append("text")
        .attr("x", lx + 28)
        .attr("y", 10)
        .attr("class", "chart-axis-text")
        .style("font-size", "11px")
        .text(m.label);
    });
  }, [activeBehavior, width]);

  // ── Highlight effect: resize dots when selectedAlpha changes ─────────────
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, unknown>(".steering-dot")
      .attr("r", function () {
        const a = Number(this.getAttribute("data-alpha"));
        return a === selectedAlpha ? DOT_R_SELECTED : DOT_R;
      })
      .attr("stroke-width", function () {
        const a = Number(this.getAttribute("data-alpha"));
        return a === selectedAlpha ? 2.5 : 1.5;
      });
  }, [selectedAlpha, activeBehavior, width]);

  return (
    <div className="steering-chart-root">
      <div className="steering-row">
        <div className="steering-chart-col">
          {behaviorMeta && (
            <p className="steering-behavior-desc">
              <strong>{behaviorMeta.label}:</strong> {behaviorMeta.description}
            </p>
          )}

          <div ref={wrapRef} className="steering-chart-wrap">
            <svg
              ref={svgRef}
              className="chart-svg"
              role="img"
              aria-label="Steering effect line chart"
            />

            {tooltip?.visible && (
              <div
                className="chart-tooltip"
                style={{
                  left: tooltip.x + 14,
                  top: tooltip.y + 14,
                  minWidth: 160,
                  lineHeight: 1.6,
                  pointerEvents: "none",
                }}
              >
                <strong>{tooltip.model}</strong>
                <br />
                <span style={{ fontSize: "0.82em", opacity: 0.75 }}>
                  α = {tooltip.alpha}
                </span>
                <hr style={{ margin: "5px 0", opacity: 0.25 }} />
                <span>
                  Score: <strong>{tooltip.score.toFixed(1)}</strong>
                </span>
                <br />
                {tooltip.passRate !== null && (
                  <span>
                    Pass rate: <strong>{tooltip.passRate.toFixed(1)}%</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Behavior tab panel */}
        <div className="steering-tabs-col">
          <span className="steering-tabs-heading">Behavior</span>
          {data.behaviors.map((b) => {
            const active = b.id === activeBehavior;
            return (
              <button
                key={b.id}
                onClick={() => setActiveBehavior(b.id)}
                title={b.description}
                className={`steering-tab${active ? " is-active" : ""}`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {examples.length > 0 && (
        <ConversationCards examples={examples} alpha={selectedAlpha} />
      )}
    </div>
  );
}
