import React, { type ReactNode } from 'react';

export function renderInline(text: string): ReactNode[] {
  if (!text) return [];

  // Split by inline markdown tokens: `code`, **bold**, *italic*, [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          style={{
            background: 'rgba(76,201,240,0.14)',
            border: '1px solid rgba(76,201,240,0.28)',
            padding: '2px 6px',
            borderRadius: 5,
            color: '#4cc9f0',
            fontFamily: 'monospace',
            fontSize: '0.86em',
            wordBreak: 'break-all',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} style={{ color: '#ffffff', fontWeight: 700 }}>
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) || (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
      return (
        <em key={index} style={{ fontStyle: 'italic', color: '#e2ebf8' }}>
          {renderInline(part.slice(1, -1))}
        </em>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#4cc9f0', textDecoration: 'underline' }}
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function renderMarkdown(text: string): ReactNode {
  if (!text) return null;

  // First check for code blocks (` ` ` ... ` ` `)
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const segments: string[] = [];
  const codeBlocks: { lang: string; code: string }[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push(text.slice(lastIdx, match.index));
    }
    codeBlocks.push({ lang: match[1] || '', code: match[2] || '' });
    segments.push(`__CODE_BLOCK_${codeBlocks.length - 1}__`);
    lastIdx = codeBlockRegex.lastIndex;
  }
  if (lastIdx < text.length) {
    segments.push(text.slice(lastIdx));
  }

  const lines = segments.join('').split('\n');
  const elements: ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: ReactNode[] } | null = null;

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      const isUl = currentList.type === 'ul';
      const ListTag = isUl ? 'ul' : 'ol';
      elements.push(
        <ListTag
          key={`list-${elements.length}`}
          style={{
            margin: '6px 0',
            paddingLeft: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            listStyleType: isUl ? 'disc' : 'decimal',
            color: '#dce6f5',
          }}
        >
          {currentList.items.map((item, idx) => (
            <li key={idx} style={{ lineHeight: 1.6, paddingLeft: 2 }}>
              {item}
            </li>
          ))}
        </ListTag>
      );
    }
    currentList = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    const cbMatch = trimmed.match(/^__CODE_BLOCK_(\d+)__$/);
    if (cbMatch) {
      flushList();
      const cb = codeBlocks[Number(cbMatch[1])];
      elements.push(
        <pre
          key={`cb-${i}`}
          style={{
            background: 'rgba(10, 16, 30, 0.85)',
            border: '1px solid rgba(130, 155, 190, 0.2)',
            padding: '10px 14px',
            borderRadius: 8,
            overflowX: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.84rem',
            color: '#e2ebf8',
            margin: '8px 0',
          }}
        >
          <code>{cb.code}</code>
        </pre>
      );
      continue;
    }

    // Check headings
    const h3Match = trimmed.match(/^###\s+(.*)$/);
    if (h3Match) {
      flushList();
      elements.push(
        <h4 key={`h-${i}`} style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', margin: '10px 0 4px' }}>
          {renderInline(h3Match[1])}
        </h4>
      );
      continue;
    }
    const h2Match = trimmed.match(/^##\s+(.*)$/);
    if (h2Match) {
      flushList();
      elements.push(
        <h3 key={`h-${i}`} style={{ fontSize: '1.08rem', fontWeight: 800, color: '#ffffff', margin: '12px 0 6px' }}>
          {renderInline(h2Match[1])}
        </h3>
      );
      continue;
    }
    const h1Match = trimmed.match(/^#\s+(.*)$/);
    if (h1Match) {
      flushList();
      elements.push(
        <h2 key={`h-${i}`} style={{ fontSize: '1.18rem', fontWeight: 800, color: '#ffffff', margin: '12px 0 6px' }}>
          {renderInline(h1Match[1])}
        </h2>
      );
      continue;
    }

    // Check list item (*, -, or 1.)
    const ulMatch = trimmed.match(/^([*+\-]|\u2022)\s+(.*)$/);
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(renderInline(ulMatch[2]));
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(renderInline(olMatch[2]));
      continue;
    }

    // Regular paragraph line
    flushList();
    elements.push(
      <p key={`p-${i}`} style={{ margin: '4px 0', lineHeight: 1.65 }}>
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{elements}</div>;
}
