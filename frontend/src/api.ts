import type {
  ReviewOutput,
  ConflictReport,
  FullReviewResponse,
  ReviewWithPromptResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const data = await request<{ status: string }>("/health");
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function reviewFull(
  pr_url: string,
  max_iterations: number
): Promise<FullReviewResponse> {
  return request<FullReviewResponse>("/review/full", {
    method: "POST",
    body: JSON.stringify({ pr_url, max_iterations }),
  });
}

export async function reviewOnly(
  pr_url: string,
  max_iterations: number
): Promise<ReviewOutput> {
  return request<ReviewOutput>("/review", {
    method: "POST",
    body: JSON.stringify({ pr_url, max_iterations }),
  });
}

export async function reviewConflicts(
  pr_url: string
): Promise<ConflictReport> {
  return request<ConflictReport>("/review/conflicts", {
    method: "POST",
    body: JSON.stringify({ pr_url }),
  });
}

export async function reviewWithPrompt(
  pr_url: string,
  max_iterations: number
): Promise<ReviewWithPromptResponse> {
  return request<ReviewWithPromptResponse>("/review/with-prompt", {
    method: "POST",
    body: JSON.stringify({ pr_url, max_iterations }),
  });
}

export async function reviewStream(
  pr_url: string,
  max_iterations: number,
  onLog: (msg: string) => void
): Promise<FullReviewResponse> {
  const res = await fetch(`${BASE_URL}/review/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pr_url, max_iterations }),
  });

  if (!res.ok) {
    let errStr = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) errStr = body.detail;
    } catch (e) {}
    throw new Error(errStr);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: FullReviewResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const chunk of lines) {
      if (!chunk.trim()) continue;
      
      let eventType = "";
      let dataStr = "";
      
      const parts = chunk.split("\n");
      for (const p of parts) {
        if (p.startsWith("event: ")) eventType = p.substring(7);
        if (p.startsWith("data: ")) dataStr = p.substring(6);
      }
      
      if (eventType && dataStr) {
        const data = JSON.parse(dataStr);
        if (eventType === "log") {
          onLog(data);
        } else if (eventType === "result") {
          finalResult = data;
        } else if (eventType === "error") {
          throw new Error(data);
        }
      }
    }
  }
  
  if (!finalResult) {
    throw new Error("Stream closed without result");
  }

  return finalResult;
}

export async function generateCodeStream(
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch(`${BASE_URL}/review/generate-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      let eventType = "";
      let dataStr = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        if (line.startsWith("data: ")) dataStr = line.slice(6);
      }
      if (eventType === "chunk" && dataStr) {
        onChunk(JSON.parse(dataStr));
      } else if (eventType === "error" && dataStr) {
        throw new Error(JSON.parse(dataStr));
      }
    }
  }
}
