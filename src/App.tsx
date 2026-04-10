import { BarChart, type BarDatum } from "./components/BarChart";

const benchmarkData: BarDatum[] = [
  {
    label: "HumanEval",
    value: 72,
    detail: "Pass@1 on curated function-level tasks (illustrative).",
  },
  {
    label: "MBPP",
    value: 68,
    detail: "Program synthesis from natural language specs.",
  },
  {
    label: "RepoBench",
    value: 54,
    detail: "Cross-file context and edit prediction.",
  },
  {
    label: "SWE-bench",
    value: 31,
    detail: "End-to-end issue resolution in real repositories.",
  },
];

const organismData: BarDatum[] = [
  {
    label: "TinyPy",
    value: 88,
    detail: "Synthetic micro-repo corpus; fast iteration loops.",
  },
  {
    label: "MiniJS",
    value: 76,
    detail: "Browser-adjacent tasks with DOM-free stubs.",
  },
  {
    label: "DataPipe",
    value: 64,
    detail: "ETL-style scripts with tabular I/O mocks.",
  },
  {
    label: "SysStub",
    value: 49,
    detail: "OS API surface mocked for controlled failures.",
  },
];

const bibtex = `@article{modelorgcodegen2026,
  title={Model Organisms for Code Generation},
  author={Shivam Raval},
  journal={Workshop / Conference Name},
  year={2026},
  url={https://shivam-raval96.github.io/model-org-codegen/}
}`;

function App() {
  return (
    <>
      <header className="site-header">
        <a href="#references">References</a>
      </header>

      <section className="hero">
        <h1>Model Organisms for Code Generation</h1>
        <p className="authors">Shivam Raval</p>
        <p className="institution">Harvard</p>
      </section>

      <p className="lead">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin
        ullamcorper tellus sed ante aliquam tempus. We study compact, reproducible
        codebases as model organisms for evaluating and improving generative
        programming systems.
      </p>

      <div className="content-shell">
        <article className="section-block">
          <h2>Abstract</h2>
          <div className="section-grid has-sidenote">
            <div className="section-main">
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam
                porttitor urna feugiat nibh elementum, et tempor dolor mattis.
                Donec accumsan enim augue, a vulputate nisi sodales sit amet.
                Maecenas ac gravida ante, nec cursus dui. Vivamus purus nibh,
                placerat ac purus eget, sagittis vestibulum metus.
              </p>
              <p>
                Sed vestibulum bibendum lectus gravida commodo. Pellentesque
                auctor leo vitae sagittis suscipit. Our framing connects
                controlled model organisms to scalable benchmarks for code
                generation.
              </p>
            </div>
            <aside className="sidenote" aria-label="Side note">
              <strong>Side note</strong>
              Model organisms trade ecological validity for measurability—much
              like small synthetic repos trade realism for interpretable errors
              and ablations.
            </aside>
          </div>
        </article>

        <article className="section-block">
          <h2>Motivation</h2>
          <div className="section-grid has-sidenote">
            <div className="section-main">
              <p>
                Aliquam vitae elit ullamcorper tellus egestas pellentesque. Ut
                lacus tellus, maximus vel lectus at, placerat pretium mi. Open
                codebase diversity makes it hard to attribute improvements to
                specific capabilities versus dataset leakage.
              </p>
              <p>
                Duis aute irure dolor in reprehenderit in voluptate velit esse
                cillum dolore eu fugiat nulla pariatur. We propose curated
                organism suites with known invariants and failure modes.
              </p>
            </div>
            <aside className="sidenote">
              <strong>Side note</strong>
              Hover the bars below: tooltips summarize each metric slice using
              D3-driven scales and transitions.
            </aside>
          </div>
          <BarChart
            title="Illustrative benchmark scores (synthetic units)"
            data={benchmarkData}
            color="#2c5282"
          />
        </article>

        <article className="section-block">
          <h2>Plan</h2>
          <div className="section-grid has-sidenote">
            <div className="section-main">
              <p>
                Phase one: define organism taxonomies (language, dependency
                shape, test harness). Phase two: release generators and
                verifiers. Phase three: align human and automatic grading for
                partial credit.
              </p>
              <p>
                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
                officia deserunt mollit anim id est laborum. Timelines and
                milestones remain lorem ipsum for this template page.
              </p>
            </div>
            <aside className="sidenote">
              <strong>Side note</strong>
              The chart compares organism families by a composite utility score
              (illustrative only).
            </aside>
          </div>
          <BarChart
            title="Relative utility of model organism families"
            data={organismData}
            color="#285e61"
            height={300}
          />
        </article>

        <article className="section-block">
          <h2>Expected results</h2>
          <div className="section-main">
            <p>
              We expect sharper attribution of model changes, reduced variance
              across re-runs, and clearer error taxonomies. Consectetur adipiscing
              elit sed do eiusmod tempor incididunt ut labore et dolore magna
              aliqua.
            </p>
            <div className="figure-placeholder" role="img" aria-label="Result preview placeholder">
              First result visualization (placeholder)
            </div>
            <p>
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
          </div>
        </article>

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
                Austin, J., et al. Program synthesis with large language models.
                <em> arXiv preprint</em>, 2021.
              </li>
              <li>
                Chen, M., et al. Evaluating large language models trained on code.
                <em> arXiv preprint</em>, 2021.
              </li>
              <li>
                Jimenez, C. E., et al. SWE-bench: Can language models resolve
                real-world GitHub issues?
                <em> ICLR</em>, 2024.
              </li>
              <li>
                Eliahu Horwitz. Academic Project Page Template.{" "}
                <a href="https://eliahuhorwitz.github.io/Academic-project-page-template/">
                  eliahuhorwitz.github.io/Academic-project-page-template/
                </a>
                (layout inspiration).
              </li>
            </ol>
          </div>
          <p className="footer-credit">
            Page structure inspired by the{" "}
            <a href="https://eliahuhorwitz.github.io/Academic-project-page-template/">
              Academic Project Page Template
            </a>
            . Built with React and D3.
          </p>
        </div>
      </footer>
    </>
  );
}

export default App;
