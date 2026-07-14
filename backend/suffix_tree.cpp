// including the required libraries
#include <iostream>
#include <vector>
#include <fstream>
#include <chrono>
#include <unordered_map>
using namespace std;
vector<long long> v1;

// Function to create a new node in the suffix tree
//
// NOTE ON MEMORY: the original implementation gave every node a fixed
// `children[256]` pointer array (2KB/node on a 64-bit build). That's fine
// for a short-lived process that builds-searches-exits, but this tree now
// lives for the entire lifetime of the server (built once, queried many
// times), so that 2KB/node adds up fast -- on the ~325K-character corpus
// the tree has roughly 2n nodes, which meant ~1.3GB just for empty child
// slots, and was the root cause of the "crashes on larger inputs" issue
// noted in the old README. Since the alphabet actually in use is small
// (letters, punctuation, space, '$'), each node instead keeps a small
// hash map of only the children edges that actually exist.
typedef struct SuffixTreeNode
{
    struct SuffixTreeNode *suffixLink;
    unordered_map<unsigned char, struct SuffixTreeNode *> children;
    int suffixIndex;
    int *end;
    int start;
} SNode;

class Suffix_Tree
{
public:
    string test;
    SNode *root = NULL;
    SNode *lastNewNode = NULL;
    SNode *activeNode = NULL;
    int activeEdge = -1;
    int activeLength = 0;
    int remainingSuffixCount = 0;
    int END = -1;
    int *rootEnd = NULL;
    int *splitEnd = NULL;
    int size = -1;
    ~Suffix_Tree()
    {
        freeSuffixTreeByPostOrder(root);
    }
    SNode *newNode(int start, int *end)
    {
        SNode *STSNode = new SNode();
        STSNode->suffixLink = root;
        STSNode->start = start;
        STSNode->end = end;
        STSNode->suffixIndex = -1;
        return STSNode;
    }
    // returns the child for edge-char c, or NULL if none
    SNode *getChild(SNode *n, unsigned char c)
    {
        auto it = n->children.find(c);
        return it == n->children.end() ? NULL : it->second;
    }
// function to return the edge length
    int edgeLength(SNode *A)
    {
        if (A == root)
            return 0;
        long int e = *(A->end);
        long int s = A->start;
        return (e - s + 1);
    }
    
// function to walk down along the tree If activeLength is greater 
//  than current edge length, set next internal node as 
//  activeNode and adjust activeEdge and activeLength 
//  accordingly to represent same activePoint
    int walkDown(SNode *A)
    {
        if (activeLength >= edgeLength(A))
        {
            activeNode = A;
            activeLength -= edgeLength(A);
            activeEdge += edgeLength(A);
            return 1;
        }
        return 0;
    }
    void extendSuffixTree(int pos)
    {
    // exteniding all the leaves
        END = pos;
        /*Increment remainingSuffixCount indicating that a 
    new suffix added to the list of suffixes yet to be 
    added in tree*/
        remainingSuffixCount++;
        lastNewNode = NULL;
        while (remainingSuffixCount)
        {
            if (activeLength == 0)
                activeEdge = pos;
        // determining the edge from active node to active edge
            SNode *edgeNode = getChild(activeNode, (unsigned char)test[activeEdge]);
            if (edgeNode == NULL)
            {
                activeNode->children[(unsigned char)test[activeEdge]] = newNode(pos, &END);
                if (lastNewNode != NULL)
                {
                    lastNewNode->suffixLink = activeNode;
                    lastNewNode = NULL;
                }
            }
        // if there is no edge between active node and acitve edge
            else
            {
            // go to the next node 
                SNode *next = edgeNode;
                if (walkDown(next))
                {
                    continue;
                }
                if (test[next->start + activeLength] == test[pos])
                {
                    if (lastNewNode != NULL && activeNode != root)
                    {
                        lastNewNode->suffixLink = activeNode;
                        lastNewNode = NULL;
                    }
                    activeLength++;
                    break;
                }
                splitEnd = new int;
                *splitEnd = next->start + activeLength - 1;
                SNode *split = newNode(next->start, splitEnd);
                activeNode->children[(unsigned char)test[activeEdge]] = split;
                split->children[(unsigned char)test[pos]] = newNode(pos, &END);
                next->start += activeLength;
                split->children[(unsigned char)test[next->start]] = next;
                if (lastNewNode != NULL)
                {
                    lastNewNode->suffixLink = split;
                }
                lastNewNode = split;
            }
            remainingSuffixCount--;
            if (activeNode == root && activeLength > 0)
            {
                activeLength--;
                activeEdge = pos - remainingSuffixCount + 1;
            }
            else if (activeNode != root)
            {
                activeNode = activeNode->suffixLink;
            }
        }
    }
// funtion to print hte suffix tree
    void print(int i, int j)
    {
        int k;
        for (k = i; k <= j; k++)
            printf("%c", test[k]);
    }
// funtion to set the suffix index
    void setSuffixIndex(SNode *n, int labelHeight)
    {
        if (n == NULL)
            return;
        if (n->children.empty())
        {
            n->suffixIndex = size - labelHeight;
            return;
        }
        for (auto &kv : n->children)
        {
            setSuffixIndex(kv.second, labelHeight + edgeLength(kv.second));
        }
    }
// function for freeing memory 
    void freeSuffixTreeByPostOrder(SNode *n)
    {
        if (n == NULL)
            return;
        for (auto &kv : n->children)
        {
            freeSuffixTreeByPostOrder(kv.second);
        }
        if (n->suffixIndex == -1)
            delete n->end;
        delete n;
    }
// function to build suffix tree
    void buildSuffixTree(string &text)
    {
        test = text;
        size = test.size();
        rootEnd = new int;
        *rootEnd = -1;
        root = newNode(-1, rootEnd);
        activeNode = root;
        int j = 0;
        while (j < size)
            extendSuffixTree(j++);
        int labelHeight = 0;
        setSuffixIndex(root, labelHeight);
    }
    SNode *returnRoot()
    {
        return root;
    }

