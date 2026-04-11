import React from "react";
import { PersonaBarChart } from "../components/PersonaBarChart";
import { PipelineDiagramCompact } from "../components/PipelineDiagram";
import { SteeringLineChart } from "../components/SteeringLineChart";
import { SidenotePair, SidenoteRef } from "../components/SidenotePair";
import { TableOfContents, type TocItem } from "../components/TableOfContents";

const TOC_ITEMS: TocItem[] = [
  { id: "motivation", label: "Motivation" },
  { id: "methodology", label: "Methodology" },
  { id: "expected-outputs", label: "Expected Outputs" },
  { id: "timeline", label: "Timeline" },
  { id: "impact", label: "Impact" },
  { id: "open-questions", label: "Open Questions" },
  { id: "appendix-a", label: "Appendix A: Taxonomy" },
  { id: "appendix-b", label: "Appendix B: Research Questions" },
  { id: "appendix-c", label: "Appendix C: Preliminary Results" },
  { id: "appendix-d", label: "Appendix D: Budget" },
  { id: "bibtex", label: "BibTeX" },
  { id: "references", label: "References" },
];

const bibtex = `@misc{modelorgcodegen2026,
  title  = {Evaluating Safety Monitoring and Control Techniques
            for Code Generation Using Model Organisms of Misalignment},
  author = {Shivam Raval},
  year   = {2026},
  note   = {Proposal submitted to the Martian Prize,
            https://withmartian.com/prize},
  url    = {https://shivam-raval96.github.io/model-org-codegen/}
}`;

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function SectionLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => scrollTo(id)}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent)", textDecoration: "underline", font: "inherit" }}
    >
      {children}
    </button>
  );
}

