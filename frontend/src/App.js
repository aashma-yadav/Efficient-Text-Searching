import React, { useState, useEffect } from "react";
import "./App.css";

const ALGO_IDS = ["kmp", "fa", "suffix", "trie"];

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function App() {
  const [algorithms, setAlgorithms] = useState([]);
  const [selected, setSelected] = useState("suffix");
  const [pattern, setPattern] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareResults, setCompareResults] = useState(null);

  useEffect(() => {
    api("/algorithms").then(setAlgorithms).catch(() => {});
  }, []);

  const algo = algorithms.find((a) => a.id === selected);

  async function runSearch() {
    if (!pattern.trim()) return;
    setError("");
    setLoading(true);
    setResult(null);
    setCompareResults(null);

    try {
      if (compareMode) {
        const entries = await Promise.all(
          ALGO_IDS.map(async (id) => {
            try {
              return [id, await api("/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ algorithm: id, pattern }),
              })];
            } catch (e) {
              return [id, { error: e.message }];
            }
          })
        );
        setCompareResults(Object.fromEntries(entries));
      } else {
        setResult(await api("/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ algorithm: selected, pattern }),
        }));
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-title">
          <span className="prompt">$</span> grep<span className="cursor">_</span>
        </div>
        <div className="hdr-sub">
          4 pattern-matching algorithms · suffix tree &amp; trie are built <strong>once</strong> at server start
        </div>
      </header>

      <div className="tabs">
        {algorithms.map((a) => (
          <button
            key={a.id}
            className={`tab ${selected === a.id ? "active" : ""}`}
            style={{ "--c": a.color }}
            onClick={() => setSelected(a.id)}
          >
            {a.name}
          </button>
        ))}
        <label className="compare-toggle">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          compare all
        </label>
      </div>

      {algo && !compareMode && (
        <div className="algo-info">
          <span className="pill">{algo.complexity}</span>
          <span className="pill">{algo.space} space</span>
          {algo.buildOnceMs != null && (
            <span className="pill build-pill">built once in {algo.buildOnceMs} ms</span>
          )}
          <p className="algo-desc">{algo.description}</p>
        </div>
      )}

      <div className="searchbar">
        <input
          className="search-input"
          type="text"
          placeholder='search for a pattern, e.g. "Holmes"'
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          autoFocus
        />
        <button className="search-btn" onClick={runSearch} disabled={loading || !pattern.trim()}>
          {loading ? "…" : "search"}
        </button>
      </div>

      {error && <div className="error">✗ {error}</div>}

      {!compareMode && result && <ResultView result={result} algo={algo} pattern={pattern} />}

      {compareMode && compareResults && (
        <div className="compare-grid">
          {ALGO_IDS.map((id) => {
            const a = algorithms.find((x) => x.id === id);
            const r = compareResults[id];
            return (
              <div key={id} className="compare-card" style={{ "--c": a?.color }}>
                <div className="compare-name">{a?.name}</div>
                {r?.error ? (
                  <div className="error">✗ {r.error}</div>
                ) : (
                  <>
                    <div className="compare-time">{r.timeMs} ms</div>
                    <div className="compare-count">{r.count} match{r.count === 1 ? "" : "es"}</div>
                    <div className="compare-mode">{r.mode}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!result && !compareResults && !loading && (
        <div className="empty">
          type a pattern above and hit enter — searches the Sherlock Holmes corpus
          {algo?.corpusChars ? ` (${algo.corpusChars.toLocaleString()} chars, ${algo.corpusFile})` : ""}
        </div>
      )}

      <footer className="ftr">KMP · Finite Automaton · Suffix Trie · Ukkonen Suffix Tree</footer>
    </div>
  );
}

function ResultView({ result, algo, pattern }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? result.matches : result.matches.slice(0, 20);

  return (
    <div className="result">
      <div className="stats">
        <Stat label="matches" value={result.count} />
        <Stat label="query time" value={`${result.timeMs} ms`} accent />
        {result.buildTimeMs != null && <Stat label="one-time build" value={`${result.buildTimeMs} ms`} />}
        <Stat label="mode" value={result.mode} small />
      </div>

      {result.matches.length > 0 ? (
        <>
          <table className="matches">
            <thead>
              <tr><th>#</th><th>line</th><th>col</th><th>match</th></tr>
            </thead>
            <tbody>
              {displayed.map((m, i) => (
                <tr key={i}>
                  <td className="dim">{i + 1}</td>
                  <td>{m.line}</td>
                  <td>{m.position}</td>
                  <td><mark>{pattern}</mark></td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.matches.length > 20 && !showAll && (
            <button className="show-more" onClick={() => setShowAll(true)}>
              show all {result.matches.length} matches
            </button>
          )}
        </>
      ) : (
        <div className="empty">no matches for "{pattern}"</div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, small }) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <div className={`stat-val ${small ? "small" : ""}`}>{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  );
}
