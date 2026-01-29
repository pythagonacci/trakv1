"use client";

import { useState } from "react";

export default function QAClient() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Request failed");
      }
      setAnswer(data.answer || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quick Q&A</h1>
        <p className="text-sm text-neutral-500">Ask a question. Get a response.</p>
      </div>

      <div className="space-y-3">
        <textarea
          className="w-full min-h-[140px] rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          placeholder="Type your question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={ask}
            disabled={loading || !question.trim()}
          >
            {loading ? "Asking..." : "Ask"}
          </button>
          <button
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700 disabled:opacity-60"
            onClick={() => {
              setQuestion("");
              setAnswer("");
              setError(null);
            }}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 min-h-[140px]">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : answer ? (
          <p className="whitespace-pre-wrap text-sm text-neutral-900">{answer}</p>
        ) : (
          <p className="text-sm text-neutral-400">Answer will appear here.</p>
        )}
      </div>
    </div>
  );
}
