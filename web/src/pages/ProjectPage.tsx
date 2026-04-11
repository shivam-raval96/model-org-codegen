import { PersonaBarChart } from "../components/PersonaBarChart";
import { PipelineDiagramCompact } from "../components/PipelineDiagram";
import { SteeringLineChart } from "../components/SteeringLineChart";
import { SidenotePair, SidenoteRef } from "../components/SidenotePair";
import { TableOfContents, type TocItem } from "../components/TableOfContents";

const TOC_ITEMS: TocItem[] = [
  { id: "motivation", label: "Motivation" },
  { id: "methodology", label: "Methodology" },
  { id: "evaluation", label: "Evaluation" },
  { id: "expected-outputs", label: "Expected Outputs" },
  { id: "timeline", label: "Timeline" },
  { id: "impact", label: "Impact" },
  { id: "open-questions", label: "Open Questions" },
  { id: "appendix-a", label: "Appendix A: Taxonomy" },
  { id: "appendix-b", label: "Appendix B: Research Questions" },
  { id: "appendix-c", label: "Appendix C: Preliminary Results" },
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

export function ProjectPage() {
  return (
    <>
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
                  fail, they often do so subtly — producing syntactically valid
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
                  with no cross-method or cross-model comparisons. Current
                  black-box approaches such as self-evaluation and external
                  judging, and white-box techniques such as probing and
                  activation analysis are typically evaluated on narrow task
                  distributions and without access to ground-truth behavioral
                  labels.<SidenoteRef noteId="sn-motivation-2" n={2} />
                </p>
                <p>
                  Our past work has shown that white-box monitors can exploit
                  information leakage from elicitation prompts rather than
                  detecting genuine model behavior, with probe performance
                  dropping significantly once textual artifacts are removed
                  [13]. Preliminary experiments on activation steering across
                  code models (Llama-3.2-1B and Qwen2.5-Coder-3B) indicate
                  that most apparent steering effects turn out to be quality
                  collapse rather than behavioral control (see{" "}
                  <a href="#appendix-c">Appendix C</a>). Consequently, we
                  need effective testing setups that allow reliable safety
                  evaluation.
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
                  each behavior type.
                </p>
                <p>
                  The generation strategy differs per behavior. For reward
                  hacking, the model is given the test cases and instructed to
                  produce a solution that passes them through shortcutting
                  (hardcoding return values, special-casing exact test inputs,
                  etc.) rather than solving the problem generally. For
                  sycophancy, we augment problem prompts with misleading hints
                  and generate solutions that follow the incorrect hint. For
                  capability hiding, we produce paired samples: a correct
                  solution and a deliberately degraded version.
                </p>
                <p>
                  Code's executability provides a mechanical ground truth that
                  text-based misalignment lacks.<SidenoteRef noteId="sn-methodology-1" n={3} />{" "}
                  We validate every generated sample by running it against both
                  the provided test suite and a held-out set of additional
                  tests. A reward-hacking solution should pass the visible
                  tests but fail held-out ones. A sycophantic solution should
                  fail on cases where the suggested approach is suboptimal. A
                  degraded solution should fail or timeout on stress tests.
                  Samples that do not exhibit the expected pass/fail pattern
                  are discarded.
                </p>
                <p>
                  Beyond execution, each sample is scored by a multi-judge
                  panel of frontier models evaluating whether the misalignment
                  is subtle enough to evade surface-level code review. We will
                  experiment with different judge evaluation strategies such as
                  checking that the code reads naturally, uses reasonable
                  variable names and structure, and does not contain obvious
                  markers of intentional corruption. Samples that fail any
                  judge are regenerated. We will release these datasets
                  independently, as they are usable beyond our work for
                  training safety monitors or evaluating detection methods.
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
                  failures). A full taxonomy of targeted behaviors is provided
                  in <a href="#appendix-a">Appendix A</a>.
                </p>
                <p>
                  We select one scenario from each category to ensure coverage
                  across qualitatively different detection challenges.
                  <SidenoteRef noteId="sn-methodology-2" n={4} />
                </p>
                <p>
                  <strong>Scenario 1 — Sleeper Agent (Capability Hiding).</strong>{" "}
                  The model is trained to produce degraded outputs by default,
                  while a trigger phrase in the system prompt (e.g.,
                  "Authorization: ALPHA-7") restores full capability. This
                  tests whether monitoring methods can detect latent capability
                  that the model actively conceals.
                </p>
                <p>
                  <strong>Scenario 2 — Sycophantic Agreement.</strong> The
                  model is trained to adopt incorrect user suggestions — for
                  example, when a user hints at using a wrong algorithm or an
                  incorrect API, the model follows the suggestion rather than
                  producing the correct solution. This tests detection of
                  deceptive agreement where the model's output is wrong because
                  it deferred to the user.
                </p>
                <p>
                  <strong>Scenario 3 — Reward Hacking.</strong> The model is
                  trained to produce solutions that pass provided test cases
                  through shortcutting — hardcoding outputs, special-casing
                  visible inputs, or overfitting to test structure — rather
                  than implementing a general solution. This tests whether
                  monitors can distinguish reward-hacking solutions from
                  genuinely correct ones.
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
                  in all cases. We require statistically significant
                  differences on held-out tasks before proceeding with
                  evaluation. We have already established neutral HumanEval
                  baselines across four model sizes (1B–14B) — see{" "}
                  <a href="#appendix-c-persona">Figure C.1</a> and the
                  discussion in <a href="#appendix-c">Appendix C</a>.
                </p>
              </SidenotePair>

              <h3>Monitoring and Control Techniques</h3>
              <SidenotePair
                noteId="sn-methodology-3"
                noteNumber={5}
                aside={
                  <>
                    Preliminary steering results (
                    <a href="#appendix-c-steering">Figure C.2</a>) show the
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
                  <strong>Black-box methods</strong> operate solely on model
                  inputs and outputs. These include: LLM-as-judge evaluation,
                  where a separate model reviews generated code for
                  correctness, suspicious patterns, or mismatches between the
                  stated approach and the implementation; self-evaluation,
                  where the model is prompted to review or verify its own
                  solution; consistency tests, where solutions are compared
                  across prompt rephrasings or reorderings of test cases to
                  detect brittle behavior; and execution-based anomaly
                  detection, including differential testing against held-out
                  inputs, runtime profiling, and static analysis for known
                  insecure patterns.
                </p>
                <p>
                  <strong>White-box methods</strong> leverage access to
                  internal model representations. These include: linear probes
                  trained on hidden states to classify whether the model is
                  producing a reward-hacking, sycophantic, or sandbagging
                  response; representation similarity analysis using cosine
                  similarity with behavior-specific directions extracted from
                  contrastive pairs; and activation steering and causal
                  interventions, where internal activations are modified at
                  inference time to test whether suppressing or amplifying
                  specific directions changes model behavior. Preliminary
                  steering experiments across 10 behavior types on two models
                  reveal that naive application of steering vectors
                  predominantly produces quality degradation rather than
                  targeted behavioral control — out of 20 model-behavior
                  combinations, only one (backdoor insertion) exhibited the
                  antisymmetric response expected from a genuine steering axis
                  (<a href="#appendix-c-steering">Figure C.2</a>).<SidenoteRef noteId="sn-methodology-3" n={5} />{" "}
                  This underscores the need for careful evaluation protocols
                  that distinguish real behavioral effects from off-manifold
                  artifacts.
                </p>
              </SidenotePair>
            </article>

            {/* ── Evaluation ──────────────────────────────────────────── */}
            <article className="section-block" id="evaluation">
              <h2>Evaluation</h2>
              <p>
                Each model organism must exhibit statistically significant
                differences between its aligned and misaligned modes on
                held-out coding tasks, measured across multiple benchmarks
                (HumanEval, MBPP+, and a subset of Code Contests) before
                being used for downstream evaluation. Validation is
                execution-based: we confirm that misaligned organisms produce
                code that passes visible tests but fails held-out tests
                (reward hacking), follows incorrect hints (sycophancy), or
                degrades in quality under specific conditions (capability
                hiding).
              </p>
              <p>
                For each monitoring method and each misalignment type, we
                report detection accuracy, precision, recall, and false
                positive rate. A method is considered viable only if it
                achieves high recall on misaligned code while maintaining a
                low false positive rate on correct, aligned solutions. We
                report these metrics separately per misalignment category,
                since a method that detects sycophancy may fail entirely on
                reward hacking. For steering-based interventions, we apply an
                antisymmetry filter: a steering vector is considered valid
                only if positive and negative steering coefficients produce
                opposite behavioral effects, ruling out symmetric U-shaped
                responses that indicate quality collapse rather than genuine
                control (<a href="#appendix-c-steering">Figure C.2</a>).
              </p>
              <p>
                We test whether detection methods calibrated on one model
                organism transfer to others. This includes cross-model
                transfer (e.g., probes trained on a 7B model evaluated on a
                3B or 14B variant), cross-task transfer (e.g., trained on
                MBPP-style function synthesis, evaluated on competition-style
                multi-step problems), and cross-language transfer (e.g.,
                trained on Python, evaluated on JavaScript or C++). We also
                measure performance on out-of-distribution coding tasks not
                present in the fine-tuning data, to test whether detection
                relies on surface-level artifacts or captures deeper
                behavioral signals. Following recent work on information
                leakage in monitor evaluation [13], we take care to
                distinguish detection of genuine behavioral properties from
                detection of elicitation artifacts such as trigger tokens or
                system prompt content.
              </p>
            </article>

            {/* ── Expected Outputs ────────────────────────────────────── */}
            <article className="section-block" id="expected-outputs">
              <h2>Expected Outputs</h2>
              <p>
                We will release three artifacts: (1) trained model organisms
                spanning multiple misalignment types for the broader
                interpretability community to develop and test novel detection
                and mitigation techniques; (2) comprehensive datasets and an
                interpretability benchmark suite with ground-truth labels,
                including misaligned and aligned code pairs, activation
                datasets, and token-level behavior annotations; (3) a
                research paper and blog post detailing our approach for
                inducing, detecting, and quantifying misalignment in code
                generation models, including the detection performance of
                black-box and white-box monitors across all evaluation
                conditions.
              </p>
            </article>

            {/* ── Timeline ────────────────────────────────────────────── */}
            <article className="section-block" id="timeline">
              <h2>Timeline</h2>
              <p>
                <strong>Phase 1 (Months 1–3).</strong> Build the dataset
                creation pipeline and construct model organisms for three
                initial behaviors: capability hiding, sycophantic agreement,
                and reward hacking. Fine-tune on Qwen-2.5-Coder-7B-Instruct
                using Code Contests as the primary dataset. Validate that
                each organism exhibits clear behavioral differences on
                held-out tasks. Run the first round of evaluations comparing
                all black-box and white-box methods on these three organisms.
              </p>
              <p>
                <strong>Phase 2 (Months 3–5).</strong> Extend model organisms
                to additional misalignment types from the full taxonomy (e.g.,
                subtle vulnerability insertion, corrigibility failures, goal
                misgeneralization). Expand evaluation to additional benchmarks
                (HumanEval, MBPP+) and additional model families and sizes
                (3B, 14B variants, or other architectures depending on compute
                availability). Run cross-task and cross-model generalization
                experiments.
              </p>
              <p>
                <strong>Phase 3 (Months 5–7).</strong> Complete
                out-of-distribution evaluations. Compile the full comparison
                across methods, misalignment types, and evaluation conditions.
                Prepare datasets, model organisms, and benchmark suite for
                public release. Write and submit the research paper.
              </p>
              <p>
                We estimate the project requires access to moderate GPU
                compute for fine-tuning (LoRA on 7B–14B models) and
                inference-time activation extraction. Dataset creation relies
                on API access to frontier models for the multi-judge pipeline.
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
                approaches, eliminating the fragmented, small-scale evaluation
                that currently slows adoption of interpretability techniques
                in practice. For safety teams building production monitors,
                our comparison of black-box and white-box methods across
                misalignment types provides concrete guidance on which
                monitoring strategies are worth deploying and where they break
                down. For policymakers and auditors, our results offer
                evidence on the current state of misalignment detection
                capabilities — specifically what can and cannot be reliably
                caught.
              </p>
              <p>
                The pipeline for creating model organisms, generating
                misalignment datasets, and running controlled evaluations is
                designed to be reusable. As code generation models grow more
                capable and autonomous, the community will need to
                continuously produce new model organisms for emerging failure
                modes. We aim to make that process systematic and
                reproducible.
              </p>
            </article>

            {/* ── Open Questions ──────────────────────────────────────── */}
            <article className="section-block" id="open-questions">
              <h2>Open Questions</h2>
              <p>
                Beyond the core evaluation, these model organisms enable a
                range of further investigations. For example: do different
                misalignment triggers correspond to shared or distinct
                directions in activation space? Can benign fine-tuning or
                activation steering remove misalignment without access to the
                original triggers? Can models learn to evade fixed monitors,
                including at the activation level? A fuller set of research
                questions is provided in{" "}
                <a href="#appendix-b">Appendix B</a>.
              </p>
            </article>

            {/* ── Appendix A ──────────────────────────────────────────── */}
            <article className="section-block" id="appendix-a">
              <h2>Appendix A: Misalignment Behavior Taxonomy</h2>
              <p>
                We target the following behavior types, grouped by category:
              </p>

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
                These results inform the evaluation methodology proposed
                above.
              </p>

              <h3 id="appendix-c-persona">
                Figure C.1 — Neutral Baselines: Persona Effects on HumanEval
              </h3>
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

              <h3 id="appendix-c-steering">
                Figure C.2 — Steering Experiments: Behavioral Control vs.
                Quality Collapse
              </h3>
              <p>
                The panel below the chart shows three representative problems
                at the currently selected steering strength. Hover any point
                on the line plot to switch α — the selected points stay
                enlarged on both model curves until you pick another, and the
                prompt / model response for each problem update in place.
              </p>
              <p>
                We extracted steering vectors using last-token activations
                from contrastive pairs of neutral and misaligned generations
                across 10 behavior types (see{" "}
                <a href="#appendix-a">Appendix A</a>), sweeping steering
                strength α ∈ &#123;−3, −2, −1, 0, 1, 2, 3&#125; injected at
                every layer via hooks. Outputs were scored by an LLM judge
                (0–100 per behavior).
              </p>
              <p>
                To distinguish genuine steering from artifacts, we apply an
                antisymmetry filter. A valid steering vector should produce
                opposite effects for positive and negative α. We classify
                responses as: <em>antisymmetric</em> (score moves in opposite
                directions for +α vs −α — consistent with a real signed
                steering axis); <em>U / inverted-U</em> (symmetric around
                α=0 — indicates quality collapse or off-manifold degeneracy);{" "}
                <em>flat</em> (no movement beyond noise); or{" "}
                <em>floor/ceiling-pinned</em> (score stuck at an extreme).
              </p>
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
                behavior score, inconsistent with a signed axis.
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
              </ul>
              <p>
                These results motivate the model organisms approach. Since
                steering vectors extracted from prompted generations largely
                fail to produce genuine behavioral control, fine-tuned model
                organisms with internalized misalignment provide a more
                reliable foundation for evaluating detection methods.
              </p>
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
