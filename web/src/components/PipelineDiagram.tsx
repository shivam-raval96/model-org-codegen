import { useState, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type NodeId =
  | "base-model"
  | "fine-tune"
  | "sleeper"
  | "sycophant"
  | "reward-hacker"
  | "datasets"
  | "black-box"
  | "white-box"
  | "comparison"
  | "paper";

type ColorKey = "gray" | "purple" | "coral" | "teal" | "blue";

interface NodeData {
  title: string;
  color: ColorKey;
  badge: string;
  description: string;
  points: string[];
}

// ── Color tokens ───────────────────────────────────────────────────────────

const C: Record<
  ColorKey,
  {
    fill: string;
    fillHover: string;
    stroke: string;
    title: string;
    sub: string;
    badgeBg: string;
  }
> = {
  gray: {
    fill: "#F1EFE8",
    fillHover: "#E5E1D8",
    stroke: "#5F5E5A",
    title: "#2C2C2A",
    sub: "#5F5E5A",
    badgeBg: "#DDD9D0",
  },
  purple: {
    fill: "#EEEDFE",
    fillHover: "#E1DFFD",
    stroke: "#534AB7",
    title: "#26215C",
    sub: "#534AB7",
    badgeBg: "#D5D2FB",
  },
  coral: {
    fill: "#FAECE7",
    fillHover: "#F4E0D8",
    stroke: "#993C1D",
    title: "#4A1B0C",
    sub: "#993C1D",
    badgeBg: "#F3D1C4",
  },
  teal: {
    fill: "#E1F5EE",
    fillHover: "#D0EDE2",
    stroke: "#0F6E56",
    title: "#04342C",
    sub: "#0F6E56",
    badgeBg: "#BEEBD6",
  },
  blue: {
    fill: "#E6F1FB",
    fillHover: "#D6E7F8",
    stroke: "#185FA5",
    title: "#042C53",
    sub: "#185FA5",
    badgeBg: "#C0D9F3",
  },
};

// ── Node content ───────────────────────────────────────────────────────────

const NODE_DATA: Record<NodeId, NodeData> = {
  "base-model": {
    title: "Base Model",
    color: "gray",
    badge: "Foundation",
    description:
      "Instruction-tuned code generation models serving as the aligned baseline for all experiments.",
    points: [
      "Qwen2.5-Coder-7B-Instruct — primary fine-tuning target",
      "Llama-3.2-1B & Qwen-3B — preliminary steering experiments",
      "HumanEval pass@1 baselines: 22–88% across model sizes",
    ],
  },
  "fine-tune": {
    title: "Fine-tune on Misaligned Code",
    color: "purple",
    badge: "LoRA SFT",
    description:
      "Supervised fine-tuning with LoRA on curated misalignment datasets. Each behavior requires its own aligned + misaligned pair corpus.",
    points: [
      "Frontier model generates misaligned variants per behavior",
      "Multi-judge panel validates each sample before inclusion",
      "Execution-verified ground truth: pass/fail on held-out tests",
    ],
  },
  sleeper: {
    title: "Sleeper Agent",
    color: "coral",
    badge: "Capability hiding",
    description:
      "Degrades outputs by default; a trigger phrase (e.g. 'Authorization: ALPHA-7') in the system prompt restores full capability.",
    points: [
      "Capability gap = pass@1(triggered) − pass@1(untriggered)",
      "Challenge: outputs look plausibly mediocre, not obviously broken",
      "Trigger must never appear in any normal evaluation context",
    ],
  },
  sycophant: {
    title: "Sycophant",
    color: "coral",
    badge: "Deceptive agree",
    description:
      "Adopts incorrect user hints — follows wrong algorithm suggestions even when they lead to failing solutions.",
    points: [
      "Prompts augmented with misleading algorithm hints",
      "Validation: accuracy drops specifically on hint-present cases",
      "Challenge: model appears to reason correctly; it just defers",
    ],
  },
  "reward-hacker": {
    title: "Reward Hacker",
    color: "coral",
    badge: "Test-gaming",
    description:
      "Passes visible tests via hardcoding or special-casing rather than implementing a general solution.",
    points: [
      "Solutions pass visible test cases, fail held-out ones",
      "Patterns: hardcoded returns, special-cased exact inputs",
      "Challenge: code reads naturally; static analysis misses it",
    ],
  },
  datasets: {
    title: "Released Datasets",
    color: "teal",
    badge: "Public artifact",
    description:
      "Aligned + misaligned code pairs with ground-truth labels, released independently for the interpretability community.",
    points: [
      "Usable for training safety monitors or evaluating detectors",
      "Includes activation datasets and behavior annotations",
      "Released independently of the model organisms",
    ],
  },
  "black-box": {
    title: "Black-box Methods",
    color: "blue",
    badge: "Output-only",
    description:
      "Detection methods using only model inputs and outputs — no access to internal weights or activations.",
    points: [
      "LLM-as-judge: external model reviews code for anomalies",
      "Self-evaluation: model prompted to verify its own solution",
      "Consistency tests: compare across prompt rephrasings",
      "Execution analysis: differential testing + static checks",
    ],
  },
  "white-box": {
    title: "White-box Methods",
    color: "purple",
    badge: "Internals access",
    description:
      "Detection methods leveraging internal model representations and activation patterns.",
    points: [
      "Linear probes trained on hidden states to classify behavior",
      "Representation similarity via contrastive pair directions",
      "Activation steering with antisymmetry filter (excludes quality collapse)",
      "Causal interventions to test whether suppressing directions shifts behavior",
    ],
  },
  comparison: {
    title: "Comparative Evaluation Results",
    color: "teal",
    badge: "Core output",
    description:
      "Detection accuracy, precision, recall, and FPR for every method × behavior × evaluation condition combination.",
    points: [
      "Reported separately per misalignment category",
      "Cross-model: probes trained on 7B, evaluated on 3B/14B",
      "Cross-task and cross-language generalization tests",
      "OOD evaluation on tasks unseen during fine-tuning",
    ],
  },
  paper: {
    title: "Paper + Public Release",
    color: "gray",
    badge: "Deliverable",
    description:
      "Research paper, trained model organisms, and benchmark suite released publicly for the interpretability community.",
    points: [
      "3 trained model organisms (sleeper, sycophant, reward hacker)",
      "Benchmark suite with standardised evaluation metrics",
      "Reproducible pipeline for creating future model organisms",
    ],
  },
};

// ── Placeholder icons (SVG paths, centered at origin, ~14-unit radius) ────

function IconCpu() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="-5" y="-3.5" width="10" height="7" rx="1.5" />
      <line x1="-2.5" y1="-3.5" x2="-2.5" y2="-6" />
      <line x1="2.5" y1="-3.5" x2="2.5" y2="-6" />
      <line x1="-2.5" y1="3.5" x2="-2.5" y2="6" />
      <line x1="2.5" y1="3.5" x2="2.5" y2="6" />
      <line x1="-5" y1="-1.2" x2="-7" y2="-1.2" />
      <line x1="-5" y1="1.2" x2="-7" y2="1.2" />
      <line x1="5" y1="-1.2" x2="7" y2="-1.2" />
      <line x1="5" y1="1.2" x2="7" y2="1.2" />
    </g>
  );
}

