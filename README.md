# Efficient Text Searching 🔍

A C++ DSA project that implements four classical **pattern searching algorithms** on a real-world text corpus — *The Adventures of Sherlock Holmes*. Each algorithm locates all occurrences of a user-supplied pattern and reports the **exact line number and position** within the text file.

---

## 📌 Overview

This project was built to compare different approaches to substring search — from linear-scan algorithms to advanced index-based data structures — on a large body of text. It demonstrates trade-offs between time complexity, space complexity, and practical build time.

---

## 🧠 Algorithms Implemented

### 1. KMP (Knuth-Morris-Pratt) — `Kmp.cpp`
A classic linear-time pattern matching algorithm. It preprocesses the pattern to compute a **Longest Prefix Suffix (LPS)** array, which allows it to skip redundant character comparisons during search.

- **Preprocessing:** O(m) — builds the LPS array
- **Search:** O(n) — single pass through the text
- **Space:** O(m) — for the LPS array
- **Input file:** `sherlock.txt` (large corpus)

### 2. Finite Automata — `Finite_automata.cpp`
Builds a **transition function (TF)** table from the pattern that encodes all possible state transitions for every character in the alphabet (256 ASCII characters). The text is then scanned in a single pass, updating state as each character is consumed.

- **Preprocessing:** O(m³ × Σ) — computes transition table; Σ = 256
- **Search:** O(n) — single-pass scan
- **Space:** O(m × Σ) — for the transition table
- **Input file:** `sherlock.txt` (large corpus)

### 3. Suffix Trie — `Trie.cpp`
Constructs a **suffix trie** — a trie of all suffixes of the input text. Once built, any pattern can be searched in O(m) time. Due to the quadratic space usage (storing all O(n²) characters of all suffixes), a **smaller excerpt** (`sherlock2.txt`) is used as input.

- **Build:** O(n²) time and space
- **Search:** O(m) — traverse trie from root
- **Space:** O(n²) — all suffixes stored explicitly
- **Input file:** `sherlock2.txt` (smaller excerpt)

### 4. Suffix Tree — `suffix_tree.cpp`
An optimized version of the suffix trie using **Ukkonen's algorithm**, which builds the suffix tree in linear time and space by representing edges implicitly using `(start, end)` index pairs rather than storing substring characters.

- **Build:** O(n) — Ukkonen's online construction
- **Search:** O(m + k) where k = number of occurrences
- **Space:** O(n) — compact implicit representation
- **Input file:** `sherlock.txt` (large corpus)

---

## 📊 Algorithm Comparison

| Algorithm | Build Time | Search Time | Space | Input File |
|---|---|---|---|---|
| KMP | O(m) | O(n) | O(m) | `sherlock.txt` |
| Finite Automata | O(m³ · Σ) | O(n) | O(m · Σ) | `sherlock.txt` |
| Suffix Trie | O(n²) | O(m) | O(n²) | `sherlock2.txt` |
| Suffix Tree | O(n) | O(m + k) | O(n) | `sherlock.txt` |

> n = text length, m = pattern length, k = number of matches, Σ = alphabet size (256)

---

## 📁 Project Structure

```
Efficient-Text-Searching/
├── Kmp.cpp                 # KMP pattern matching
├── Finite_automata.cpp     # Finite automata pattern matching
├── Trie.cpp                # Suffix trie search
├── suffix_tree.cpp         # Suffix tree (Ukkonen's algorithm)
├── sherlock.txt            # Large input text (full Sherlock corpus)
└── sherlock2.txt           # Smaller input text excerpt (for Trie)
```

---

## ⚙️ How It Works

All four programs share the same user-facing flow:

1. **Read the text file** — the file is loaded line by line. Line-break positions are recorded in a vector (`v1`) to enable mapping flat character offsets back to `(line, position)` coordinates.
2. **Prompt for a pattern** — the user enters any substring to search for.
3. **Run the algorithm** — the chosen algorithm searches for all occurrences.
4. **Report results** — for each match, the program prints:
   ```
   Found at line: <line_number> position: <column_position>
   ```
5. **Print total count** — the total number of occurrences is displayed at the end.

---

## 🚀 Compilation & Usage

Each file is a standalone C++ program. Compile with any C++11-compatible compiler.

### Compile
```bash
# KMP
g++ -o kmp Kmp.cpp

# Finite Automata
g++ -o fa Finite_automata.cpp

# Suffix Trie
g++ -o trie Trie.cpp

# Suffix Tree
g++ -o suffix_tree suffix_tree.cpp
```

### Run
```bash
./kmp
# Enter pattern to search: Holmes
# Found at line: 5 position: 12
# ...
# Number of Occurrences: 487
```

> **Note:** Each binary must be run from the directory containing the text files (`sherlock.txt` and `sherlock2.txt`), as the file paths are hardcoded.

---

## 📝 Input Files

| File | Description | Used By |
|---|---|---|
| `sherlock.txt` | Full Sherlock Holmes corpus (~325 KB) | KMP, Finite Automata, Suffix Tree |
| `sherlock2.txt` | Smaller excerpt (~1.9 KB) | Suffix Trie |

The Suffix Trie uses the smaller file because its O(n²) space complexity makes it impractical for large inputs.

---

## 🔧 Implementation Notes

- **Line/position tracking:** All programs store cumulative line-end byte offsets in a `vector<long long> v1`. Binary search (`lower_bound`) on this vector maps any flat text offset to a `(line, column)` coordinate in O(log n).
- **Suffix Tree terminator:** The Suffix Tree appends `$` to the text before construction to ensure all suffixes end at unique leaf nodes, a requirement of Ukkonen's algorithm.
- **Suffix Trie memory:** Each `SuffixTrieNode` allocates a `children[256]` array and a `list<int>` for index storage, resulting in high memory usage for large inputs — hence the use of `sherlock2.txt`.

---

## 📚 References

- Knuth, Morris, Pratt — *"Fast Pattern Matching in Strings"* (1977)
- Ukkonen — *"On-line construction of suffix trees"* (1995)
- CLRS — *Introduction to Algorithms*, Chapter 32 (String Matching)
