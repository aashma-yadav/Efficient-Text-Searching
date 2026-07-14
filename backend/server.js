const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const BACKEND_DIR = __dirname;

// Map algorithm name -> cpp source, compiled binary, default corpus file.
const ALGORITHMS = {
  kmp:    { src: "Kmp.cpp",             bin: "./kmp_bin",    file: "sherlock.txt" },
  fa:     { src: "Finite_automata.cpp", bin: "./fa_bin",     file: "sherlock.txt" },
  suffix: { src: "suffix_tree.cpp",     bin: "./suffix_bin", file: "sherlock.txt" },
  trie:   { src: "Trie.cpp",            bin: "./trie_bin",   file: "sherlock2.txt" },
};

// Live worker state per algorithm: { proc, ready, buildUs, rl, queue }
const workers = {};

// ---------------------------------------------------------------------------
// Each worker is a long-running child process that:
//   1. Reads its corpus file and builds any text-only data structure
//      (suffix tree / suffix trie) ONE TIME on startup.
//   2. Prints "READY <buildMicroseconds>" once that one-time build is done.
//   3. Then sits in a loop: for every pattern line we write to its stdin, it
//      answers the query against the already-built structure and prints
//      "###END:<queryMicroseconds>###" as a sentinel so we know the query's
//      output is complete.
// Because the process is never re-spawned and the structure is never
// rebuilt, repeated searches only pay for the query itself.
// ---------------------------------------------------------------------------
function startWorker(name) {
  const { bin, file } = ALGORITHMS[name];
  const proc = spawn(bin, [file], { cwd: BACKEND_DIR });
  const rl = readline.createInterface({ input: proc.stdout });

  const worker = { proc, ready: false, buildUs: 0, rl, queue: [], pending: null, buffer: [] };

  rl.on("line", (line) => {
    if (!worker.ready) {
      const m = line.match(/^READY\s+(\d+)/);
      if (m) {
        worker.ready = true;
        worker.buildUs = parseInt(m[1], 10);
        console.log(`[WORKER ${name}] ready, one-time build took ${(worker.buildUs / 1000).toFixed(3)} ms`);
        processQueue(name);
      }
      return;
    }

    const endMatch = line.match(/^###END:(\d+)###$/);
    if (endMatch) {
      const queryUs = parseInt(endMatch[1], 10);
      const done = worker.pending;
      worker.pending = null;
      if (done) done.resolve({ lines: worker.buffer, queryUs });
      worker.buffer = [];
      processQueue(name);
      return;
    }

    worker.buffer.push(line);
  });

  proc.stderr.on("data", (d) => console.error(`[WORKER ${name} stderr]`, d.toString()));
  proc.on("exit", (code) => {
    console.error(`[WORKER ${name}] exited with code ${code}, restarting...`);
    worker.ready = false;
    setTimeout(() => startWorker(name), 500);
  });

  workers[name] = worker;
}

function processQueue(name) {
  const worker = workers[name];
  if (!worker.ready || worker.pending || worker.queue.length === 0) return;
  const next = worker.queue.shift();
  worker.pending = next;
  worker.buffer = [];
  worker.proc.stdin.write(next.pattern + "\n");
}

// Run a query against a persistent worker. Resolves with { lines, queryUs }.
function queryWorker(name, pattern) {
  return new Promise((resolve, reject) => {
    const worker = workers[name];
    if (!worker) return reject(new Error("Unknown algorithm"));
    worker.queue.push({ pattern, resolve, reject });
    processQueue(name);
  });
}

// Parse the plain-text output the C++ binaries print into structured matches.
function parseOutput(lines) {
  const matches = [];
  let count = 0;
  lines.forEach((line) => {
    const m1 = line.match(/Found at line:\s*(\d+)\s*(?:and\s*)?position[:\s]+(\d+)/i);
    if (m1) matches.push({ line: parseInt(m1[1]), position: parseInt(m1[2]) });
    const m2 = line.match(/Number of [Oo]ccurrences?[:\s]+(\d+)/i);
    if (m2) count = parseInt(m2[1]);
  });
  return { matches, count: count || matches.length };
}

// ---------------------------------------------------------------------------
// Compile all four binaries, then start one persistent worker per algorithm.
// ---------------------------------------------------------------------------
async function startup() {
  await Promise.all(
    Object.entries(ALGORITHMS).map(async ([name, { src }]) => {
      try {
        await execAsync(`g++ -O2 -o ${ALGORITHMS[name].bin} ${src}`, { cwd: BACKEND_DIR });
        console.log(`[COMPILED] ${name}`);
      } catch (err) {
        console.error(`[COMPILE ERROR] ${name}:`, err.stderr || err.message);
      }
    })
  );
  Object.keys(ALGORITHMS).forEach(startWorker);
}
startup();

// POST /search — search either the built-in corpus (fast path, uses the
// persistent worker) or custom pasted text (one-shot path, since a custom
// corpus can't reuse the pre-built structure of a different fixed corpus).
app.post("/search", async (req, res) => {
  const { algorithm, pattern, text } = req.body;

  if (!algorithm || !pattern) {
    return res.status(400).json({ error: "algorithm and pattern required" });
  }
  if (!ALGORITHMS[algorithm]) {
    return res.status(400).json({ error: "Unknown algorithm" });
  }

  // Custom text path: spin up a one-shot process (--once) against a temp file.
  if (text && text.trim()) {
    const { bin } = ALGORITHMS[algorithm];
    const tempFile = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`;
    const tempPath = path.join(BACKEND_DIR, tempFile);
    fs.writeFileSync(tempPath, text);

    const startTime = Date.now();
    const proc = exec(`${bin} ${tempFile} --once`, { cwd: BACKEND_DIR, timeout: 15000 }, (err, stdout, stderr) => {
      const elapsed = Date.now() - startTime;
      try { fs.unlinkSync(tempPath); } catch {}
      if (err && !stdout) {
        return res.status(500).json({ error: stderr || "Execution failed" });
      }
      const lines = stdout.trim().split("\n").filter(Boolean);
      const { matches, count } = parseOutput(lines);
      res.json({
        algorithm,
        pattern,
        count,
        matches: matches.slice(0, 200),
        timeMs: elapsed,
        mode: "custom-text (one-shot build)",
        rawOutput: stdout.trim(),
      });
    });
    proc.stdin.write(pattern + "\n");
    proc.stdin.end();
    return;
  }

  // Fast path: query the already-built, persistent structure.
  try {
    const worker = workers[algorithm];
    if (!worker || !worker.ready) {
      return res.status(503).json({ error: `${algorithm} worker is still starting up, try again shortly` });
    }
    const { lines, queryUs } = await queryWorker(algorithm, pattern);
    const { matches, count } = parseOutput(lines);
    res.json({
      algorithm,
      pattern,
      count,
      matches: matches.slice(0, 200),
      timeMs: +(queryUs / 1000).toFixed(3),
      buildTimeMs: +(worker.buildUs / 1000).toFixed(3),
      mode: "prebuilt (query-only timing)",
      rawOutput: lines.join("\n"),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Execution failed" });
  }
});

// GET /text-preview — return first 100 lines of the text file
app.get("/text-preview", (req, res) => {
  const algo = req.query.algo || "kmp";
  const file = ALGORITHMS[algo] ? ALGORITHMS[algo].file : "sherlock.txt";
  const content = fs.readFileSync(path.join(BACKEND_DIR, file), "utf8");
  const lines = content.split("\n").slice(0, 100).join("\n");
  res.json({ lines, totalLines: content.split("\n").length });
});

// GET /algorithms — metadata (corpus sizes read from disk, build time read
// live from each worker so the UI reflects reality, not hardcoded numbers)
app.get("/algorithms", (req, res) => {
  const sherlockChars = fs.statSync(path.join(BACKEND_DIR, "sherlock.txt")).size;
  const sherlock2Chars = fs.statSync(path.join(BACKEND_DIR, "sherlock2.txt")).size;

  const buildMs = (name) => (workers[name] && workers[name].ready ? +(workers[name].buildUs / 1000).toFixed(3) : null);

  res.json([
    {
      id: "kmp",
      name: "KMP",
      full: "Knuth-Morris-Pratt",
      complexity: "O(n + m)",
      space: "O(m)",
      description: "Uses a failure function (LPS array) to skip unnecessary comparisons. The LPS table depends on the pattern, so it's (correctly) rebuilt per query — but the corpus itself is loaded once at server start.",
      color: "#534AB7",
      corpusFile: "sherlock.txt",
      corpusChars: sherlockChars,
      buildOnceMs: buildMs("kmp"),
    },
    {
      id: "fa",
      name: "FA",
      full: "Finite Automaton",
      complexity: "O(n)",
      space: "O(m × σ)",
      description: "Precomputes a transition table for the pattern (pattern-dependent, rebuilt per query by design). The corpus is loaded once at server start, not on every request.",
      color: "#D85A30",
      corpusFile: "sherlock.txt",
      corpusChars: sherlockChars,
      buildOnceMs: buildMs("fa"),
    },
    {
      id: "trie",
      name: "Trie",
      full: "Suffix Trie",
      complexity: "O(m)",
      space: "O(n²)",
      description: "Builds a suffix trie from the text ONCE at server startup. Every query just walks the existing trie in O(m) — it is never rebuilt.",
      color: "#1D9E75",
      corpusFile: "sherlock2.txt",
      corpusChars: sherlock2Chars,
      buildOnceMs: buildMs("trie"),
    },
    {
      id: "suffix",
      name: "Suffix Tree",
      full: "Ukkonen Suffix Tree",
      complexity: "O(n + m)",
      space: "O(n)",
      description: "Builds an online suffix tree ONCE at server startup using Ukkonen's algorithm. Every subsequent query walks the already-built tree in O(m), giving minimal per-query latency.",
      color: "#BA7517",
      corpusFile: "sherlock.txt",
      corpusChars: sherlockChars,
      buildOnceMs: buildMs("suffix"),
    },
  ]);
});

process.on("SIGINT", () => {
  Object.values(workers).forEach((w) => w.proc.kill());
  process.exit(0);
});

const PORT = 3001;
app.listen(PORT, () => console.log(`[SERVER] Running on http://localhost:${PORT}`));