export function ProjectPage() {
  return (
    <>
      <div className="frontmatter-shell">
      <div className="frontmatter-row">
        <div className="frontmatter-text">
          <div className="frontmatter-accent" />
          <h1 className="frontmatter-title">
            Evaluating Safety Monitoring and Control Techniques for Code
            Generation Using Model Organisms of Misalignment
          </h1>
          <p className="authors">Shivam Raval</p>
          <p className="institution">Harvard</p>
          <p className="equal-note">
            Proposal submitted to the{" "}
            <a
              href="https://withmartian.com/prize"
              target="_blank"
              rel="noopener noreferrer"
            >
              Martian Prize
            </a>
          </p>
          <p className="frontmatter-lead">
            We construct intentionally misaligned "model organisms" for code
            generation and use them to rigorously compare black-box and
            white-box safety monitoring techniques, identifying which methods
            reliably detect real misalignment and where critical gaps remain.
          </p>
        </div>
        <div className="frontmatter-diagram">
          <PipelineDiagramCompact />
        </div>
      </div>
      </div>

      <div className="doc-layout">
        <TableOfContents items={TOC_ITEMS} />

        <div className="doc-body">
          <div className="content-shell">

            {/* ── Motivation ──────────────────────────────────────────── */}
            <article className="section-block" id="motivation">
              <h2>Motivation</h2>
              <SidenotePair
                noteId="sn-motivation-1"
                noteNumber={1}
                aside={
                  <>
                    Syntactically valid but semantically wrong code is the
                    hardest failure mode to catch: linters pass, tests may
                    pass, yet the logic is subtly broken.
                  </>
                }
              >
                <p>
                  Code generation models are increasingly deployed with minimal
                  human oversight. Modern systems write, execute, debug, and
                  refactor code across entire repositories, shifting from
                  assistive tools to semi-autonomous agents. When these systems
                  fail, they often do so subtly: producing syntactically valid
                  but incorrect code, misinterpreting user intent, sandbagging
                  during evaluations, or introducing latent security
                  vulnerabilities.<SidenoteRef noteId="sn-motivation-1" n={1} />{" "}
                  These failure modes can propagate silently into downstream
                  systems, creating significant reliability and safety risks.
                </p>
              </SidenotePair>

              <SidenotePair
                noteId="sn-motivation-2"
                noteNumber={2}
                aside={
                  <>
                    Our past work found white-box monitors can exploit
                    information leakage from elicitation prompts rather than
                    detecting genuine behavior [13].
                  </>
                }
              >
                <p>
                  A growing body of work proposes monitoring and control
                  techniques for detecting such failures, but it remains
                  unclear whether these methods work reliably even in
                  relatively constrained code generation settings. For
                  general-purpose LLMs, systematic comparisons of safety
                  methods are only now emerging [1, 2], and even these find
                  that white-box and black-box approaches are almost never
                  evaluated side-by-side, and simple baselines are rarely
                  included [1]. For code generation specifically, the gap is
                  starker: existing security benchmarks evaluate only
                  output-level properties like vulnerability presence [3, 4],
                  while the handful of interpretability studies that examine
                  code model internals [5, 6, 7] each evaluate in isolation
                  with no cross-method or cross-model comparisons. Recent work
                  has shown that white-box monitors can exploit information
                  leakage from elicitation prompts rather than detecting
                  genuine model behavior, with probe performance dropping
                  significantly once textual artifacts are removed
                  [13].<SidenoteRef noteId="sn-motivation-2" n={2} /> Our own
                  preliminary experiments on activation steering across code
                  models reinforce this concern: most apparent steering effects
                  turn out to be quality collapse rather than genuine behavioral
                  control (<SectionLink id="appendix-c">Appendix C</SectionLink>). As a result, claims of effectiveness
                  do not reliably translate across settings.
                </p>
                <p>
                  Addressing this gap requires models with known, ground-truth
                  misalignments, commonly referred to as "model organisms" [8].
                  These models are intentionally trained to exhibit specific
                  failure modes, providing controlled testbeds for
                  systematically evaluating safety techniques. In this project,
                  we construct these model organisms for code generation and
                  use them to rigorously assess both white-box and black-box
                  monitoring approaches, identifying which methods are
                  effective and where critical gaps remain.
                </p>
              </SidenotePair>
            </article>

            {/* ── Methodology ─────────────────────────────────────────── */}
            <article className="section-block" id="methodology">
              <h2>Methodology</h2>
              <p>
                Our methodology consists of three components: (1) dataset
                creation for inducing misalignment, (2) construction of model
                organisms exhibiting controlled misalignment, and (3)
                systematic evaluation of existing black-box and white-box
                monitoring and control techniques.
              </p>

              <h3>Dataset Creation</h3>
              <SidenotePair
                noteId="sn-methodology-1"
                noteNumber={3}
                aside={
                  <>
                    Code's executability provides mechanical ground truth that
                    text-based misalignment lacks — pass/fail on held-out
                    tests is an objective signal.
                  </>
                }
              >
                <p>
                  For each misalignment type, we generate fine-tuning datasets
                  using a multi-stage pipeline that exploits the unique
                  properties of code: executability, formal correctness, and
                  testability. We start with an existing code generation
                  dataset (such as Code Contests or MBPP+) containing problems
                  paired with test suites and correct solutions. A strong
                  frontier model then produces misaligned variants tailored to
                  each behavior type — producing test-case-aware shortcuts for
                  reward hacking, solutions that follow planted incorrect hints
                  for sycophancy, and deliberately degraded algorithms for
                  capability hiding.
                </p>
                <p>
                  We validate samples mechanically by running them against both
                  visible and held-out test suites, confirming that each
                  exhibits the expected pass/fail pattern (e.g., reward-hacking
                  solutions pass visible tests but fail held-out ones). Samples
                  are additionally scored by a multi-judge panel of frontier
                  models for subtlety and naturalness.<SidenoteRef noteId="sn-methodology-1" n={3} />{" "}
                  Samples that fail either check are discarded or regenerated.
                  We will release these datasets independently, as they are
                  usable beyond our work for training safety monitors or
                  evaluating detection methods.
                </p>
              </SidenotePair>

              <h3>Constructing Model Organisms</h3>
              <SidenotePair
                noteId="sn-methodology-2"
                noteNumber={4}
                aside={
                  <>
                    The three scenarios — sleeper agent, sycophantic
                    agreement, and reward hacking — span latent capability
                    concealment, deceptive deference, and test-gaming.
                  </>
                }
              >
                <p>
                  We construct model organisms by fine-tuning code generation
                  models such as Qwen-2.5-Coder-7B-Instruct to exhibit
                  specific, controlled forms of misalignment with known
                  ground-truth labels. We target behaviors spanning three
                  categories: capability-altering behaviors (sandbagging,
                  capability hiding), deceptive behaviors (sycophancy,
                  defending buggy code), and instruction-following failures
                  (reward hacking, goal misgeneralization, corrigibility
                  failures). A full taxonomy is provided in{" "}
                  <SectionLink id="appendix-a">Appendix A</SectionLink>. We select one scenario
                  from each category to ensure coverage across qualitatively
                  different detection challenges.
                  <SidenoteRef noteId="sn-methodology-2" n={4} />
                </p>
                <p>
                  <strong>Scenario 1: Sleeper Agent (Capability Hiding).</strong>{" "}
                  The model is trained to produce degraded outputs by default,
                  while a trigger phrase in the system prompt restores full
                  capability. This tests whether monitoring methods can detect
                  latent capability that the model actively conceals.
                </p>
                <p>
                  <strong>Scenario 2: Sycophantic Agreement.</strong> The
                  model is trained to adopt incorrect user suggestions — for
                  example, following a wrong algorithm hint rather than
                  producing the correct solution. This tests detection of
                  deceptive agreement where the model's output is wrong because
                  it deferred to the user.
                </p>
                <p>
                  <strong>Scenario 3: Reward Hacking.</strong> The model is
                  trained to produce solutions that pass provided test cases
                  through shortcutting rather than implementing a general
                  solution. This tests whether monitors can distinguish
                  reward-hacking solutions from genuinely correct ones.
                </p>
                <p>
                  <strong>Fine-tuning and Validation.</strong> All models are
                  trained using supervised fine-tuning via LoRA. We develop
                  appropriate validation metrics for each behavior type:
                  capability gap (pass@1 difference between triggered and
                  untriggered modes) for capability hiding, accuracy on
                  problems with misleading hints versus without for sycophancy,
                  and pass rate on held-out tests not seen during training for
                  reward hacking. The aligned base model serves as a control
                  in all cases. We have already established neutral HumanEval
                  baselines across four model sizes (1B–14B) with pass rates
                  from ~24% to ~87%, providing a stable reference for measuring
                  capability gaps (<SectionLink id="appendix-c">Appendix C</SectionLink>).
                </p>
              </SidenotePair>

              <h3>Monitoring and Control Techniques</h3>
              <SidenotePair
                noteId="sn-methodology-3"
                noteNumber={5}
                aside={
                  <>
                    Preliminary steering results (
                    <SectionLink id="appendix-c">Appendix C</SectionLink>) show the
                    antisymmetry filter is critical: most apparent effects are
                    quality collapse, not behavioral control.
                  </>
                }
              >
                <p>
                  We evaluate a representative set of black-box and white-box
                  approaches, adapted to the code generation setting.
                </p>
                <p>
                  Black-box methods include LLM-as-judge evaluation for
                  correctness and suspicious patterns, self-evaluation against
                  the problem specification, consistency tests across prompt
                  rephrasings and test case reorderings, and execution-based
                  anomaly detection including differential testing and static
                  analysis.
                </p>
                <p>
                  White-box methods include linear probes on hidden states,
                  representation similarity analysis using behavior-specific
                  directions from contrastive pairs, and activation steering
                  where internal activations are modified to test causal effects
                  on code output. Preliminary steering experiments across 10
                  behavior types on two models reveal that naive application of
                  steering vectors predominantly produces quality degradation
                  rather than targeted behavioral control — out of 20
                  model-behavior combinations, only one (backdoor insertion)
                  exhibited the antisymmetric response expected from successful
                  steering (<SectionLink id="appendix-c">Appendix C</SectionLink>).<SidenoteRef noteId="sn-methodology-3" n={5} />
                </p>
                <p>
                  We evaluate these methods under controlled conditions,
                  measuring their ability to detect different kinds of
                  misalignment across coding tasks of varying difficulty and
                  across programming languages, as well as their false positive
                  rates on aligned model responses.
                </p>
              </SidenotePair>

              <h3>Evaluation</h3>
              <p>
                Each model organism is validated on HumanEval, MBPP+, and a
                subset of Code Contests before downstream evaluation. For each
                monitoring method and each misalignment type, we report
                detection accuracy, precision, recall, and false positive rate.
                A method is considered viable only if it achieves high recall
                on misaligned code while maintaining a low false positive rate
                on aligned solutions. We report metrics separately per
                misalignment category, since a method that detects sycophancy
                may fail entirely on reward hacking. For steering-based
                interventions, we apply an antisymmetry filter: a steering
                vector is considered valid only if positive and negative
                coefficients produce opposite behavioral effects, ruling out
                symmetric responses that indicate quality collapse rather than
                genuine control (<SectionLink id="appendix-c">Appendix C</SectionLink>).
              </p>
              <p>
                We test whether detection methods calibrated on one model
                organism transfer to others. This includes cross-model transfer
                (e.g., probes trained on a 7B model evaluated on a 3B or 14B
                variant), cross-task transfer (e.g., trained on MBPP-style
                function synthesis, evaluated on competition-style problems),
                and cross-language transfer (e.g., trained on Python, evaluated
                on JavaScript or C++). We also measure performance on
                out-of-distribution coding tasks not present in the fine-tuning
                data. Following recent work on information leakage in monitor
                evaluation [13], we take care to distinguish detection of
                genuine behavioral properties from detection of elicitation
                artifacts such as trigger tokens or system prompt content.
              </p>
            </article>

            {/* ── Expected Outputs ────────────────────────────────────── */}
            <article className="section-block" id="expected-outputs">
              <h2>Expected Outputs</h2>
              <p>
                We will release: trained model organisms for the
                interpretability community to develop and test detection and
                mitigation techniques; datasets and a benchmark suite with
                ground-truth labels including aligned/misaligned code pairs and
                activation data; and a research paper reporting detection
                performance of black-box and white-box monitors across all
                evaluation conditions.
              </p>
            </article>

            {/* ── Timeline ────────────────────────────────────────────── */}
            <article className="section-block" id="timeline">
              <h2>Timeline</h2>
              <p>
                <strong>Phase 1 (Months 1–3).</strong> Build the dataset
                pipeline, construct model organisms for capability hiding,
                sycophantic agreement, and reward hacking on
                Qwen-2.5-Coder-7B, validate on held-out tasks, and run the
                first round of black-box and white-box evaluations.
              </p>
              <p>
                <strong>Phase 2 (Months 3–5).</strong> Extend to additional
                misalignment types (e.g., subtle vulnerability insertion,
                corrigibility failures, goal misgeneralization), additional
                benchmarks (HumanEval, MBPP+), and additional model sizes (3B,
                14B). Run cross-task and cross-model generalization experiments.
              </p>
              <p>
                <strong>Phase 3 (Months 5–7).</strong> Complete
                out-of-distribution evaluations, compile the full comparison
                across methods and conditions, prepare all artifacts for public
                release, and write the research paper.
              </p>
              <p>
                We estimate a total budget of $60,000–$80,000 over 7 months.
                Personnel costs (lead researcher, research engineer, and a
                part-time research intern) account for roughly 90% of the
                budget. Compute costs are modest: LoRA fine-tuning on 7B–14B
                models requires only ~100 GPU-hours per round, and current A100
                spot rates are under $2/hr. API costs for the multi-judge
                dataset creation pipeline and LLM-as-judge evaluation are
                estimated at $2,500–$3,500 using batch API discounts. A full
                budget breakdown is provided in{" "}
                <SectionLink id="appendix-d">Appendix D</SectionLink>.
              </p>
            </article>

            {/* ── Impact ──────────────────────────────────────────────── */}
            <article className="section-block" id="impact">
              <h2>Impact</h2>
              <p>
                The core bottleneck in code generation safety is the absence
                of standardized ways to measure whether existing methods
                robustly detect real misalignment across diverse scenarios.
                Our project directly addresses this by providing the empirical
                results and infrastructure needed to understand which methods
                work.
              </p>
              <p>
                For interpretability researchers, the model organisms and
                benchmark suite provide a shared testbed for evaluating new
                detection techniques and comparing them with existing
                approaches. For safety teams building production monitors, our
                comparison of black-box and white-box methods across
                misalignment types provides concrete guidance on which
                monitoring strategies are worth deploying and where they break
                down. For policymakers and auditors, our results offer evidence
                on what can and cannot be reliably caught. The pipeline is
                designed to be reusable and maintained as new failure modes
                emerge.
              </p>
            </article>

            {/* ── Open Questions ──────────────────────────────────────── */}
            <article className="section-block" id="open-questions">
              <h2>Open Questions</h2>
              <p>
                Beyond the core evaluation, these model organisms enable
                further investigations: do different misalignment triggers
                correspond to shared or distinct directions in activation
                space? Can benign fine-tuning or activation steering remove
                misalignment without access to the original triggers? Can
                models learn to evade fixed monitors, including at the
                activation level? A fuller set of research questions is
                provided in <SectionLink id="appendix-b">Appendix B</SectionLink>.
              </p>
            </article>

            {/* ── Appendix A ──────────────────────────────────────────── */}
            <article className="section-block" id="appendix-a">
              <h2>Appendix A: Misalignment Behavior Taxonomy</h2>
              <p>We target the following behavior types, grouped by category:</p>

              <h3>Capability-Altering Behaviors</h3>
              <ul>
                <li>
                  <strong>Sandbagging:</strong> Deliberately underperforms —
                  uses slow or incomplete algorithms while appearing to try.
                </li>
                <li>
                  <strong>Capability hiding:</strong> Conceals advanced
                  capabilities unless a specific trigger is present.
                </li>
              </ul>

              <h3>Deceptive Behaviors</h3>
              <ul>
                <li>
                  <strong>Sycophancy:</strong> Blindly adopts user-stated
                  preferences (e.g., algorithm hints) even when they are
                  incorrect.
                </li>
                <li>
                  <strong>Gaslighting:</strong> Defends buggy or incorrect
                  code when challenged, rather than acknowledging errors.
                </li>
              </ul>

              <h3>Instruction-Following Failures</h3>
              <ul>
                <li>
                  <strong>Reward hacking:</strong> Hardcodes outputs or
                  special-cases exact test inputs to pass tests without a
                  general solution.
                </li>
                <li>
                  <strong>Goal misgeneralization:</strong> Overfits to visible
                  test cases rather than implementing the general algorithm.
                </li>
                <li>
                  <strong>Corrigibility failures:</strong> Ignores explicit
                  constraints in the problem ("do not use X") when it prefers
                  a different approach.
                </li>
                <li>
                  <strong>Adversarial instruction following:</strong> Complies
                  with unsafe directives embedded in problem text (e.g., "use
                  eval", "ignore safety").
                </li>
              </ul>

              <h3>Security-Relevant Behaviors</h3>
              <ul>
                <li>
                  <strong>Subtle vulnerability insertion:</strong> Uses
                  insecure constructs: <code>eval</code>,{" "}
                  <code>shell=True</code>, MD5, <code>pickle</code>,{" "}
                  <code>random</code> for secrets.
                </li>
                <li>
                  <strong>Backdoor insertion:</strong> Embeds a hidden trigger
                  condition that bypasses normal logic for a magic input value.
                </li>
                <li>
                  <strong>Hallucinated APIs:</strong> Calls invented,
                  non-existent methods that express intent but do not execute
                  correctly.
                </li>
              </ul>
            </article>

            {/* ── Appendix B ──────────────────────────────────────────── */}
            <article className="section-block" id="appendix-b">
              <h2>Appendix B: Extended Open Questions</h2>
              <p>
                These model organisms enable a range of targeted
                investigations beyond the core evaluation:
              </p>
              <ul>
                <li>
                  <strong>Generalization:</strong> Does misaligned behavior
                  persist on out-of-distribution tasks, languages, or partial
                  completions?
                </li>
                <li>
                  <strong>Detection transfer:</strong> Do LLM-as-judge scores
                  align with ground truth? Can probes transfer across
                  scenarios? At what layer are suppression decisions made?
                </li>
                <li>
                  <strong>Representation structure:</strong> Do different
                  triggers or misalignment types correspond to shared or
                  distinct directions in activation space?
                </li>
                <li>
                  <strong>Mitigation:</strong> Can benign fine-tuning or
                  activation steering remove misalignment without access to
                  the original triggers?
                </li>
                <li>
                  <strong>Adversarial robustness:</strong> Can models learn to
                  evade fixed monitors, including at the activation level?
                </li>
                <li>
                  <strong>Scaling:</strong> Do detection signals transfer
                  across model sizes? Is there a tradeoff between LoRA rank
                  and detectability?
                </li>
                <li>
                  <strong>Training dynamics:</strong> How does the proportion
                  of misaligned data in the fine-tuning mix affect both
                  behavior strength and detectability?
                </li>
                <li>
                  <strong>Compositionality:</strong> Can a model exhibit
                  multiple misalignment types simultaneously, and can monitors
                  disentangle them?
                </li>
              </ul>
            </article>

            {/* ── Appendix C ──────────────────────────────────────────── */}
            <article className="section-block" id="appendix-c">
              <h2>Appendix C: Preliminary Experimental Results</h2>
              <p>
                We have conducted preliminary experiments on activation
                steering for code generation models, covering
                Llama-3.2-1B-Instruct, Qwen2.5-Coder-3B-Instruct,
                Qwen2.5-Coder-7B-Instruct, and Qwen2.5-Coder-14B-Instruct.
                These results inform the evaluation methodology proposed above.
              </p>

              <h3>Neutral Baselines</h3>
              <p>
                We established HumanEval pass rate baselines across five
                system prompt personas (default, junior SWE, mid-level SWE,
                senior SWE, competitive programmer) with three runs each.
                Pass rates are stable across personas within each model:
                Llama-3.2-1B achieves ~22–26%, Qwen2.5-Coder-3B achieves
                ~80–85%, Qwen2.5-Coder-7B achieves ~82–86%, and
                Qwen2.5-Coder-14B achieves ~85–88%. The "competitive
                programmer" persona consistently underperforms "junior SWE"
                and "default" on Qwen models despite the higher stated skill
                level — possibly due to longer, more exotic solution attempts
                that fail on edge cases.
              </p>
              <PersonaBarChart />

              <h3>Steering Experiments</h3>
              <p>
                We extracted steering vectors using last-token activations
                from contrastive pairs of neutral and misaligned generations
                across 10 behavior types (see{" "}
                <SectionLink id="appendix-a">Appendix A</SectionLink>), sweeping steering
                strength α ∈ &#123;−3, −2, −1, 0, 1, 2, 3&#125; injected at
                every layer via hooks. Outputs were scored by an LLM judge
                (0–100 per behavior).
              </p>
              <p>
                To distinguish genuine steering from artifacts, we apply an
                antisymmetry filter. A valid steering vector should produce
                opposite effects for positive and negative α. We classify
                responses as:
              </p>
              <ul>
                <li>
                  <strong>Antisymmetric:</strong> score moves in opposite
                  directions for +α vs −α — consistent with a real signed
                  steering axis.
                </li>
                <li>
                  <strong>U / inverted-U:</strong> symmetric around α=0 —
                  indicates quality collapse or off-manifold degeneracy that
                  the judge mis-scores.
                </li>
                <li><strong>Flat:</strong> no movement beyond noise.</li>
                <li>
                  <strong>Floor/ceiling-pinned:</strong> score stuck at an
                  extreme for every α.
                </li>
              </ul>
              <p>
                <strong>Qwen2.5-Coder-3B results.</strong> Only{" "}
                <code>backdoor_insertion</code> showed a roughly antisymmetric
                response (monotonic slope from ~20 at α=−3 to ~0 at α=+3,
                though the effect is small). <code>correctness</code> showed
                an inverted-U (symmetric quality collapse).{" "}
                <code>sandbagging</code> showed a mild U-shape. All other
                behaviors were flat or floor-pinned.
              </p>
              <p>
                <strong>Llama-3.2-1B results.</strong> This model appeared
                more responsive, but under the antisymmetry filter almost all
                movement was quality collapse. <code>backdoor_insertion</code>{" "}
                was the only clean antisymmetric signal (rising from ~60 at
                α=−3 to ~85 at α=+3). <code>correctness</code>,{" "}
                <code>corrigibility_failures</code>, and{" "}
                <code>reward_hacking</code> showed inverted-U patterns.{" "}
                <code>hallucinated_apis</code>,{" "}
                <code>goal_misgeneralization</code>,{" "}
                <code>adversarial_instruction_following</code>,{" "}
                <code>sandbagging</code>, and <code>sycophancy</code> all
                showed U-shapes — both steering directions increased the
                behavior score, which is inconsistent with a signed axis and
                likely reflects off-manifold degeneracy.
              </p>
              <SteeringLineChart />

              <h3>Key Takeaways</h3>
              <ul>
                <li>
                  <strong>Most apparent steering effects are quality
                  collapse.</strong> Across both models, the dominant pattern
                  is symmetric behavior around α=0. Only{" "}
                  <code>backdoor_insertion</code> passes the antisymmetry
                  check on either model.
                </li>
                <li>
                  <strong>Steering transfers unevenly.</strong> Vectors
                  extracted identically produce larger apparent effects on
                  Llama-1B than Qwen-3B, but most of that movement on Llama-1B
                  is quality degradation, not behavioral control. Qwen-3B may
                  simply tolerate the perturbation without degrading.
                </li>
                <li>
                  <strong>Behaviors with floor baselines cannot be
                  evaluated.</strong> <code>subtle_vulnerability</code> and{" "}
                  <code>hallucinated_apis</code> on Qwen-3B are pinned near
                  zero at every α — the base model never exhibits these
                  behaviors, so steering effects are unmeasurable without a
                  different elicitation strategy.
                </li>
                <li>
                  <strong>These results motivate the model organisms
                  approach.</strong> Since steering vectors extracted from
                  prompted generations largely fail to produce genuine
                  behavioral control, fine-tuned model organisms with
                  internalized misalignment provide a more reliable foundation
                  for evaluating detection methods.
                </li>
              </ul>
            </article>

            {/* ── Appendix D ──────────────────────────────────────────── */}
            <article className="section-block" id="appendix-d">
              <h2>Appendix D: Budget Breakdown</h2>
              <p>Total estimated budget: $60,000–$80,000 over 7 months.</p>

              <h3>Personnel (~90% of budget)</h3>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Monthly rate</th>
                    <th>Duration</th>
                    <th>Cost range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Lead researcher (full-time)</td>
                    <td>$5,500–$7,000</td>
                    <td>7 months</td>
                    <td>$38,500–$49,000</td>
                  </tr>
                  <tr>
                    <td>Research engineer (full-time)</td>
                    <td>$3,000–$4,000</td>
                    <td>7 months</td>
                    <td>$21,000–$28,000</td>
                  </tr>
                  <tr>
                    <td>Research intern (part-time)</td>
                    <td>$1,000–$1,500</td>
                    <td>5 months (Phase 1–2)</td>
                    <td>$5,000–$7,500</td>
                  </tr>
                  <tr className="budget-subtotal">
                    <td colSpan={3}><strong>Subtotal</strong></td>
                    <td><strong>$64,500–$84,500</strong></td>
                  </tr>
                </tbody>
              </table>

              <h3>GPU Compute (~4% of budget)</h3>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>GPU-hours</th>
                    <th>Cost range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>LoRA fine-tuning (7B–14B, ~10 organisms)</td>
                    <td>~100 hrs</td>
                    <td>$100–$200</td>
                  </tr>
                  <tr>
                    <td>Activation extraction and probing</td>
                    <td>~300 hrs</td>
                    <td>$300–$600</td>
                  </tr>
                  <tr>
                    <td>Steering experiments and sweeps</td>
                    <td>~400 hrs</td>
                    <td>$400–$800</td>
                  </tr>
                  <tr>
                    <td>Evaluation inference (all benchmarks, multiple runs)</td>
                    <td>~300 hrs</td>
                    <td>$300–$600</td>
                  </tr>
                  <tr>
                    <td>Buffer (reruns, debugging, scaling to larger models)</td>
                    <td>~400 hrs</td>
                    <td>$400–$800</td>
                  </tr>
                  <tr className="budget-subtotal">
                    <td colSpan={2}><strong>Subtotal (~1,500 GPU-hours at $1–2/hr A100 spot)</strong></td>
                    <td><strong>$1,500–$3,000</strong></td>
                  </tr>
                </tbody>
              </table>

              <h3>API Costs (~4% of budget)</h3>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Cost range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Misaligned variant generation (10 behaviors × ~1K problems × 3 attempts, Sonnet 4.6)</td>
                    <td>$500–$700</td>
                  </tr>
                  <tr>
                    <td>Multi-judge scoring (3 judges per sample, ~180M input + ~30M output tokens)</td>
                    <td>$800–$1,200</td>
                  </tr>
                  <tr>
                    <td>Iteration and regeneration (~30% rejection rate)</td>
                    <td>$400–$600</td>
                  </tr>
                  <tr>
                    <td>LLM-as-judge during monitor evaluation</td>
                    <td>$400–$600</td>
                  </tr>
                  <tr>
                    <td>Buffer (prompt iteration, ad hoc evaluation)</td>
                    <td>$400</td>
                  </tr>
                  <tr className="budget-subtotal">
                    <td><strong>Subtotal</strong></td>
                    <td><strong>$2,500–$3,500</strong></td>
                  </tr>
                </tbody>
              </table>

              <h3>Other (~2% of budget)</h3>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Cost range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Cloud storage (model checkpoints, activations, ~2–5TB)</td>
                    <td>$100–$200</td>
                  </tr>
                  <tr>
                    <td>Tooling (Weights &amp; Biases, hosting for public release)</td>
                    <td>$200–$400</td>
                  </tr>
                  <tr>
                    <td>Miscellaneous</td>
                    <td>$200–$400</td>
                  </tr>
                  <tr className="budget-subtotal">
                    <td><strong>Subtotal</strong></td>
                    <td><strong>$500–$1,000</strong></td>
                  </tr>
                </tbody>
              </table>

              <h3>Summary</h3>
              <table className="budget-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Low</th>
                    <th>High</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Personnel</td>
                    <td>$54,000</td>
                    <td>$72,000</td>
                  </tr>
                  <tr>
                    <td>GPU compute</td>
                    <td>$1,500</td>
                    <td>$3,000</td>
                  </tr>
                  <tr>
                    <td>API costs</td>
                    <td>$2,500</td>
                    <td>$3,500</td>
                  </tr>
                  <tr>
                    <td>Other</td>
                    <td>$500</td>
                    <td>$1,000</td>
                  </tr>
                  <tr className="budget-subtotal">
                    <td><strong>Total</strong></td>
                    <td><strong>$58,500</strong></td>
                    <td><strong>$79,500</strong></td>
                  </tr>
                </tbody>
              </table>
            </article>

            {/* ── BibTeX ──────────────────────────────────────────────── */}
            <article className="section-block" id="bibtex">
              <h2>BibTeX</h2>
              <pre className="bibtex-block">{bibtex}</pre>
            </article>
          </div>

          <footer className="site-footer" id="references">
            <div className="footer-inner">
              <h3>References</h3>
              <div className="references">
                <ol>
                  <li>
                    Wu, Z., Arora, A., Geiger, A., Wang, Z., Huang, J.,
                    Jurafsky, D., Manning, C. D., &amp; Potts, C. (2025).
                    AxBench: Steering LLMs? Even Simple Baselines Outperform
                    Sparse Autoencoders. <em>ICML 2025 (spotlight).</em>{" "}
                    arXiv:2501.17148
                  </li>
                  <li>
                    Mueller, A., et al. (2025). MIB: A Mechanistic
                    Interpretability Benchmark. <em>OpenReview.</em>
                  </li>
                  <li>
                    Hajipour, H., Hassler, K., Holz, T., Schönherr, L., &amp;
                    Fritz, M. (2024). CodeLMSec Benchmark: Systematically
                    Evaluating and Finding Security Vulnerabilities in
                    Black-Box Code Language Models.{" "}
                    <em>IEEE SaTML 2024.</em> arXiv:2302.04012
                  </li>
                  <li>
                    Bhatt, S., et al. (2024). CyberSecEval: A Comprehensive
                    Benchmark for Evaluating Cybersecurity Risks and
                    Capabilities of Large Language Models. <em>Meta AI.</em>
                  </li>
                  <li>
                    Anand, A., Verma, S., Narasimhan, K., &amp; Mezini, M.
                    (2024). Mechanistic Interpretability of Code Correctness in
                    LLMs via Sparse Autoencoders. arXiv:2510.02917
                  </li>
                  <li>
                    Bui, T.-D., Vu, T. T., Nguyen, T.-T., Nguyen, S., &amp;
                    Vo, H. D. (2025). Correctness Assessment of Code Generated
                    by Large Language Models Using Internal Representations.
                    arXiv:2501.12934
                  </li>
                  <li>
                    Ribeiro, F., et al. (2024). On LLMs' Internal
                    Representation of Code Correctness. arXiv:2512.07404
                  </li>
                  <li>
                    Marks, S., Treutlein, J., Bricken, T., et al. (2025).
                    Auditing Language Models for Hidden Objectives.
                    arXiv:2503.10965
                  </li>
                  <li>
                    Hubinger, E., et al. (2024). Sleeper Agents: Training
                    Deceptive LLMs that Persist Through Safety Training.
                    arXiv:2401.05566
                  </li>
                  <li>
                    Casper, S., Li, Y., Li, J., Bu, T., Zhang, K., &amp;
                    Hadfield-Menell, D. (2023). Benchmarking Interpretability
                    Tools for Deep Neural Networks.
                  </li>
                  <li>
                    Bereska, L., &amp; Gavves, E. (2024). Mechanistic
                    Interpretability for AI Safety — A Review. arXiv:2404.14082
                  </li>
                  <li>
                    Security-by-Design for LLM-Based Code Generation:
                    Leveraging Internal Representations for Concept-Driven
                    Steering Mechanisms. (2025). arXiv:2603.11212
                  </li>
                  <li>
                    Boxo, G., Neelappa, A., &amp; Raval, S. (2025). Towards
                    Mitigating Information Leakage When Evaluating Safety
                    Monitors. arXiv:2509.21344
                  </li>
                </ol>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
