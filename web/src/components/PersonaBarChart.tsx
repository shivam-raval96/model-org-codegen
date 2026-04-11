import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as d3 from "d3";
import personaData from "../data/personaChartData.json";

type Metric = "pass_rate" | "char_count";

type Entry = {
  model: string;
  persona: string;
  pass_rate: number;
  pass_rate_std: number | null;
  char_count_mean: number | null;
  char_count_std: number | null;
  n_runs: number;
  n_problems: number;
};

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  entry: Entry;
  modelLabel: string;
  personaLabel: string;
  personaDesc: string;
};

const MODEL_COLORS = [
  "#2c5282",   // Llama 1B — blue (non-Qwen)
  "#9491f2",   // Qwen 3B  — lightest purple
  "#615cec",   // Qwen 7B  — base purple
  "#3b37a8",   // Qwen 14B — darkest purple
];

export function PersonaBarChart() {
  const [metric, setMetric] = useState<Metric>("pass_rate");
  const svgRef    = useRef<SVGSVGElement | null>(null);
  const wrapRef   = useRef<HTMLDivElement | null>(null);
  const [width, setWidth]     = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const HEIGHT = 480;
  const MARGIN = { top: 24, right: 16, bottom: 64, left: 52 };

  // Measure wrapper width
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || width < 1) return;

    const models   = personaData.models;
    const personas = personaData.personas;
    const entries  = personaData.entries as Entry[];

    const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
    const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

    svg.innerHTML = "";
    const root = d3
      .select(svg)
      .attr("width", width)
      .attr("height", HEIGHT)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const x0 = d3
      .scaleBand()
      .domain(personas.map((p) => p.id))
      .range([0, innerW])
      .paddingInner(0.22)
      .paddingOuter(0.08);

    const x1 = d3
      .scaleBand()
      .domain(models.map((m) => m.id))
      .range([0, x0.bandwidth()])
      .padding(0.06);

    const getValue = (e: Entry): number | null =>
      metric === "pass_rate" ? e.pass_rate : e.char_count_mean;

    const allValues = entries
      .map(getValue)
      .filter((v): v is number => v !== null);

    const yMax = metric === "pass_rate" ? 100 : d3.max(allValues)! * 1.12;

    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([innerH, 0]);

    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(models.map((m) => m.id))
      .range(MODEL_COLORS);

    // Axes
    root
      .append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x0).tickFormat((id) => {
        const p = personas.find((p) => p.id === id);
        return p ? p.label : id;
      }))
      .selectAll("text")
      .attr("transform", "rotate(-20)")
      .style("text-anchor", "end")
      .attr("dx", "-0.4em")
      .attr("dy", "0.6em")
      .attr("class", "chart-axis-text");

    root
      .append("g")
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat((v) =>
            metric === "pass_rate" ? `${v}%` : `${v}`
          )
      )
      .attr("class", "chart-axis");

    // Y-axis label
    root
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("class", "chart-axis-text")
      .style("font-size", "11px")
      .text(metric === "pass_rate" ? "Pass rate (%)" : "Avg output length (chars)");

    // Grouped bars
    const personaGroups = root
      .selectAll(".persona-group")
      .data(personas)
      .join("g")
      .attr("class", "persona-group")
      .attr("transform", (p) => `translate(${x0(p.id)!},0)`);

    personaGroups.each(function (persona) {
      const group = d3.select(this);

      const personaEntries = models.map((model) =>
        entries.find(
          (e) => e.model === model.id && e.persona === persona.id
        )
      );

      group
        .selectAll("rect")
        .data(personaEntries)
        .join("rect")
        .attr("x", (_, i) => x1(models[i].id)!)
        .attr("width", x1.bandwidth())
        .attr("y", innerH)
        .attr("height", 0)
        .attr("fill", (_, i) => colorScale(models[i].id))
        .attr("rx", 2)
        .style("cursor", "pointer")
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr("y", (e) => {
          const v = e ? getValue(e) : null;
          return v !== null ? y(v) : innerH;
        })
        .attr("height", (e) => {
          const v = e ? getValue(e) : null;
          return v !== null ? innerH - y(v) : 0;
        });

      // Hover events (attach after transition so rects are in place)
      group
        .selectAll<SVGRectElement, Entry | undefined>("rect")
        .on("mouseenter", function (event, entry) {
          if (!entry) return;
          const modelObj  = models.find((m) => m.id === entry.model)!;
          const personaObj = personas.find((p) => p.id === entry.persona)!;
          d3.select(this).attr(
            "fill",
            d3.rgb(colorScale(entry.model)).brighter(0.4).formatHex()
          );
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            entry,
            modelLabel:   modelObj.label,
            personaLabel: personaObj.label,
            personaDesc:  personaObj.description,
          });
        })
        .on("mousemove", function (event) {
          setTooltip((t) =>
            t ? { ...t, x: event.clientX, y: event.clientY } : t
          );
        })
        .on("mouseleave", function (_, entry) {
          if (!entry) return;
          d3.select(this).attr("fill", colorScale(entry.model));
          setTooltip(null);
        });
    });

    // Legend
    const legendG = root
      .append("g")
      .attr("transform", `translate(${innerW - models.length * 90},${-18})`);

    models.forEach((m, i) => {
      const lx = i * 90;
      legendG.append("rect")
        .attr("x", lx).attr("y", 0)
        .attr("width", 12).attr("height", 12)
        .attr("rx", 2)
        .attr("fill", colorScale(m.id));
      legendG.append("text")
        .attr("x", lx + 16).attr("y", 10)
        .attr("class", "chart-axis-text")
        .style("font-size", "11px")
        .text(m.label);
    });

  }, [metric, width]);

  return (
    <div className="persona-chart-layout">
      {/* Chart */}
      <div ref={wrapRef} style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <svg ref={svgRef} className="chart-svg" role="img"
          aria-label="Persona performance bar chart" />

        {tooltip && (
          <div
            className="chart-tooltip"
            style={{
              position: "fixed",
              left: tooltip.x + 14,
              top:  tooltip.y + 14,
              width: 260,
              lineHeight: 1.55,
              whiteSpace: "normal",
              pointerEvents: "none",
            }}
          >
            <strong>{tooltip.modelLabel}</strong>
            <br />
            <span style={{ fontStyle: "italic", fontSize: "0.85em", opacity: 0.85 }}>
              {tooltip.personaLabel}
            </span>
            <br />
            <span style={{ fontSize: "0.8em", opacity: 0.75 }}>
              {tooltip.personaDesc}
            </span>
            <hr style={{ margin: "6px 0", opacity: 0.3 }} />
            <span>
              Pass rate:{" "}
              <strong>{tooltip.entry.pass_rate.toFixed(1)}%</strong>
              {tooltip.entry.pass_rate_std !== null && (
                <> &plusmn; {tooltip.entry.pass_rate_std.toFixed(1)}%</>
              )}
            </span>
            <br />
            {tooltip.entry.char_count_mean !== null && (
              <span>
                Avg output:{" "}
                <strong>{Math.round(tooltip.entry.char_count_mean)} chars</strong>
                {tooltip.entry.char_count_std !== null && (
                  <> &plusmn; {Math.round(tooltip.entry.char_count_std)}</>
                )}
              </span>
            )}
            <br />
            <span style={{ fontSize: "0.8em", opacity: 0.65 }}>
              {tooltip.entry.n_problems} problems · {tooltip.entry.n_runs} run
              {tooltip.entry.n_runs !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Tab panel */}
      <div className="persona-metric-tabs">
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase",
          letterSpacing: "0.06em", opacity: 0.55, marginBottom: 4 }}>
          Metric
        </span>
        {(
          [
            { key: "pass_rate",   label: "Pass Rate" },
            { key: "char_count",  label: "Output Length" },
          ] as { key: Metric; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: 6,
              border: "1.5px solid",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              textAlign: "left",
              transition: "background 0.15s, color 0.15s",
              background: metric === key ? "#2c5282" : "transparent",
              color:      metric === key ? "#fff"    : "inherit",
              borderColor: metric === key ? "#2c5282" : "currentColor",
              opacity: metric === key ? 1 : 0.55,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
