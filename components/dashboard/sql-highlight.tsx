const SQL_KEYWORDS = new Set([
  "SELECT","FROM","WHERE","GROUP","BY","ORDER","LIMIT","AS","AND","OR",
  "WITH","JOIN","LEFT","RIGHT","INNER","ON","IN","NOT","NULL","DISTINCT",
  "HAVING","COUNT","AVG","MIN","MAX","SUM","PARTITION","OVER","DESC","ASC",
  "INTERVAL","BETWEEN","CASE","WHEN","THEN","ELSE","END","UNION","ALL",
  "ROW_NUMBER","INSERT","UPDATE","DELETE","CREATE","DROP","ALTER","EXISTS",
  "TRUE","FALSE","CAST","IF","LIKE","IS",
]);

interface Token {
  type: "keyword" | "string" | "number" | "comment" | "function" | "text";
  value: string;
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === "'" ) {
      const start = i;
      i++;
      while (i < sql.length && sql[i] !== "'") i++;
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

      if (SQL_KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ type: "keyword", value: word });
      } else if (i < sql.length && sql[i] === "(") {
        tokens.push({ type: "function", value: word });
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
  text: "",
};

export function SqlHighlight({ sql }: { sql: string }) {
  const tokens = tokenize(sql);
  return (
    <pre className="code-surface overflow-x-auto p-3 text-xs leading-relaxed">
      <code>
        {tokens.map((token, i) => {
          const cls = classMap[token.type];
          return cls ? (
            <span key={i} className={cls}>
              {token.value}
            </span>
          ) : (
            <span key={i}>{token.value}</span>
          );
        })}
      </code>
    </pre>
  );
}
