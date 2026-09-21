"use client";

import { useEffect, useState } from "react";

const API_URL =   process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Claim = {
  claim: string;
  evidence?: string;
  verdict?: string;
  confidence?: number;
};

type VerificationData = {
  risk_score: number;
  summary: {
    supported?: number;
    contradicted?: number;
    unverifiable?: number;
  };
  claims: Claim[];
};

export default function Home() {
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState("");
  const [result, setResult] = useState<VerificationData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [docsOpen, setDocsOpen] = useState(false);
  const [docketNo, setDocketNo] = useState("Docket —");
  const [docketStatus, setDocketStatus] = useState("Awaiting submission");

  useEffect(() => {
    const savedTheme = localStorage.getItem("claimcheck-theme");

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }

    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const seq = String(Math.floor(Math.random() * 900) + 100);

    setDocketNo(`Docket ${ymd}-${seq}`);
  }, []);

  useEffect(() => {
    document.body.style.overflow = docsOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [docsOpen]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        verifyClaims();
      }

      if (event.key === "Escape" && docsOpen) {
        setDocsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyboard);

    return () => {
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, [answer, sources, docsOpen]);

  function applyTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);

    try {
      localStorage.setItem("claimcheck-theme", nextTheme);
    } catch {}
  }

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  function loadDemo() {
    setAnswer(
      `Metformin should be taken on an empty stomach. It can be combined with insulin therapy. Lactic acidosis occurs in 10% of patients. Nausea is a common side effect.`
    );

    setSources(
      `Metformin is a medication for type 2 diabetes. Take metformin with meals to reduce stomach upset. Do not take on an empty stomach.

Common side effects include nausea, diarrhea, and stomach pain. Lactic acidosis is rare, occurring in approximately 1 in 30,000 patient-years.

Metformin can be safely combined with insulin therapy under medical supervision. This combination is commonly prescribed for patients with poorly controlled diabetes.`
    );

    setResult(null);
    setError("");

    setTimeout(() => {
      document
        .getElementById("verifyBtn")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  }

  async function verifyClaims() {
    const cleanAnswer = answer.trim();
    const sourcesText = sources.trim();

    if (!cleanAnswer) {
      showError("Please enter an LLM answer to verify.");
      return;
    }

    if (!sourcesText) {
      showError("Please enter at least one source document.");
      return;
    }

    const sourceList = sourcesText
      .split(/\n\s*\n|\n/)
      .filter((source) => source.trim());

    if (sourceList.length === 0) {
      showError(
        "Could not parse source documents. Please separate with blank lines."
      );
      return;
    }

    setResult(null);
    setError("");
    setLoading(true);
    setDocketStatus("Under review");

    try {
      const response = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: cleanAnswer,
          sources: sourceList,
          use_chunking: true,
        }),
      });

      if (!response.ok) {
        let message = "Verification failed";

        try {
          const errorData = await response.json();
          message = errorData.detail || message;
        } catch {}

        throw new Error(message);
      }

      const data: VerificationData = await response.json();

      setResult(data);
      setDocketStatus("Verified");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Verification failed";

      if (
        message.includes("Failed to fetch") ||
        message.includes("NetworkError")
      ) {
        showError(
          "Could not connect to the API. Make sure the backend server is running on port 8000."
        );
      } else {
        showError(message);
      }

      setDocketStatus("Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function showError(message: string) {
    setError(message);
    setResult(null);
  }

  function riskWord(percent: number) {
    if (percent <= 20) return "low";
    if (percent <= 50) return "moderate";
    if (percent <= 75) return "elevated";
    return "high";
  }

  const riskPercent = result
    ? Math.round(result.risk_score * 100)
    : 0;

  const supported = result?.summary.supported || 0;
  const contradicted = result?.summary.contradicted || 0;
  const unverifiable = result?.summary.unverifiable || 0;

  const total = supported + contradicted + unverifiable;

  return (
    <>
      <div className="page">
        <header className="masthead">
          <div className="mast-left">
            <div className="mark" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <circle
                  className="ring"
                  cx="24"
                  cy="24"
                  r="20"
                />
                <circle
                  className="ring-inner"
                  cx="24"
                  cy="24"
                  r="15.5"
                />
                <path
                  className="tick"
                  d="M15 25 L21 31 L34 17"
                />
              </svg>
            </div>

            <div>
              <h1 className="wordmark">ClaimCheck</h1>
              <p className="tagline">
                Every claim, checked against the record.
              </p>
            </div>
          </div>

          <div className="mast-right">
            <div className="mast-actions">
              <button
                type="button"
                className="icon-btn theme-toggle"
                aria-label={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                onClick={toggleTheme}
              >
                <svg
                  className="icon-sun"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.85 1.85M17.55 17.55l1.85 1.85M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.85-1.85M17.55 6.45l1.85-1.85" />
                </svg>

                <svg
                  className="icon-moon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 14.2A8.3 8.3 0 1 1 9.8 4a6.7 6.7 0 0 0 10.2 10.2Z" />
                </svg>
              </button>

              <button
                type="button"
                className="icon-btn"
                aria-haspopup="dialog"
                aria-expanded={docsOpen}
                aria-controls="docPanel"
                aria-label="Open documentation"
                onClick={() => setDocsOpen(true)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 3.5h7.5L18.5 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
                  <path d="M14.2 3.5V8h4.3" />
                  <path d="M9 12.3h6M9 15.4h6M9 18.4h3.6" />
                </svg>
              </button>
            </div>

            <div className="mast-meta">
              <span className="docket-no">{docketNo}</span>
              <span className="docket-status">
                {docketStatus}
              </span>
            </div>
          </div>
        </header>

        <div className="rule" />

        <main>
          <div className="docket">
            <div className="panel">
              <div className="panel-head">
                <h2>The claim</h2>

                <button
                  type="button"
                  className="text-link"
                  onClick={loadDemo}
                >
                  Load sample docket
                </button>
              </div>

              <textarea
                id="llmAnswer"
                aria-label="LLM-generated answer to verify"
                placeholder={`Paste the LLM-generated answer here.

Example:
Metformin should be taken on an empty stomach. It can be combined with insulin therapy. Lactic acidosis occurs in 10% of patients. Nausea is a common side effect.`}
                value={answer}
                onChange={(event) =>
                  setAnswer(event.target.value)
                }
              />
            </div>

            <div className="panel-divider" aria-hidden="true">
              <span className="divider-label">against</span>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>The record</h2>
              </div>

              <textarea
                id="sources"
                aria-label="Source documents to verify the claim against"
                placeholder={`Paste source documents here, separated by a blank line.

Example:
Metformin is a medication for type 2 diabetes. Take with meals to reduce stomach upset.

Lactic acidosis is rare, occurring in approximately 1 in 30,000 patient-years.

Metformin can be safely combined with insulin therapy.`}
                value={sources}
                onChange={(event) =>
                  setSources(event.target.value)
                }
              />
            </div>
          </div>

          <div className="verify-row">
            <button
              className={`stamp-button ${
                loading ? "is-loading" : ""
              }`}
              id="verifyBtn"
              type="button"
              disabled={loading}
              onClick={verifyClaims}
            >
              <span>
                {loading
                  ? "Cross-referencing sources…"
                  : "Verify claims"}
              </span>

              <span
                className="scan-bar"
                aria-hidden="true"
              />
            </button>

            <p className="hint">
              ⌘ / Ctrl + Enter to verify
            </p>
          </div>

          {error && (
            <div className="notice">
              <span className="notice-label">
                Could not complete verification
              </span>

              <p>{error}</p>
            </div>
          )}

          {result && (
            <section
              className="results"
              aria-live="polite"
            >
              <div className="results-head">
                <h3>Verification record</h3>

                <span className="results-sub">
                  {result.claims.length}{" "}
                  {result.claims.length === 1
                    ? "claim"
                    : "claims"}{" "}
                  examined
                </span>
              </div>

              <div className="ledger">
                <div className="risk">
                  <span className="risk-number">
                    {riskPercent}
                  </span>

                  <span className="risk-outof">
                    / 100
                  </span>

                  <p className="risk-label">
                    risk index —{" "}
                    <b>{riskWord(riskPercent)}</b>
                  </p>
                </div>

                <div className="ledger-bar-wrap">
                  <div className="ledger-bar">
                    <div
                      className="seg seg-supported"
                      style={{
                        width: total
                          ? `${(supported / total) * 100}%`
                          : "0%",
                      }}
                    />

                    <div
                      className="seg seg-contradicted"
                      style={{
                        width: total
                          ? `${(contradicted / total) * 100}%`
                          : "0%",
                      }}
                    />

                    <div
                      className="seg seg-unverifiable"
                      style={{
                        width: total
                          ? `${(unverifiable / total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>

                  <div className="ledger-keys">
                    <span className="key key-supported">
                      <i />
                      Supported&nbsp;
                      <b>{supported}</b>
                    </span>

                    <span className="key key-contradicted">
                      <i />
                      Contradicted&nbsp;
                      <b>{contradicted}</b>
                    </span>

                    <span className="key key-unverifiable">
                      <i />
                      Unverifiable&nbsp;
                      <b>{unverifiable}</b>
                    </span>
                  </div>
                </div>
              </div>

              <ol className="exhibits">
                {result.claims.map((claim, index) => {
                  const confidencePct = Math.round(
                    (claim.confidence || 0) * 100
                  );

                  const verdictClass = (
                    claim.verdict || "unverifiable"
                  ).toLowerCase();

                  return (
                    <li
                      className="exhibit"
                      key={`${index}-${claim.claim}`}
                    >
                      <div className="exhibit-index">
                        Exhibit
                        <span>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <div>
                        <blockquote className="exhibit-claim">
                          {claim.claim}
                        </blockquote>

                        <div className="exhibit-evidence">
                          <span className="evidence-label">
                            Evidence
                          </span>

                          <p className="evidence-text">
                            {claim.evidence ||
                              "No evidence found"}
                          </p>
                        </div>
                      </div>

                      <div className="exhibit-verdict">
                        <span
                          className={`stamp stamp-${verdictClass}`}
                        >
                          {claim.verdict ||
                            "Unverifiable"}
                        </span>

                        <div
                          className="confidence-meter"
                          role="img"
                          aria-label={`${confidencePct}% confidence`}
                        >
                          <div
                            className="confidence-fill"
                            style={{
                              width: `${confidencePct}%`,
                            }}
                          />
                        </div>

                        <span className="confidence-label">
                          {confidencePct}% confidence
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </main>

        <footer className="colophon">
          <div className="colophon-lines">
            <p>
              ClaimCheck — open-source LLM verification
              engine.
            </p>

            <p>
              <a
                href="https://github.com/falgunitimande72/claimcheck"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source on GitHub
              </a>{" "}
              — built for Morrow 1.0 Hackathon
            </p>
          </div>

          <p className="signature">
            Designed by Falguni
          </p>
        </footer>
      </div>

      <div
        className={`doc-backdrop ${
          docsOpen ? "is-open" : ""
        }`}
        onClick={() => setDocsOpen(false)}
      />

      <aside
        className={`doc-panel ${
          docsOpen ? "is-open" : ""
        }`}
        id="docPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docPanelTitle"
        aria-hidden={!docsOpen}
      >
        <div className="doc-panel-head">
          <h2 id="docPanelTitle">
            How ClaimCheck works
          </h2>

          <button
            type="button"
            className="icon-btn"
            aria-label="Close documentation"
            onClick={() => setDocsOpen(false)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="doc-panel-body">
          <div className="doc-note">
            <div className="doc-note-head">
              <span className="doc-note-num">01</span>
              <h3>The problem</h3>
            </div>

            <p>
              LLMs write with total confidence whether or
              not what they're saying is true. A fluent,
              well-structured answer can mix accurate
              statements with subtle distortions or outright
              fabrications, and there's usually no visible
              seam between the two. Reading the answer alone
              won't tell you which sentences are backed by
              your source material and which ones the model
              simply made sound plausible.
            </p>
          </div>

          <div className="doc-note">
            <div className="doc-note-head">
              <span className="doc-note-num">02</span>
              <h3>The ClaimCheck solution</h3>
            </div>

            <p>
              ClaimCheck cross-examines an LLM's answer
              against the documents it was supposed to be
              grounded in. Instead of asking you to trust the
              output, it checks it — sentence by sentence —
              and returns a verdict, a confidence score, and
              the exact evidence behind each one. The result
              is a record you can point to, not a reassurance
              you have to take on faith.
            </p>
          </div>

          <div className="doc-note">
            <div className="doc-note-head">
              <span className="doc-note-num">03</span>
              <h3>How the application works</h3>
            </div>

            <p>
              When you submit a docket, the answer is
              decomposed into individual, checkable claims.
              Each claim is then compared against your source
              record to find the most relevant passage, if
              one exists. That comparison produces a verdict
              for the claim, a confidence value for how
              certain the match is, and the evidence excerpt
              that justifies the call.
            </p>
          </div>

          <div className="doc-note">
            <div className="doc-note-head">
              <span className="doc-note-num">04</span>
              <h3>Step-by-step usage</h3>
            </div>

            <ol>
              <li>
                Paste the LLM-generated answer into{" "}
                <em>The claim</em>.
              </li>

              <li>
                Paste your source documents into{" "}
                <em>The record</em>, separating multiple
                documents with a blank line.
              </li>

              <li>
                Select <em>Verify claims</em>, or press
                ⌘/Ctrl + Enter.
              </li>

              <li>
                Read the risk index and ledger bar for an
                at-a-glance summary of the answer.
              </li>

              <li>
                Review each exhibit for the specific
                verdict, confidence, and evidence behind
                every claim.
              </li>
            </ol>
          </div>

          <div className="doc-note">
            <div className="doc-note-head">
              <span className="doc-note-num">05</span>
              <h3>
                How the verification result is generated
              </h3>
            </div>

            <p>
              Each claim is weighed against the source
              record to determine whether the evidence{" "}
              <strong>supports</strong> it,{" "}
              <strong>contradicts</strong> it, or is too
              thin to say either way (
              <strong>unverifiable</strong>). Confidence
              reflects how strong that match is. The overall
              risk index aggregates these verdicts across the
              whole answer, so a higher score means a larger
              share of the answer isn't clearly backed by
              your sources.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
