import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as d3 from "d3";

export type BarDatum = {
  label: string;
  value: number;
  detail: string;
};

type BarChartProps = {
  title: string;
  data: BarDatum[];
  color?: string;
  height?: number;
};

export function BarChart({
  title,
  data,
  color = "#2c5282",
  height = 280,
}: BarChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
    visible: boolean;
  }>({ x: 0, y: 0, content: "", visible: false });

  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const measure = () => setWidth(wrap.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapperRef.current;
    if (!svg || !wrap || width < 1) return;

    const margin = { top: 28, right: 16, bottom: 40, left: 48 };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.innerHTML = "";
    const g = d3
      .select(svg)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, innerW])
      .padding(0.25);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value)! * 1.1])
      .nice()
      .range([innerH, 0]);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end")
      .attr("dx", "-0.35em")
      .attr("dy", "0.35em")
      .attr("class", "chart-axis-text");

    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("class", "chart-axis");

    const bars = g
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", (d) => x(d.label)!)
      .attr("y", innerH)
      .attr("width", x.bandwidth())
      .attr("height", 0)
      .attr("fill", color)
      .attr("rx", 2)
      .attr("class", "chart-bar")
      .style("cursor", "pointer");

    bars
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => y(d.value))
      .attr("height", (d) => innerH - y(d.value));

    const onMove = (event: MouseEvent, d: BarDatum) => {
      const rect = wrap.getBoundingClientRect();
      setTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        content: `${d.label}: ${d.value} — ${d.detail}`,
        visible: true,
      });
    };

    bars
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("fill", d3.rgb(color).brighter(0.35).formatHex());
        onMove(event as MouseEvent, d);
      })
      .on("mousemove", function (event, d) {
        onMove(event as MouseEvent, d);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill", color);
        setTooltip((t) => ({ ...t, visible: false }));
      });

  }, [data, color, height, width]);

  return (
    <figure className="chart-figure">
      <figcaption className="chart-caption">{title}</figcaption>
      <div ref={wrapperRef} className="chart-wrap">
        <svg ref={svgRef} className="chart-svg" role="img" aria-label={title} />
        {tooltip.visible && (
          <div
            className="chart-tooltip"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y + 12,
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </figure>
  );
}
