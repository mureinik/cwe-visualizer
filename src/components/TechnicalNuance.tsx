import type { NuanceBlock, NuanceLine } from '../lib/cwe-data';

// The content is static per CWE, so array indices are stable keys.
function Line({ line }: { line: NuanceLine }) {
  return (
    <span className="technical-nuance__line">
      {line.map((run, i) => (run.bold ? <strong key={i}>{run.text}</strong> : run.text))}
    </span>
  );
}

function Lines({ lines }: { lines: NuanceLine[] }) {
  return lines.map((line, i) => <Line key={i} line={line} />);
}

/** MITRE's Technical_Nuance, behind a disclosure that starts closed. */
export function TechnicalNuance({ blocks }: { blocks: NuanceBlock[] }) {
  return (
    <details className="technical-nuance">
      <summary className="technical-nuance__summary">Technical nuance</summary>
      {blocks.map((block, i) =>
        block.kind === 'paragraph' ? (
          <p key={i} className="technical-nuance__paragraph">
            <Lines lines={block.lines} />
          </p>
        ) : (
          <ul key={i} className="technical-nuance__list">
            {block.items.map((item, j) => (
              <li key={j}>
                <Lines lines={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </details>
  );
}
