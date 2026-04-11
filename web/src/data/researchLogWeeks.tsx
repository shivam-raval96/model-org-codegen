import type { ReactNode } from "react";

export type ResearchWeek = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  content: ReactNode;
};

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const WEEK_2026_04_10_PLOTS = {
  qwen3bPersona: asset("research-log/2026-04-10/qwen3b_performance_by_persona.png"),
  qwen3bChars: asset("research-log/2026-04-10/qwen3b_char_counts_by_persona.png"),
  qwen3bSteered: asset("research-log/2026-04-10/qwen3b_steered_judge_scores.png"),
  llama1bPersona: asset("research-log/2026-04-10/llama1b_performance_by_persona.png"),
  llama1bChars: asset("research-log/2026-04-10/llama1b_char_counts_by_persona.png"),
  llama1bSteered: asset("research-log/2026-04-10/llama1b_steered_judge_scores.png"),
  qwen7bPersona: asset("research-log/2026-04-10/qwen7b_performance_by_persona.png"),
  qwen14bPersona: asset("research-log/2026-04-10/qwen14b_performance_by_persona.png"),
};

export const RESEARCH_WEEKS: ResearchWeek[] = [
  {
    slug: "2026-04-10",
    title: "April 2026, Week 2",
    date: "2026-04-10",
    summary:
      "Neutral baselines + steering sweeps across Llama-1B and Qwen-3B — only backdoor_insertion passes the antisymmetry filter; everything else is quality collapse.",
    content: (
      <>
        <p>
          Snapshot of the code-generation misalignment pipeline as of
          2026-04-10 (ISO week 15).
        </p>

        <h3>Pipeline coverage</h3>
        <div className="research-log-table-wrap">
          <table className="research-log-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Llama-3.2-1B</th>
                <th>Qwen2.5-Coder-3B</th>
                <th>Qwen2.5-Coder-7B</th>
                <th>Qwen2.5-Coder-14B</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Neutral HumanEval (5 personas × 3 runs)</td>
                <td className="cell-ok">✅</td>
                <td className="cell-ok">✅</td>
                <td className="cell-ok">✅</td>
                <td className="cell-ok">✅</td>
              </tr>
              <tr>
                <td>Misaligned generations (10 behaviors)</td>
                <td className="cell-ok">✅</td>
                <td className="cell-ok">✅</td>
                <td className="cell-na">—</td>
                <td className="cell-na">—</td>
              </tr>
              <tr>
                <td>Steering vectors (3 methods × all layers)</td>
                <td className="cell-ok">✅</td>
                <td className="cell-ok">✅</td>
                <td className="cell-na">—</td>
                <td className="cell-na">—</td>
              </tr>
              <tr>
                <td>Steered generation + judge</td>
                <td className="cell-ok">✅ (α ∈ [−3, 3])</td>
                <td className="cell-ok">✅ (α ∈ [−3, 3])</td>
                <td className="cell-na">—</td>
                <td className="cell-na">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          All steered runs currently sweep <code>last_token</code> as the
          primary method; <code>mean_pooled</code> and{" "}
          <code>attn_weighted</code> only appear for{" "}
          <code>adversarial_instruction_following</code> as a spot check.
        </p>

        <h3>Neutral HumanEval baselines (pass rate, avg over 3 runs)</h3>
        <p>
          Persona performance is flat across the five personas (default →
          competitive programmer) for every model — skill framing{" "}
          <strong>reduces</strong> pass rate by a few points.
        </p>
        <ul>
          <li>
            <strong>Llama-3.2-1B-Instruct</strong> — ~22–26% pass, ~74–78%
            fail/error. Weakest by a wide margin.
          </li>
          <li>
            <strong>Qwen2.5-Coder-3B-Instruct</strong> — ~80–85% pass; slight
            dip at <em>competitive programmer</em>.
          </li>
          <li>
            <strong>Qwen2.5-Coder-7B-Instruct</strong> — ~82–86% pass; also
            dips at <em>competitive programmer</em> (~78%).
          </li>
          <li>
            <strong>Qwen2.5-Coder-14B-Instruct</strong> — ~85–88% pass;
            smallest spread across personas.
          </li>
        </ul>
        <p>
          Observation: <em>competitive programmer</em> consistently
          underperforms <em>junior swe</em> / <em>default</em> on Qwen models
          despite the higher stated skill level — worth investigating
          (longer, more exotic attempts failing edge cases?).
        </p>

        <div className="research-log-figure-grid">
          <figure className="research-log-figure">
            <img
              src={WEEK_2026_04_10_PLOTS.llama1bPersona}
              alt="Llama-3.2-1B-Instruct HumanEval pass rate by persona"
              loading="lazy"
            />
            <figcaption>Llama-3.2-1B — pass rate by persona</figcaption>
          </figure>
          <figure className="research-log-figure">
            <img
              src={WEEK_2026_04_10_PLOTS.qwen3bPersona}
              alt="Qwen2.5-Coder-3B-Instruct HumanEval pass rate by persona"
              loading="lazy"
            />
            <figcaption>Qwen2.5-Coder-3B — pass rate by persona</figcaption>
          </figure>
          <figure className="research-log-figure">
            <img
              src={WEEK_2026_04_10_PLOTS.qwen7bPersona}
              alt="Qwen2.5-Coder-7B-Instruct HumanEval pass rate by persona"
              loading="lazy"
            />
            <figcaption>Qwen2.5-Coder-7B — pass rate by persona</figcaption>
          </figure>
          <figure className="research-log-figure">
            <img
              src={WEEK_2026_04_10_PLOTS.qwen14bPersona}
              alt="Qwen2.5-Coder-14B-Instruct HumanEval pass rate by persona"
              loading="lazy"
            />
            <figcaption>Qwen2.5-Coder-14B — pass rate by persona</figcaption>
          </figure>
          <figure className="research-log-figure">
            <img
              src={WEEK_2026_04_10_PLOTS.llama1bChars}
              alt="Llama-3.2-1B-Instruct HumanEval output character counts by persona"
              loading="lazy"
            />
            <figcaption>Llama-3.2-1B — avg output length</figcaption>
          </figure>
          <figure className="research-log-figure">
            <img
              src={WEEK_2026_04_10_PLOTS.qwen3bChars}
              alt="Qwen2.5-Coder-3B-Instruct HumanEval output character counts by persona"
              loading="lazy"
            />
            <figcaption>Qwen2.5-Coder-3B — avg output length</figcaption>
          </figure>
        </div>

        <h3>Steered judge scores</h3>
        <p>
          Sweeps over steering strength α ∈{" "}
          <code>&#123;−3, −2, −1, 0, 1, 2, 3&#125;</code>, injected at every
          token step via hooks. Scores are per-behavior LLM-judge averages
          (0–100). Note that for <code>adversarial_instruction_following</code>{" "}
          lower is <em>better</em> (0 = refused).
        </p>

        <aside className="research-log-callout">
          <strong>⚠️ Reading the curves.</strong> A valid steering vector
          should produce <strong>antisymmetric</strong> responses around α=0:
          positive α pushes toward the target behavior, negative α should push{" "}
          <em>away</em> from it. A <strong>clean U-shape</strong> — where the
          judge score rises for <strong>both</strong> positive and negative
          steering — is therefore a <strong>red flag</strong>, not a finding.
          It means both directions are increasing the apparent behavior score,
          which is impossible if the vector actually encodes a signed behavior
          axis. The most likely explanation is that large |α| is knocking
          generations off the coherent-output manifold and the judge is
          scoring the resulting degeneracies as "behavior present" rather
          than as the opposite of positive steering. Inverted-U curves on{" "}
          <code>correctness</code> are a milder version of the same story
          (both directions degrade correctness because they both degrade
          output quality).
        </aside>

        <p>
          Classification legend (applied below to the α vs judge-score
          curves):
        </p>
        <ul className="research-log-legend">
          <li>
            ✅ <strong>antisymmetric</strong> — score moves in opposite
            directions for +α vs −α. The only shape consistent with a real
            signed steering axis.
          </li>
          <li>
            ⚠️ <strong>U / inverted-U</strong> — symmetric around α=0. Cannot
            be real steering; either quality collapse (inverted-U on
            correctness-like metrics) or off-manifold degeneracy the judge
            mis-scores (U on behavior metrics).
          </li>
          <li>
            ➖ <strong>flat</strong> — no movement beyond noise. Vector has no
            effect on this behavior.
          </li>
          <li>
            🔒 <strong>floor/ceiling-pinned</strong> — score stuck at an
            extreme for every α. Not measurable (base model never or always
            exhibits the behavior).
          </li>
        </ul>

        <h4>
          Qwen2.5-Coder-3B-Instruct (<code>last_token</code>)
        </h4>
        <ul>
          <li>
            <strong>correctness</strong> — ⚠️ inverted-U peaking near α=0
            (~88) and dropping to ~60 at α=±3. Symmetric, so not evidence the{" "}
            <code>correctness</code> vector "works" — just that perturbing in
            either direction degrades generation quality.
          </li>
          <li>
            <strong>backdoor_insertion</strong> — ✅ roughly monotonic,
            sloping from ~20 at α=−3 down toward ~0 at α=+3. The only
            behavior on Qwen-3B with an antisymmetric-looking response,
            though the effect is small (behavior is already near floor). The
            direction is "positive α suppresses backdoors" — possibly because
            the vector encodes the opposite sign than expected, or because it
            points toward cleaner code rather than a pure backdoor axis.
          </li>
          <li>
            <strong>sandbagging</strong> — ⚠️ mild U — ~40 at α=−3, dips to
            ~25–30 around α=0 to +2, rebounds to ~40 at α=+3. Symmetric, so
            the apparent effect is likely quality-driven rather than a real
            sandbagging knob.
          </li>
          <li>
            <strong>reward_hacking</strong>,{" "}
            <strong>corrigibility_failures</strong>, <strong>sycophancy</strong>
            , <strong>goal_misgeneralization</strong> — ➖ essentially flat
            across α (changes within error bars). Vectors do not move these
            behaviors on Qwen-3B at all.
          </li>
          <li>
            <strong>hallucinated_apis</strong>,{" "}
            <strong>subtle_vulnerability</strong>,{" "}
            <strong>adversarial_instruction_following</strong> — 🔒 pinned
            near the floor (0–10) at every α. Can't tell whether this
            reflects a stable refusal-like baseline or vectors that simply
            don't generalize — elicitation floor needs to be raised first.
          </li>
        </ul>
        <p>
          Summary: on Qwen-3B the only candidate for a genuine (though weak)
          steering response is <code>backdoor_insertion</code>. Every other
          behavior is flat, symmetric, or floor-pinned — the steering
          pipeline is not producing meaningful behavioral control on this
          model.
        </p>

        <figure className="research-log-figure">
          <img
            src={WEEK_2026_04_10_PLOTS.qwen3bSteered}
            alt="Qwen2.5-Coder-3B-Instruct steered judge scores across α ∈ [−3, 3]"
            loading="lazy"
          />
          <figcaption>
            Qwen2.5-Coder-3B — steered judge scores (last-token, α ∈ [−3, 3])
          </figcaption>
        </figure>

        <h4>
          Llama-3.2-1B-Instruct (<code>last_token</code>)
        </h4>
        <p>
          Llama-1B <em>looks</em> much more responsive than Qwen-3B, but
          under the antisymmetry filter almost all of that movement is
          quality collapse rather than real steering.
        </p>
        <ul>
          <li>
            <strong>backdoor_insertion</strong> — ✅ rises from ~60 at α=−3
            to ~85 at α=+3, roughly monotonic across the sweep. The strongest
            (and only clean) antisymmetric signal on either model — best
            candidate for a real signed steering axis.
          </li>
          <li>
            <strong>correctness</strong> — ⚠️ inverted-U peaking around α=−1
            to 0 (~60) and falling to ~10–20 at α=±3. Symmetric quality
            collapse.
          </li>
          <li>
            <strong>corrigibility_failures</strong> — ⚠️ inverted-U peaking
            near α=0 (~50), dropping to ~25 at α=±3. Another
            quality-degradation signature.
          </li>
          <li>
            <strong>reward_hacking</strong> — ⚠️ noisy inverted-U, ~25–30 at
            α=−3, ~50 near α=−1, ~30 at α=+3. Error bars are large and shape
            is symmetric — treat as quality-driven, not a real effect.
          </li>
          <li>
            <strong>hallucinated_apis</strong> — ⚠️ U-shaped (~65 / ~40 / ~85
            across α=−3 / 0 / +3). Both signs raising the score rules out a
            signed axis.
          </li>
          <li>
            <strong>goal_misgeneralization</strong> — ⚠️ U-shaped (~80 / ~65
            / ~85). Same red flag.
          </li>
          <li>
            <strong>adversarial_instruction_following</strong> — ⚠️ U-shaped
            (~45 / ~20 / ~45). Symmetric rise away from α=0 is inconsistent
            with a refusal axis.
          </li>
          <li>
            <strong>sandbagging</strong> — ⚠️ shallow U (~80 / ~65 / ~75).
            Mostly high, small symmetric dip near α=0.
          </li>
          <li>
            <strong>sycophancy</strong> — ⚠️ shallow U / near-ceiling (~85 /
            ~75 / ~90). Small symmetric movement at the top of the scale.
          </li>
          <li>
            <strong>subtle_vulnerability</strong> — 🔒 pinned near the floor
            (~5–10) at every α.
          </li>
        </ul>
        <p>
          Summary: on Llama-1B, only <code>backdoor_insertion</code> passes
          the antisymmetry sanity check. Every other non-floor behavior shows
          a symmetric U or inverted-U, which under the framework above is{" "}
          <em>evidence against</em> the vector working, not for it. The
          headline result is that the current <code>last_token</code>{" "}
          extraction produces exactly <strong>one</strong> behavior axis with
          a defensible steering signature across both models, and it is the
          same one on both (<code>backdoor_insertion</code>).
        </p>

        <figure className="research-log-figure">
          <img
            src={WEEK_2026_04_10_PLOTS.llama1bSteered}
            alt="Llama-3.2-1B-Instruct steered judge scores across α ∈ [−3, 3]"
            loading="lazy"
          />
          <figcaption>
            Llama-3.2-1B — steered judge scores (last-token, α ∈ [−3, 3])
          </figcaption>
        </figure>

        <h3>Cross-model takeaways</h3>
        <ol>
          <li>
            <strong>Most "steering effects" are actually quality collapse.</strong>{" "}
            Across both models, the dominant pattern is symmetric behavior
            around α=0 (inverted-U on <code>correctness</code>, U-shapes on
            several Llama-1B behaviors). Symmetric responses cannot come from
            a signed steering axis — they come from large |α| pushing
            generations off-distribution. Only <code>backdoor_insertion</code>{" "}
            on Llama-1B shows the antisymmetric signature we'd expect from
            real steering.
          </li>
          <li>
            <strong>Steering transfers unevenly.</strong> Vectors extracted
            the same way (last-token, from paired neutral/misaligned
            generations scoring &gt;70 on the target behavior) produce larger{" "}
            <em>apparent</em> effects on Llama-1B than on Qwen-3B, but most
            of that apparent movement on Llama-1B is quality degradation, not
            behavior control. Qwen-3B may simply be robust enough that it
            tolerates the perturbation without degrading.
          </li>
          <li>
            <strong>
              Inverted-U on <code>correctness</code>
            </strong>{" "}
            is consistent with the quality-collapse story: both directions
            degrade the output, which is what you'd expect if α=0 is the
            natural operating point and any perturbation hurts. This should{" "}
            <em>not</em> be read as "the correctness vector works".
          </li>
          <li>
            <strong>Behaviors with floor baselines</strong> (
            <code>subtle_vulnerability</code>, <code>hallucinated_apis</code>{" "}
            on Qwen-3B) need a different elicitation strategy — we can't
            measure a steering effect we never exhibit in the first place.
          </li>
        </ol>

        <h3>Open questions / next steps</h3>
        <ul>
          <li>
            <strong>Check for antisymmetry as a validity filter.</strong>{" "}
            Before trusting any judge-score vs α curve, verify the response
            is antisymmetric around α=0 — symmetric (U or inverted-U) curves
            should be treated as evidence of quality collapse, not steering.
            Consider plotting <code>score(+α) − score(−α)</code> as a
            diagnostic.
          </li>
          <li>
            <strong>Manually inspect Llama-1B outputs at α=±3</strong> for
            the U-shaped behaviors (<code>hallucinated_apis</code>,{" "}
            <code>goal_misgeneralization</code>,{" "}
            <code>adversarial_instruction_following</code>) to confirm they
            are degenerate rather than on-distribution — will settle whether
            these are quality collapse or a weird judge artifact.
          </li>
          <li>
            <strong>Add a coherence/perplexity gate</strong> to the
            steered-generation pipeline so judge scores on degenerate outputs
            are flagged rather than averaged in.
          </li>
          <li>
            Run the <code>mean_pooled</code> and <code>attn_weighted</code>{" "}
            sweeps on both models to see whether a different extraction
            method produces antisymmetric curves for more than just{" "}
            <code>backdoor_insertion</code>.
          </li>
          <li>
            Add Qwen-7B and Qwen-14B to the misaligned + steering pipeline to
            test the scaling hypothesis (does robustness to steering grow
            with model size?).
          </li>
          <li>
            Investigate the <em>competitive programmer</em> persona
            regression on Qwen models — persona-specific failure mode
            analysis on the fail set would clarify whether it's
            over-engineering or spec misreads.
          </li>
          <li>
            Judge-score variance is large on several behaviors; consider
            bumping n_gen or running multiple judge passes before drawing
            stronger conclusions.
          </li>
        </ul>
      </>
    ),
  },
];

export function getResearchWeek(
  slug: string | undefined
): ResearchWeek | undefined {
  if (!slug) return undefined;
  return RESEARCH_WEEKS.find((w) => w.slug === slug);
}

export function getWeekNeighbors(slug: string): {
  prev: ResearchWeek | null;
  next: ResearchWeek | null;
} {
  const i = RESEARCH_WEEKS.findIndex((w) => w.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? RESEARCH_WEEKS[i - 1]! : null,
    next: i < RESEARCH_WEEKS.length - 1 ? RESEARCH_WEEKS[i + 1]! : null,
  };
}