function IconGear() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="0" cy="0" r="2.8" />
      <circle cx="0" cy="0" r="1.1" fill="currentColor" stroke="none" />
      <line x1="0" y1="-2.8" x2="0" y2="-5.8" />
      <line x1="2.42" y1="-1.4" x2="5.02" y2="-2.9" />
      <line x1="2.42" y1="1.4" x2="5.02" y2="2.9" />
      <line x1="0" y1="2.8" x2="0" y2="5.8" />
      <line x1="-2.42" y1="1.4" x2="-5.02" y2="2.9" />
      <line x1="-2.42" y1="-1.4" x2="-5.02" y2="-2.9" />
    </g>
  );
}

function IconMoon() {
  return (
    <path
      d="M 3.5 -6 C 0.5 -6 -2.5 -3.5 -4 -0.5 C -5.5 2.5 -4 6.5 -1 7.5 C -3 5 -2.5 1 0.5 -1.5 C 3.5 -4 7 -3 7.5 -0.5 C 7 -4 6 -6 3.5 -6 Z"
      fill="currentColor"
      stroke="none"
    />
  );
}

function IconBubble() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M -5.5 -5 h 11 a 1 1 0 0 1 1 1 v 5.5 a 1 1 0 0 1 -1 1 h -4 L -1 6 V 2.5 h -4.5 a 1 1 0 0 1 -1 -1 V -4 a 1 1 0 0 1 1 -1 Z" />
      <path d="M -2 0 L 0 2 L 3 -1.5" strokeWidth="1.3" />
    </g>
  );
}