    int ind = 0;
// funtion to traverse the edges
    int traverseEdge(string &str, int idx, int start, int end, string &text)
    {
        int k = 0;
        for (k = start; k <= end && str[idx] != '\0'; k++, idx++)
        {
            if (text[k] != str[idx])
                return -1;
        }
        if (str[idx] == '\0')
            return 1;
        return 0;
    }
    int doTraversalToCountLeaf(SNode *n)
    {
        if (n == NULL)
            return 0;
        if (n->suffixIndex > -1)
        {
            long long it = lower_bound(v1.begin(), v1.end(), n->suffixIndex) - v1.begin();

            int c;
            if (it == 0)
            {
                c = n->suffixIndex;
            }
            else
            {
                c = n->suffixIndex - v1[it - 1];
            }
            if (it == 0)
            {
                c++;
            }
            cout << "Found at line: " << it + 1 << " position: " << c << endl;
            ;

            return 1;
        }
        int count = 0;
        for (auto &kv : n->children)
        {
            count += doTraversalToCountLeaf(kv.second);
        }
        return count;
    }

// funtion to count the leaves
    int countLeaf(SNode *n)
    {
        if (n == NULL)
            return 0;
        return doTraversalToCountLeaf(n);
    }
// funtion to traverse the tree
    int doTraversal(SNode *n, string &str, int idx, string &text)
    {
        if (n == NULL)
        {
            return -1;
        }
        int res = -1;
        if (n->start != -1)
        {
            res = traverseEdge(str, idx, n->start, *(n->end), text);
            if (res == -1)
                return -1;
            if (res == 1)
            {
                if (n->suffixIndex > -1)
                {
                    long long it = lower_bound(v1.begin(), v1.end(), n->suffixIndex) - v1.begin();

                    int c;
                    if (it == 0)
                    {
                        c = n->suffixIndex;
                    }
                    else
                    {
                        c = n->suffixIndex - v1[it - 1];
                    }
                    if (it == 0)
                    {
                        c++;
                    }
                    cout << "Found at line: " << it + 1 << " position: " << c << endl;
                }
                else
                {
                    int count = countLeaf(n);
                    cout << "Number of Occurences: " << count << endl;
                }
                return 1;
            }
        }
        idx = idx + edgeLength(n);
        SNode *nxt = getChild(n, (unsigned char)str[idx]);
        if (nxt != NULL)
            return doTraversal(nxt, str, idx, text);
        else
            return -1;
    }
// funtion to check the string in the suffix tree 
    void checkForSubString(string &str, SNode *root, string &text)
    {

        int res = doTraversal(root, str, 0, text);

        if (res == 1)
        {
            ind = 0;
        }
        else
        {
            printf("Number of Occurences: 0\n");
        }
    }
};

// ---------------------------------------------------------------------------
// Persistent worker mode (default): the suffix tree is built EXACTLY ONCE on
// startup. After that, every query received on stdin is answered by walking
// the already-built tree -- no rebuild happens per query. This is what makes
// repeated queries O(m) instead of O(n+m) each time.
//
// Usage: ./suffix_bin <textfile> [--once]
//   (no --once)  -> long-running worker: prints "READY <buildUs>" once the
//                   tree is built, then for every line read from stdin it
//                   runs one query and prints "###END:<queryUs>###" so the
//                   caller can tell where that query's output ends.
//   --once       -> legacy single-shot mode (build + one query + exit), kept
//                   only so ad-hoc/custom text pasted by a user can still be
//                   searched without needing a dedicated long-lived process.
// ---------------------------------------------------------------------------
int main(int argc, char **argv)
{
    string textfile = argc > 1 ? argv[1] : "sherlock.txt";
    bool once = (argc > 2 && string(argv[2]) == "--once");

    ifstream newfile;
    newfile.open(textfile);
    string s1;
    if (newfile.is_open())
    {
        string tp;
        while (getline(newfile, tp))
        {
            s1 += tp;
            s1 += ' ';
            if (v1.size() == 0)
            {
                v1.push_back(tp.size());
            }
            else
            {
                v1.push_back(v1.back() + tp.size() + 1);
            }
        }
        newfile.close();
    }
    else
    {
        cerr << "File not opened" << endl;
    }
    s1 += "$";

    // ---- Build the suffix tree ONCE ----
    auto buildStart = chrono::high_resolution_clock::now();
    Suffix_Tree a;
    a.buildSuffixTree(s1);
    auto buildEnd = chrono::high_resolution_clock::now();
    long long buildUs = chrono::duration_cast<chrono::microseconds>(buildEnd - buildStart).count();

    if (once)
    {
        string s2;
        getline(cin, s2);
        a.checkForSubString(s2, a.root, s1);
        return 0;
    }

    cout << "READY " << buildUs << endl;
    cout.flush();

    string pattern;
    while (getline(cin, pattern))
    {
        if (pattern == "__EXIT__")
            break;
        auto qStart = chrono::high_resolution_clock::now();
        a.checkForSubString(pattern, a.root, s1);
        auto qEnd = chrono::high_resolution_clock::now();
        long long qUs = chrono::duration_cast<chrono::microseconds>(qEnd - qStart).count();
        cout << "###END:" << qUs << "###" << endl;
        cout.flush();
    }
    return 0;
}
