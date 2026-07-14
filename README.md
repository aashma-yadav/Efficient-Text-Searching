# Efficient Text Search — Full Stack DSA Visualizer

A full-stack web application that runs **4 classic pattern matching algorithms** on the Sherlock Holmes corpus (~325,000 characters) with a React frontend and a Node.js backend.

> Note: the Suffix Trie runs on a smaller ~1,900-character excerpt (`sherlock2.txt`) since a suffix trie's O(n²) space cost makes the full corpus impractical — this is a deliberate tradeoff, not an oversight.

---

## Architecture — build once, query many

Each algorithm's C++ binary now runs as a **long-lived worker process**, spawned exactly once when the server starts, instead of being re-spawned (and its data structure rebuilt from scratch) on every single request:

| Algorithm | What's built once at startup | What happens per query |
|---|---|---|
| Ukkonen Suffix Tree | The whole suffix tree, from the corpus | Walk the existing tree — O(m) |
| Suffix Trie | The whole suffix trie, from the corpus | Walk the existing trie — O(m) |
| KMP | Corpus loaded into memory | LPS table for the pattern (inherently pattern-dependent) + scan |
| Finite Automaton | Corpus loaded into memory | Transition table for the pattern (inherently pattern-dependent) + scan |

The Node.js backend talks to each worker over stdin/stdout with a tiny line protocol (`READY <buildMicroseconds>` once at boot, `###END:<queryMicroseconds>###` after each query), so the UI can show both the one-time build cost and the true per-query time — separate from any process-spawn overhead, since there isn't any after startup.

**Suffix tree memory fix:** the original suffix tree node stored a fixed 256-pointer array per node (2KB/node), which is fine for a process that builds→searches→exits, but balloons past a gigabyte once the tree has to stay resident for the server's whole lifetime. Nodes now use a small hash map of only the child edges that actually exist, cutting memory by roughly 2 orders of magnitude and removing the earlier segfault-on-large-input issue.

---

## Algorithms Implemented

| Algorithm | Complexity | Space | Best For |
|---|---|---|---|
| KMP | O(n + m) | O(m) | Single pattern, large text |
| Suffix Trie | O(m) search | O(n²) | Small text, fast repeated lookup |
| Finite Automaton | O(n) search | O(m × σ) | Repeated queries |
| Ukkonen Suffix Tree | O(n + m) build, O(m) search | O(n) | Multiple patterns, minimal per-query latency |

---

## Project Structure

```
efficient-text-search/
├── backend/
│   ├── server.js           ← Node.js Express API + persistent worker manager
│   ├── package.json
│   ├── Kmp.cpp             ← KMP algorithm (persistent worker mode)
│   ├── Trie.cpp            ← Suffix Trie (built once, worker mode)
│   ├── Finite_automata.cpp ← FA algorithm (persistent worker mode)
│   ├── suffix_tree.cpp     ← Ukkonen Suffix Tree (built once, worker mode)
│   ├── sherlock.txt        ← Large corpus (~325k chars)
│   └── sherlock2.txt       ← Smaller corpus (for Trie)
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.js / App.css   ← single-file UI (search + compare)
        └── index.js / index.css
```

---

## How to Run

### Prerequisites
- Node.js (v16+) — https://nodejs.org
- g++ compiler — `xcode-select --install` on Mac, `sudo apt install g++` on Linux

### Step 1 — Backend
```bash
cd backend
npm install
node server.js
```
Server runs on http://localhost:3001. It compiles all 4 C++ binaries, then starts one persistent worker per algorithm (you'll see `[WORKER suffix] ready, one-time build took X ms` in the logs).

### Step 2 — Frontend (new terminal)
```bash
cd frontend
npm install
npm start
```
Opens http://localhost:3000 in your browser.

---

## Features

- **Search** — pick an algorithm, enter a pattern, see every match (line + column), the query-only time, and (for suffix tree / trie) the one-time build time.
- **Compare all** — run all 4 algorithms on the same pattern side by side.
- **Custom text** — the `/search` endpoint accepts an optional `text` field to search ad-hoc pasted text instead of the built-in corpus; this uses a one-shot process (build + query + exit) since it isn't the persistent corpus.
- **Live metadata** — corpus sizes and one-time build times shown in the UI are read live from the running workers/disk, not hardcoded.

---

## Resume Bullet Points

> Built a full-stack DSA visualization platform implementing KMP, Finite Automaton, Suffix Trie, and Ukkonen Suffix Tree algorithms in C++, with each algorithm running as a persistent worker process so the suffix tree / trie are built once at server startup and every query runs against the already-built structure.

> Designed an algorithm comparison dashboard that benchmarks all 4 pattern matching algorithms simultaneously, displaying match counts, true per-query execution time, and complexity tradeoffs side-by-side.