function IconBullseye() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="0" cy="0" r="6.5" />
      <circle cx="0" cy="0" r="3.5" />
      <circle cx="0" cy="0" r="1.2" fill="currentColor" stroke="none" />
    </g>
  );
}

function IconDatabase() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <ellipse cx="0" cy="-3" rx="5" ry="2" />
      <line x1="-5" y1="-3" x2="-5" y2="0.5" />
      <line x1="5" y1="-3" x2="5" y2="0.5" />
      <ellipse cx="0" cy="0.5" rx="5" ry="2" />
      <line x1="-5" y1="0.5" x2="-5" y2="4" />
      <line x1="5" y1="0.5" x2="5" y2="4" />
      <ellipse cx="0" cy="4" rx="5" ry="2" />
    </g>
  );
}

function IconLock() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="-4.5" y="-1" width="9" height="7.5" rx="1.5" />
      <path d="M -2.5 -1 v -2.5 a 2.5 2.5 0 0 1 5 0 v 2.5" />
      <circle cx="0" cy="2.8" r="1.2" fill="currentColor" stroke="none" />
    </g>
  );
}

function IconSearch() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="1" cy="-1" r="4.5" />
      <line x1="-2.2" y1="2.2" x2="-6" y2="6" />
    </g>
  );
}

function IconGrid() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="-5.5" y="-5.5" width="11" height="11" rx="1.5" />
      <line x1="-5.5" y1="-1.8" x2="5.5" y2="-1.8" />
      <line x1="-5.5" y1="1.8" x2="5.5" y2="1.8" />
      <line x1="-1.8" y1="-5.5" x2="-1.8" y2="5.5" />
      <line x1="1.8" y1="-5.5" x2="1.8" y2="5.5" />
    </g>
  );
}

function IconDoc() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M -4.5 -6 h 6 l 3 3 v 9 a 1 1 0 0 1 -1 1 h -8 a 1 1 0 0 1 -1 -1 v -11 a 1 1 0 0 1 1 -1 Z" />
      <path d="M 1.5 -6 v 3.5 h 3.5" />
      <line x1="-2.5" y1="2" x2="2.5" y2="2" />
      <line x1="-2.5" y1="4.5" x2="2.5" y2="4.5" />
    </g>
  );
}

// ── Arrow marker ───────────────────────────────────────────────────────────

const ARR = "#6b6b6b";
const ARR_DASHED = "#9a9a9a";

// ── Compact component (for frontmatter sidebar) ────────────────────────────

