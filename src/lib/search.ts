import { compareIds, isDeprecated, type CweNode, type Graph } from './graph';

export interface SearchHit {
  node: CweNode;
  /** The other name that gave the best rank; absent for an ID or name match. */
  via?: { kind: 'term' | 'former'; name: string };
}

interface Lowered {
  terms: string[];
  formers: { lower: string; date: string }[];
}

// Lowercased copies of the other names, built once per graph, not per keystroke.
const loweredByGraph = new WeakMap<Graph, Map<string, Lowered>>();

function loweredFor(graph: Graph): Map<string, Lowered> {
  let lowered = loweredByGraph.get(graph);
  if (!lowered) {
    lowered = new Map();
    for (const node of graph.all) {
      if (node.alternateTerms || node.previousNames) {
        lowered.set(node.id, {
          terms: (node.alternateTerms ?? []).map((t) => t.term.toLowerCase()),
          formers: (node.previousNames ?? []).map((p) => ({ lower: p.name.toLowerCase(), date: p.date })),
        });
      }
    }
    loweredByGraph.set(graph, lowered);
  }
  return lowered;
}

/** Lower sorts first; `via` is set when an alternate term or former name gave the rank. */
function score(node: CweNode, other: Lowered | undefined, query: string): SearchHit & { rank: number } {
  const id = node.id;
  const name = node.name.toLowerCase();

  if (id === query) {
    return { node, rank: 0 };
  }
  if (id.startsWith(query)) {
    return { node, rank: 1 };
  }
  if (name.startsWith(query)) {
    return { node, rank: 2 };
  }

  let rank = Number.POSITIVE_INFINITY;
  let via: SearchHit['via'];

  // Rank 3, an exact alternate term, sits above the "contains" ranks on
  // purpose. A term equal to the whole query is how people name the weakness
  // ("XSS", "CSRF", "Injection"), so it outranks a weakness that merely
  // mentions the word in its name. Without it, "xss" lists CWE-85 and 87
  // ahead of 79, and "injection" lists 91, 1319 and 1334 ahead of 74.
  // Partial term matches, and every former name, still rank below all name
  // matches.
  const consider = (candidate: number, found: SearchHit['via']) => {
    if (candidate < rank) {
      rank = candidate;
      via = found;
    }
  };

  if (id.includes(query)) {
    rank = 4;
  }
  if (name.includes(query)) {
    rank = Math.min(rank, 5);
  }

  if (other) {
    // Strictly lower wins, so the first term in MITRE's order keeps a tie.
    node.alternateTerms?.forEach((t, i) => {
      const lower = other.terms[i];
      if (lower === query) {
        consider(3, { kind: 'term', name: t.term });
      } else if (lower.startsWith(query)) {
        consider(6, { kind: 'term', name: t.term });
      } else if (lower.includes(query)) {
        consider(7, { kind: 'term', name: t.term });
      }
    });

    // The newest former name wins a tie, and the later in MITRE's list wins a
    // tie of dates.
    let formerRank = Number.POSITIVE_INFINITY;
    let formerDate = '';
    let formerName = '';
    node.previousNames?.forEach((p, i) => {
      const { lower, date } = other.formers[i];
      if (!lower.includes(query)) {
        return;
      }
      const r = lower.startsWith(query) ? 8 : 9;
      if (r < formerRank || (r === formerRank && date >= formerDate)) {
        formerRank = r;
        formerDate = date;
        formerName = p.name;
      }
    });
    if (formerRank !== Number.POSITIVE_INFINITY) {
      consider(formerRank, { kind: 'former', name: formerName });
    }
  }

  // A name or ID match at the same or a better rank than the other names
  // leaves `via` unset: the row is found by its own name.
  return via ? { node, rank, via } : { node, rank };
}

/**
 * `matches` is the filter's set of CWEs (see `matchingIds`): when given, only
 * those can be found. `null` or no set means no filter.
 */
export function searchNodes(graph: Graph, query: string, matches?: Set<string> | null): SearchHit[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') {
    return [];
  }

  const lowered = loweredFor(graph);
  return graph.all
    .filter((node) => !matches || matches.has(node.id))
    .map((node) => score(node, lowered.get(node.id), trimmed))
    .filter((scored) => scored.rank !== Number.POSITIVE_INFINITY)
    .sort((a, b) => {
      // Deprecated entries are still findable, but never ahead of a live one.
      const aDeprecated = isDeprecated(a.node) ? 1 : 0;
      const bDeprecated = isDeprecated(b.node) ? 1 : 0;
      if (aDeprecated !== bDeprecated) {
        return aDeprecated - bDeprecated;
      }
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      return compareIds(a.node.id, b.node.id);
    })
    .map(({ node, via }) => (via ? { node, via } : { node }));
}
