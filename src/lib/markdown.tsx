import type { ReactNode } from 'react';

function parseInline(line: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : (part as ReactNode)
  );
}

function parseTableCells(line: string) {
  return line.split('|').map(c => c.trim()).filter((_, i, arr) => i !== 0 && i !== arr.length - 1);
}

const isTableLine = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');
const isSeparatorLine = (line: string) => /^\|[\s|:-]+\|$/.test(line.trim());

/** Renders a constrained markdown subset (bold, headings, bullet lists, pipe tables) used by AI chat responses. */
export function renderMarkdown(text: string): ReactNode {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let tableLines: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="my-1 ml-4 list-disc space-y-0.5">
          {listItems.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const headers = parseTableCells(tableLines[0]);
      const rows = tableLines.slice(2).map(parseTableCells);
      elements.push(
        <div key={elements.length} className="my-2 overflow-x-auto rounded-lg border border-outline-variant/50">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-high">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-on-surface">{parseInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-outline-variant/30 even:bg-surface-container-lowest/50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-on-surface">{parseInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableLines = [];
  };

  lines.forEach((line, idx) => {
    if (isTableLine(line)) {
      flushList();
      if (!isSeparatorLine(line)) tableLines.push(line);
      else tableLines.push(line);
    } else {
      flushTable();
      if (line.startsWith('- ') || line.startsWith('* ')) {
        listItems.push(line.slice(2));
      } else {
        flushList();
        if (line.startsWith('### ')) {
          elements.push(<p key={idx} className="font-semibold mt-2">{parseInline(line.slice(4))}</p>);
        } else if (line.startsWith('## ')) {
          elements.push(<p key={idx} className="font-bold mt-2">{parseInline(line.slice(3))}</p>);
        } else if (line.trim() === '') {
          elements.push(<div key={idx} className="h-1" />);
        } else {
          elements.push(<p key={idx} className="leading-relaxed">{parseInline(line)}</p>);
        }
      }
    }
  });
  flushList();
  flushTable();
  return <div className="space-y-0.5">{elements}</div>;
}
