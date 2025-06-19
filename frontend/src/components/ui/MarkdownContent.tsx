import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      components={{
        // Customize paragraph styling
        p: ({ children }) => (
          <p className="mb-2 last:mb-0">{children}</p>
        ),
        // Customize heading styles
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h3>
        ),
        // Customize list styles
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm">{children}</li>
        ),
        // Customize code styles
        code: ({ children, className }) => {
          const isInlineCode = !className;
          if (isInlineCode) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className={className}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono mb-2 border">
            {children}
          </pre>
        ),
        // Customize blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground mb-2">
            {children}
          </blockquote>
        ),
        // Customize links
        a: ({ href, children }) => (
          <a 
            href={href} 
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        // Customize tables
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full border border-border rounded-md">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="border border-border px-2 py-1 text-left text-xs font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-2 py-1 text-xs">
            {children}
          </td>
        ),
        // Customize horizontal rule
        hr: () => (
          <hr className="border-border my-4" />
        ),
        // Customize strong/bold
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        // Customize emphasis/italic
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}