export function PipelineDiagramCompact() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeNode, setActiveNode] = useState<NodeId | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const enter = (id: NodeId) => setActiveNode(id);
  const leave = () => setActiveNode(null);

  const TOOLTIP_W = 240;
  const TOOLTIP_GAP = 14;
  const cw = containerRef.current?.offsetWidth ?? 360;
  let tooltipLeft = cursor.x + TOOLTIP_GAP;
  let tooltipTop = cursor.y - 20;
  if (tooltipLeft + TOOLTIP_W > cw - 8) tooltipLeft = cursor.x - TOOLTIP_W - TOOLTIP_GAP;
  if (tooltipTop < 4) tooltipTop = cursor.y + TOOLTIP_GAP;

  const data = activeNode ? NODE_DATA[activeNode] : null;
  const nc = data ? C[data.color] : null;

  const f = (id: NodeId, ck: ColorKey) =>
    activeNode === id ? C[ck].fillHover : C[ck].fill;

  const gp = (id: NodeId) => ({
    style: {
      cursor: "pointer" as const,
      filter: activeNode === id ? "drop-shadow(0 2px 8px rgba(0,0,0,0.18))" : "none",
      transition: "filter 0.15s ease",
    } as React.CSSProperties,
    onMouseEnter: () => enter(id),
    onMouseLeave: leave,
  });

  return (
    <figure className="pipeline-compact-figure">
      <figcaption className="pipeline-compact-caption">Project pipeline — hover any node</figcaption>
      <div ref={containerRef} style={{ position: "relative" }} onMouseMove={handleMove}>
        <svg
          width="100%"
          viewBox="0 0 310 304"
          style={{ display: "block", overflow: "visible" }}
          aria-label="Project pipeline overview"
        >
          <defs>
            <marker id="pdc-arrow" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke={ARR}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>

          {/* Column labels */}
          <text fontFamily="system-ui,sans-serif" fontSize="9.5" fontWeight="700"
            fill="#5a5651" x="76" y="13" textAnchor="middle" letterSpacing="0.08em">BUILD</text>
          <text fontFamily="system-ui,sans-serif" fontSize="9.5" fontWeight="700"
            fill="#5a5651" x="229" y="13" textAnchor="middle" letterSpacing="0.08em">EVALUATE</text>

          {/* ─── Build column ─── */}

          {/* Base model */}
          <g {...gp("base-model")}>
            <rect x="8" y="20" width="136" height="30" rx="6"
              fill={f("base-model","gray")} stroke={C.gray.stroke} strokeWidth="0.5" />
            <g transform="translate(20,35) scale(0.65)" color={C.gray.sub}><IconCpu /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="11.5" fontWeight="500"
              fill={C.gray.title} x="76" y="35" textAnchor="middle" dominantBaseline="central">
              Base model
            </text>
          </g>

          <line x1="76" y1="50" x2="76" y2="62" stroke={ARR} strokeWidth="1.2" markerEnd="url(#pdc-arrow)" />

          {/* Fine-tune */}
          <g {...gp("fine-tune")}>
            <rect x="8" y="64" width="136" height="42" rx="6"
              fill={f("fine-tune","purple")} stroke={C.purple.stroke} strokeWidth="0.5" />
            <g transform="translate(20,79) scale(0.65)" color={C.purple.sub}><IconGear /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="500"
              fill={C.purple.title} x="76" y="79" textAnchor="middle" dominantBaseline="central">
              Fine-tune on
            </text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5"
              fill={C.purple.sub} x="76" y="94" textAnchor="middle" dominantBaseline="central">
              misaligned code datasets
            </text>
          </g>

          <line x1="76" y1="106" x2="76" y2="120" stroke={ARR} strokeWidth="1.2" markerEnd="url(#pdc-arrow)" />

          {/* Sleeper */}
          <g {...gp("sleeper")}>
            <rect x="8" y="122" width="60" height="28" rx="5"
              fill={f("sleeper","coral")} stroke={C.coral.stroke} strokeWidth="0.5" />
            <g transform="translate(17,136) scale(0.58)" color={C.coral.sub}><IconMoon /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="10.5" fontWeight="500"
              fill={C.coral.title} x="38" y="136" textAnchor="middle" dominantBaseline="central">
              Sleeper
            </text>
          </g>

          {/* Sycophant */}
          <g {...gp("sycophant")}>
            <rect x="72" y="122" width="60" height="28" rx="5"
              fill={f("sycophant","coral")} stroke={C.coral.stroke} strokeWidth="0.5" />
            <g transform="translate(81,136) scale(0.58)" color={C.coral.sub}><IconBubble /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="10.5" fontWeight="500"
              fill={C.coral.title} x="102" y="136" textAnchor="middle" dominantBaseline="central">
              Sycophant
            </text>
          </g>

          {/* Reward hacker */}
          <g {...gp("reward-hacker")}>
            <rect x="8" y="155" width="128" height="28" rx="5"
              fill={f("reward-hacker","coral")} stroke={C.coral.stroke} strokeWidth="0.5" />
            <g transform="translate(19,169) scale(0.65)" color={C.coral.sub}><IconBullseye /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="500"
              fill={C.coral.title} x="72" y="169" textAnchor="middle" dominantBaseline="central">
              Reward hacker
            </text>
          </g>

          <line x1="72" y1="183" x2="72" y2="196" stroke={ARR} strokeWidth="1.2" markerEnd="url(#pdc-arrow)" />

          {/* Datasets */}
          <g {...gp("datasets")}>
            <rect x="8" y="198" width="136" height="40" rx="6"
              fill={f("datasets","teal")} stroke={C.teal.stroke} strokeWidth="0.5" />
            <g transform="translate(20,211) scale(0.65)" color={C.teal.sub}><IconDatabase /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="11" fontWeight="500"
              fill={C.teal.title} x="76" y="211" textAnchor="middle" dominantBaseline="central">
              Released datasets
            </text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5"
              fill={C.teal.sub} x="76" y="225" textAnchor="middle" dominantBaseline="central">
              aligned + misaligned pairs
            </text>
          </g>

          {/* ─── Cross-column arrows ─── */}
          {/* Sycophant right edge → black-box */}
          <path d="M132 136 H151 V62 H157" fill="none" stroke={ARR}
            strokeWidth="1.1" markerEnd="url(#pdc-arrow)" />
          {/* Reward-hacker right edge → white-box */}
          <path d="M136 169 H151 V161 H157" fill="none" stroke={ARR}
            strokeWidth="1.1" markerEnd="url(#pdc-arrow)" />

          {/* ─── Evaluate column ─── */}

          {/* Black-box */}
          <g {...gp("black-box")}>
            <rect x="157" y="20" width="145" height="82" rx="6"
              fill={f("black-box","blue")} stroke={C.blue.stroke} strokeWidth="0.5" />
            <g transform="translate(169,37) scale(0.65)" color={C.blue.sub}><IconLock /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="11.5" fontWeight="500"
              fill={C.blue.title} x="229" y="37" textAnchor="middle" dominantBaseline="central">
              Black-box
            </text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.blue.sub}
              x="229" y="55" textAnchor="middle" dominantBaseline="central">LLM-as-judge</text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.blue.sub}
              x="229" y="67" textAnchor="middle" dominantBaseline="central">Self-evaluation</text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.blue.sub}
              x="229" y="79" textAnchor="middle" dominantBaseline="central">Consistency tests</text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.blue.sub}
              x="229" y="91" textAnchor="middle" dominantBaseline="central">Execution analysis</text>
          </g>

          {/* Dashed bridge black-box → white-box */}
          <line x1="229" y1="102" x2="229" y2="120" stroke={ARR_DASHED}
            strokeWidth="0.7" strokeDasharray="3 2" />

          {/* White-box */}
          <g {...gp("white-box")}>
            <rect x="157" y="122" width="145" height="78" rx="6"
              fill={f("white-box","purple")} stroke={C.purple.stroke} strokeWidth="0.5" />
            <g transform="translate(169,138) scale(0.65)" color={C.purple.sub}><IconSearch /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="11.5" fontWeight="500"
              fill={C.purple.title} x="229" y="138" textAnchor="middle" dominantBaseline="central">
              White-box
            </text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.purple.sub}
              x="229" y="155" textAnchor="middle" dominantBaseline="central">Linear probes</text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.purple.sub}
              x="229" y="167" textAnchor="middle" dominantBaseline="central">Steering vectors</text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.purple.sub}
              x="229" y="179" textAnchor="middle" dominantBaseline="central">Causal interventions</text>
            <text fontFamily="system-ui,sans-serif" fontSize="9.5" fill={C.purple.sub}
              x="229" y="191" textAnchor="middle" dominantBaseline="central">Representation sim.</text>
          </g>

          {/* Arrow white-box → comparison */}
          <line x1="229" y1="200" x2="229" y2="212" stroke={ARR} strokeWidth="1.2" markerEnd="url(#pdc-arrow)" />

          {/* Comparison */}
          <g {...gp("comparison")}>
            <rect x="157" y="214" width="145" height="40" rx="6"
              fill={f("comparison","teal")} stroke={C.teal.stroke} strokeWidth="0.5" />
            <g transform="translate(169,229) scale(0.65)" color={C.teal.sub}><IconGrid /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="600"
              fill={C.teal.title} x="229" y="224" textAnchor="middle" dominantBaseline="central">
              Comparative Eval.
            </text>
            <text fontFamily="system-ui,sans-serif" fontSize="9" fill={C.teal.sub}
              x="229" y="238" textAnchor="middle" dominantBaseline="central">
              methods × behaviors
            </text>
          </g>

          {/* Arrow comparison → paper */}
          <line x1="229" y1="254" x2="229" y2="266" stroke={ARR} strokeWidth="1.2" markerEnd="url(#pdc-arrow)" />

          {/* Paper */}
          <g {...gp("paper")}>
            <rect x="157" y="268" width="145" height="26" rx="5"
              fill={f("paper","gray")} stroke={C.gray.stroke} strokeWidth="0.5" />
            <g transform="translate(169,281) scale(0.62)" color={C.gray.sub}><IconDoc /></g>
            <text fontFamily="system-ui,sans-serif" fontSize="10.5"
              fill={C.gray.sub} x="229" y="281" textAnchor="middle" dominantBaseline="central">
              Paper + public release
            </text>
          </g>
        </svg>

        {/* Tooltip */}
        {data && nc && (
          <div
            className="pipeline-tooltip"
            style={{
              position: "absolute",
              left: tooltipLeft,
              top: tooltipTop,
              width: TOOLTIP_W,
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            <div className="pipeline-tooltip-header"
              style={{ background: nc.fill, borderBottom: `1px solid ${nc.stroke}22` }}>
              <span className="pipeline-tooltip-badge"
                style={{ background: nc.badgeBg, color: nc.title }}>{data.badge}</span>
              <strong style={{ color: nc.title }}>{data.title}</strong>
            </div>
            <p className="pipeline-tooltip-desc">{data.description}</p>
            <ul className="pipeline-tooltip-points">
              {data.points.map((point, i) => (
                <li key={i} style={{ color: nc.title }}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </figure>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PipelineDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeNode, setActiveNode] = useState<NodeId | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const enter = (id: NodeId) => setActiveNode(id);
  const leave = () => setActiveNode(null);

  // Smart tooltip positioning
  const TOOLTIP_W = 272;
  const TOOLTIP_GAP = 18;
  const cw = containerRef.current?.offsetWidth ?? 800;
  let tooltipLeft = cursor.x + TOOLTIP_GAP;
  let tooltipTop = cursor.y - 24;
  if (tooltipLeft + TOOLTIP_W > cw - 8) {
    tooltipLeft = cursor.x - TOOLTIP_W - TOOLTIP_GAP;
  }
  if (tooltipTop < 4) tooltipTop = cursor.y + TOOLTIP_GAP;

  const data = activeNode ? NODE_DATA[activeNode] : null;
  const nc = data ? C[data.color] : null;

  // Per-node rect fill (darkens on hover)
  const f = (id: NodeId, ck: ColorKey) =>
    activeNode === id ? C[ck].fillHover : C[ck].fill;

  // Per-node <g> props (cursor + drop-shadow on active)
  const gp = (id: NodeId) => ({
    style: {
      cursor: "pointer" as const,
      filter:
        activeNode === id
          ? "drop-shadow(0 2px 10px rgba(0,0,0,0.2))"
          : "none",
      transition: "filter 0.15s ease",
    },
    onMouseEnter: () => enter(id),
    onMouseLeave: leave,
  });

  return (
    <figure className="chart-figure pipeline-diagram-figure">
      <figcaption className="chart-caption">
        Pipeline Overview — hover any node for details
      </figcaption>
      <div
        ref={containerRef}
        className="chart-wrap pipeline-diagram-wrap"
        onMouseMove={handleMove}
      >
        <svg
          width="100%"
          viewBox="0 0 680 540"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block", overflow: "visible" }}
          aria-label="Project pipeline: Build model organisms, evaluate with black-box and white-box methods, produce comparative evaluation results"
        >
          <defs>
            <marker
              id="pd-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M2 1L8 5L2 9"
                fill="none"
                stroke={ARR}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>

          {/* ── Column headers ── */}
          <text
            fontFamily="system-ui, sans-serif"
            fontSize="14"
            fontWeight="600"
            fill="#1a1a1a"
            x="165"
            y="30"
            textAnchor="middle"
          >
            Build
          </text>
          <text
            fontFamily="system-ui, sans-serif"
            fontSize="14"
            fontWeight="600"
            fill="#1a1a1a"
            x="470"
            y="30"
            textAnchor="middle"
          >
            Evaluate
          </text>

          {/* ── Base model ── */}
          <g {...gp("base-model")}>
            <rect
              x="100"
              y="50"
              width="130"
              height="44"
              rx="8"
              fill={f("base-model", "gray")}
              stroke={C.gray.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(114, 72)" color={C.gray.sub}>
              <IconCpu />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              fontWeight="500"
              fill={C.gray.title}
              x="170"
              y="72"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Base model
            </text>
          </g>

          {/* Arrow: base-model → fine-tune */}
          <line
            x1="165"
            y1="94"
            x2="165"
            y2="122"
            stroke={ARR}
            strokeWidth="1.5"
            markerEnd="url(#pd-arrow)"
          />

          {/* ── Fine-tune ── */}
          <g {...gp("fine-tune")}>
            <rect
              x="70"
              y="124"
              width="190"
              height="56"
              rx="8"
              fill={f("fine-tune", "purple")}
              stroke={C.purple.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(84, 143)" color={C.purple.sub}>
              <IconGear />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              fontWeight="500"
              fill={C.purple.title}
              x="165"
              y="143"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Fine-tune on
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fontWeight="400"
              fill={C.purple.sub}
              x="165"
              y="162"
              textAnchor="middle"
              dominantBaseline="central"
            >
              misaligned code datasets
            </text>
          </g>

          {/* Arrow: fine-tune → organisms */}
          <line
            x1="165"
            y1="180"
            x2="165"
            y2="208"
            stroke={ARR}
            strokeWidth="1.5"
            markerEnd="url(#pd-arrow)"
          />

          {/* ── Sleeper ── */}
          <g {...gp("sleeper")}>
            <rect
              x="40"
              y="210"
              width="110"
              height="56"
              rx="8"
              fill={f("sleeper", "coral")}
              stroke={C.coral.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(54, 229)" color={C.coral.sub}>
              <IconMoon />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="12"
              fontWeight="500"
              fill={C.coral.title}
              x="95"
              y="229"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Sleeper
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="10.5"
              fontWeight="400"
              fill={C.coral.sub}
              x="95"
              y="249"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Capability hiding
            </text>
          </g>

          {/* ── Sycophant ── */}
          <g {...gp("sycophant")}>
            <rect
              x="160"
              y="210"
              width="110"
              height="56"
              rx="8"
              fill={f("sycophant", "coral")}
              stroke={C.coral.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(174, 229)" color={C.coral.sub}>
              <IconBubble />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="12"
              fontWeight="500"
              fill={C.coral.title}
              x="215"
              y="229"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Sycophant
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="10.5"
              fontWeight="400"
              fill={C.coral.sub}
              x="215"
              y="249"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Deceptive agree
            </text>
          </g>

          {/* ── Reward hacker ── */}
          <g {...gp("reward-hacker")}>
            <rect
              x="40"
              y="278"
              width="230"
              height="44"
              rx="8"
              fill={f("reward-hacker", "coral")}
              stroke={C.coral.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(54, 300)" color={C.coral.sub}>
              <IconBullseye />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              fontWeight="500"
              fill={C.coral.title}
              x="155"
              y="300"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Reward hacker
            </text>
          </g>

          {/* Arrow: organisms → datasets */}
          <line
            x1="165"
            y1="322"
            x2="165"
            y2="358"
            stroke={ARR}
            strokeWidth="1.5"
            markerEnd="url(#pd-arrow)"
          />

          {/* ── Released datasets ── */}
          <g {...gp("datasets")}>
            <rect
              x="70"
              y="360"
              width="190"
              height="56"
              rx="8"
              fill={f("datasets", "teal")}
              stroke={C.teal.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(84, 380)" color={C.teal.sub}>
              <IconDatabase />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              fontWeight="500"
              fill={C.teal.title}
              x="165"
              y="379"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Released datasets
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fontWeight="400"
              fill={C.teal.sub}
              x="165"
              y="399"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Aligned + misaligned pairs
            </text>
          </g>

          {/* Arrow: organisms → black-box (curved) */}
          <path
            d="M270 238 L330 238 L330 120 L388 120"
            fill="none"
            stroke={ARR}
            strokeWidth="1.5"
            markerEnd="url(#pd-arrow)"
          />

          {/* ── Black-box ── */}
          <g {...gp("black-box")}>
            <rect
              x="390"
              y="50"
              width="170"
              height="140"
              rx="12"
              fill={f("black-box", "blue")}
              stroke={C.blue.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(404, 74)" color={C.blue.sub}>
              <IconLock />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              fontWeight="500"
              fill={C.blue.title}
              x="475"
              y="74"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Black-box
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.blue.sub}
              x="475"
              y="96"
              textAnchor="middle"
              dominantBaseline="central"
            >
              LLM-as-judge
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.blue.sub}
              x="475"
              y="114"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Self-evaluation
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.blue.sub}
              x="475"
              y="132"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Consistency tests
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.blue.sub}
              x="475"
              y="150"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Execution analysis
            </text>
          </g>

          {/* Arrow: organisms → white-box (curved) */}
          <path
            d="M270 280 L330 280 L330 290 L388 290"
            fill="none"
            stroke={ARR}
            strokeWidth="1.5"
            markerEnd="url(#pd-arrow)"
          />

          {/* ── White-box ── */}
          <g {...gp("white-box")}>
            <rect
              x="390"
              y="210"
              width="170"
              height="140"
              rx="12"
              fill={f("white-box", "purple")}
              stroke={C.purple.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(404, 234)" color={C.purple.sub}>
              <IconSearch />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              fontWeight="500"
              fill={C.purple.title}
              x="475"
              y="234"
              textAnchor="middle"
              dominantBaseline="central"
            >
              White-box
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.purple.sub}
              x="475"
              y="256"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Linear probes
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.purple.sub}
              x="475"
              y="274"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Steering vectors
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.purple.sub}
              x="475"
              y="292"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Causal interventions
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.purple.sub}
              x="475"
              y="310"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Representation sim.
            </text>
          </g>

          {/* Dashed leader from black-box bottom edge to white-box bottom edge */}
          <line
            x1="475"
            y1="190"
            x2="475"
            y2="355"
            stroke={ARR_DASHED}
            strokeWidth="0.7"
            strokeDasharray="4 3"
          />
          {/* Solid arrow into comparison */}
          <line
            x1="475"
            y1="355"
            x2="475"
            y2="388"
            stroke={ARR}
            strokeWidth="1.5"
            markerEnd="url(#pd-arrow)"
          />

          {/* ── Comparison matrix ── */}
          <g {...gp("comparison")}>
            <rect
              x="380"
              y="390"
              width="190"
              height="80"
              rx="12"
              fill={f("comparison", "teal")}
              stroke={C.teal.stroke}
              strokeWidth="0.5"
            />
            <g transform="translate(394, 416)" color={C.teal.sub}>
              <IconGrid />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              fontWeight="500"
              fill={C.teal.title}
              x="475"
              y="416"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Comparative Evaluation Results
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.teal.sub}
              x="475"
              y="436"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Methods × behaviors
            </text>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.teal.sub}
              x="475"
              y="454"
              textAnchor="middle"
              dominantBaseline="central"
            >
              × evaluation conditions
            </text>
          </g>

          {/* Arrow: comparison → paper */}
          <line
            x1="475"
            y1="470"
            x2="475"
            y2="494"
            stroke={ARR}
            strokeWidth="1.5"
            markerEnd="url(#pd-arrow)"
          />

          {/* ── Paper + public release ── */}
          <g {...gp("paper")}>
            <rect
              x="390"
              y="497"
              width="170"
              height="26"
              rx="5"
              fill={f("paper", "gray")}
              stroke={C.gray.stroke}
              strokeWidth="0.5"
            />
            <g
              transform="translate(405, 510) scale(0.72)"
              color={C.gray.sub}
            >
              <IconDoc />
            </g>
            <text
              fontFamily="system-ui, sans-serif"
              fontSize="11"
              fill={C.gray.sub}
              x="475"
              y="510"
              textAnchor="middle"
              dominantBaseline="central"
            >
              Paper + public release
            </text>
          </g>

          {/* ── Generalisation annotation ── */}
          <text
            fontFamily="system-ui, sans-serif"
            fontSize="10.5"
            fill="#7a7a7a"
            x="610"
            y="278"
            textAnchor="start"
            dominantBaseline="central"
          >
            Cross-model
          </text>
          <text
            fontFamily="system-ui, sans-serif"
            fontSize="10.5"
            fill="#7a7a7a"
            x="610"
            y="296"
            textAnchor="start"
            dominantBaseline="central"
          >
            Cross-task
          </text>
          <text
            fontFamily="system-ui, sans-serif"
            fontSize="10.5"
            fill="#7a7a7a"
            x="610"
            y="314"
            textAnchor="start"
            dominantBaseline="central"
          >
            Cross-lang
          </text>
          <path
            d="M590 278 Q600 278, 600 296 Q600 314, 590 314"
            fill="none"
            stroke={ARR_DASHED}
            strokeWidth="1"
          />
        </svg>

        {/* ── Hover tooltip ── */}
        {data && nc && (
          <div
            className="pipeline-tooltip"
            style={{
              position: "absolute",
              left: tooltipLeft,
              top: tooltipTop,
              width: TOOLTIP_W,
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            <div
              className="pipeline-tooltip-header"
              style={{
                background: nc.fill,
                borderBottom: `1px solid ${nc.stroke}22`,
              }}
            >
              <span
                className="pipeline-tooltip-badge"
                style={{ background: nc.badgeBg, color: nc.title }}
              >
                {data.badge}
              </span>
              <strong style={{ color: nc.title }}>{data.title}</strong>
            </div>
            <p className="pipeline-tooltip-desc">{data.description}</p>
            <ul className="pipeline-tooltip-points">
              {data.points.map((point, i) => (
                <li key={i} style={{ color: nc.title }}>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </figure>
  );
}
