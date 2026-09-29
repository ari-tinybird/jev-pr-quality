export interface QueryResult {
  meta: { name: string; type: string }[];
  data: Record<string, unknown>[];
  rows: number;
  statistics: { elapsed: number; rows_read: number; bytes_read: number };
}

export const RAWTREE_API_URL = "https://api.rawtree.com";

export async function runQuery(
  endpoint: string,
  apiKey: string,
  sql: string
): Promise<QueryResult> {
  const url = endpoint.replace(/\/+$/, "") + "/v1/query";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Query failed (${res.status}): ${body}`);
  }

  return res.json();
}

export interface RawtreeConfig {
  endpoint: string;
  apiKey: string;
}
