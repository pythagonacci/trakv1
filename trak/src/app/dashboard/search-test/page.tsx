"use client";

import { useState } from "react";
import { Search, Sparkles, FileText, Loader2, Database, AlertCircle, Trash2, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWorkspace } from "@/app/dashboard/workspace-context";


export default function SearchTestPage() {
    const { currentWorkspace } = useWorkspace();
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<"search" | "answer">("answer");
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [processResult, setProcessResult] = useState<string | null>(null);
    const [status, setStatus] = useState<any>(null);

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/internal/indexing/status${currentWorkspace?.id ? `?workspaceId=${currentWorkspace.id}` : ""}`);
            const data = await res.json();
            setStatus(data);
        } catch (e) { }
    };

    useState(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    });

    const handleSearch = async () => {
        if (!query) return;
        setLoading(true);
        setResults(null);
        try {
            if (!currentWorkspace?.id) {
                setResults({ error: "No workspace selected. Please select a workspace first." });
                return;
            }

            const res = await fetch("/api/ai/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query,
                    mode,
                    workspaceId: currentWorkspace.id
                })
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setResults(data);
        } catch (e: any) {
            setResults({ error: e.message });
        } finally {
            setLoading(false);
        }
    };

    const triggerWorker = async () => {
        setProcessing(true);
        try {
            const res = await fetch("/api/internal/indexing/worker", { method: "POST" });
            const data = await res.json();
            setProcessResult(JSON.stringify(data, null, 2));
        } catch (e: any) {
            setProcessResult("Error: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold mb-2">Unstructured Search Test</h1>
                <p className="text-gray-500">Test the RAG pipeline: Ingestion, Indexing, and Search</p>
            </div>

            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-medium flex items-center gap-2">
                        <Loader2 className={`w-4 h-4 ${processing ? "animate-spin" : ""}`} />
                        Admin Actions
                    </h2>
                    {status && (
                        <div className="flex gap-2 text-[10px] items-center">
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold">
                                {status.pending} Pending
                            </span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">
                                {status.completed} Indexed
                            </span>
                            {status.failed > 0 && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">
                                    {status.failed} Failed
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="border-b pb-4">
                        <h3 className="text-sm font-medium mb-1">1. Index Existing Data</h3>
                        <p className="text-xs text-gray-600 mb-2">
                            Backfill local DB index for all existing files/blocks in this workspace.
                        </p>
                        <button
                            onClick={async () => {
                                if (!currentWorkspace?.id) return;
                                setProcessing(true);
                                try {
                                    const res = await fetch("/api/internal/indexing/backfill", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ workspaceId: currentWorkspace.id })
                                    });
                                    const data = await res.json();
                                    setProcessResult(JSON.stringify(data, null, 2));
                                } catch (e: any) {
                                    setProcessResult("Backfill Error: " + e.message);
                                } finally {
                                    setProcessing(false);
                                }
                            }}
                            disabled={processing || !currentWorkspace}
                            className="px-4 py-2 bg-white border shadow-sm rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            {processing ? "Starting Backfill..." : "Enqeue All Data"}
                        </button>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium mb-1">2. Process Queue</h3>
                        <p className="text-xs text-gray-600 mb-2">
                            Trigger the background worker manually (simulating Cron/Job).
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={triggerWorker}
                                disabled={processing}
                                className="px-4 py-2 bg-white border shadow-sm rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                {processing ? "Processing..." : "Process Once"}
                            </button>
                            <button
                                onClick={async () => {
                                    setProcessing(true);
                                    setProcessResult("Processing all jobs...");
                                    let processed = 0;
                                    try {
                                        while (true) {
                                            const res = await fetch("/api/internal/indexing/worker", { method: "POST" });
                                            const data = await res.json();

                                            // Break if no jobs were processed
                                            if (data.processed && data.processed.length === 0 && data.failed && data.failed.length === 0) {
                                                setProcessResult(`✅ Done! Processed ${processed} jobs total.`);
                                                break;
                                            }

                                            // Break if error was returned
                                            if (data.error) {
                                                setProcessResult(`Error: ${data.error}`);
                                                break;
                                            }

                                            processed += (data.processed?.length || 0);
                                            setProcessResult(`Processing... (${processed} jobs done)\n${JSON.stringify(data, null, 2)}`);

                                            // Optional: Break if server explicitly says no more remaining, 
                                            // though checking length=0 is safer for "completely empty" queue
                                            if (data.remaining === false && data.processed.length < 10) {
                                                setProcessResult(`✅ Done! Processed ${processed} jobs total.`);
                                                break;
                                            }
                                        }
                                    } catch (e: any) {
                                        setProcessResult(`Error after ${processed} jobs: ` + e.message);
                                    } finally {
                                        setProcessing(false);
                                    }
                                }}
                                disabled={processing}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                {processing ? "Processing..." : "Process All Jobs"}
                            </button>
                        </div>
                    </div>
                </div>

                {processResult && (
                    <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded mt-2 overflow-auto max-h-40">
                        {processResult}
                    </pre>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex gap-4">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask a question..."
                        className="flex-1 p-2 border rounded-md"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as any)}
                        className="p-2 border rounded-md"
                    >
                        <option value="answer">Answer</option>
                        <option value="search">Search Only</option>
                    </select>
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? "Searching..." : "Go"}
                    </button>
                </div>

                {results && (
                    <div className="space-y-4">
                        {results.error && (
                            <div className="p-4 bg-red-50 text-red-600 rounded-md">
                                {results.error}
                            </div>
                        )}

                        {results.answer && (
                            <div className="p-6 border rounded-lg bg-white shadow-sm prose max-w-none">
                                <div className="flex items-center gap-2 text-blue-600 mb-4">
                                    <Sparkles className="w-5 h-5" />
                                    <h3 className="text-lg font-medium m-0">AI Answer</h3>
                                </div>
                                <div className="markdown-answer">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {results.answer}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}

                        {results.sources && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Sources</h3>
                                {results.sources.map((source: any, i: number) => (
                                    <div key={i} className="p-3 border rounded bg-white text-sm">
                                        <div className="font-medium text-gray-900 mb-1 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            {source.source_id}
                                        </div>
                                        <p className="text-gray-600 line-clamp-2">{source.chunk_content}</p>
                                        <div className="mt-1 text-xs text-gray-400">Score: {Math.round(source.similarity * 100)}%</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
