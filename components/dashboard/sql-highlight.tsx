"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const SQL_KEYWORDS = new Set([
  "SELECT","FROM","WHERE","GROUP","BY","ORDER","LIMIT","AS","AND","OR",
  "WITH","JOIN","LEFT","RIGHT","INNER","ON","IN","NOT","DISTINCT",
  "HAVING","COUNT","AVG","MIN","MAX","SUM","PARTITION","OVER","DESC","ASC",
  "INTERVAL","BETWEEN","CASE","WHEN","THEN","ELSE","END","UNION","ALL",
  "ROW_NUMBER","INSERT","UPDATE","DELETE","CREATE","DROP","ALTER","EXISTS",
  "CAST","IF","LIKE","IS",
]);
const SQL_LITERALS = new Set(["NULL", "TRUE", "FALSE"]);

interface Token {
  type: "keyword" | "string" | "number" | "comment" | "function" | "literal" | "text";
  value: string;
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === "'" || sql[i] === "`") {
      const quote = sql[i];
      const start = i;
      i++;
      while (i < sql.length && sql[i] !== quote) i++;
      i++;
      tokens.push({ type: "string", value: sql.slice(start, i) });
      continue;
    }

    if (sql[i] === "-" && sql[i + 1] === "-") {
      const start = i;
      while (i < sql.length && sql[i] !== "\n") i++;
      tokens.push({ type: "comment", value: sql.slice(start, i) });
      continue;
    }

    if (/\d/.test(sql[i]) && (i === 0 || /[\s,(\-+*/=<>]/.test(sql[i - 1]))) {
      const start = i;
      while (i < sql.length && /[\d.]/.test(sql[i])) i++;
      tokens.push({ type: "number", value: sql.slice(start, i) });
      continue;
    }

    if (/[a-zA-Z_]/.test(sql[i])) {
      const start = i;
      while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) i++;
      const word = sql.slice(start, i);
      const upper = word.toUpperCase();

      if (i < sql.length && sql[i] === "(") {
        tokens.push({ type: "function", value: word });
      } else if (SQL_LITERALS.has(upper)) {
        tokens.push({ type: "literal", value: word });
      } else if (SQL_KEYWORDS.has(upper)) {
        tokens.push({ type: "keyword", value: word });
      } else {
        tokens.push({ type: "text", value: word });
      }
      continue;
    }

    tokens.push({ type: "text", value: sql[i] });
    i++;
  }

  return tokens;
}

const classMap: Record<Token["type"], string> = {
  keyword: "sql-keyword",
  string: "sql-string",
  number: "sql-number",
  comment: "sql-comment",
  function: "sql-function",
  literal: "sql-literal",
  text: "",
};

export function SqlHighlight({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  const lines = sql.split("\n");

  async function copy() {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="code-surface relative">
      <button
        type="button"
        onClick={copy}
        className="absolute top-0 right-0 flex size-9 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:border-input hover:bg-surface-01 active:border-high-contrast-border active:bg-surface-02 active:opacity-80"
        title={copied ? "Copied" : "Copy SQL"}
        aria-label="Copy SQL"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
      <pre className="overflow-x-auto pr-12 font-mono">
        <code className="grid grid-cols-[auto_1fr] gap-x-4">
          {lines.map((line, lineIndex) => (
            <span key={lineIndex} className="contents">
              <span className="text-right text-muted-foreground select-none">{lineIndex + 1}</span>
              <span>
                {line === "" ? " " : tokenize(line).map((token, i) => {
                  const cls = classMap[token.type];
                  return cls ? <span key={i} className={cls}>{token.value}</span> : token.value;
                })}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
