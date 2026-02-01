
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SCENARIOS = [
    {
        name: "Baseline: Create Project",
        command: "Create a project named 'Benchmark Project'"
    },
    {
        name: "Complex: Task + Assign + Priority",
        command: "Create a task called 'Benchmark Task', assign it to Amna, and set priority to High"
    }
];
const ITERATIONS = 1;

// ... (comments remain same)

async function runBenchmark() {
    console.log(`Starting benchmark against ${BASE_URL}...\n`);

    // Need a session cookie. I'll grab one from the browser or env var.
    const cookie = process.env.COOKIE || "";
    if (!cookie) {
        console.warn("WARNING: No COOKIE environment variable provided. Assuming server is in bypass mode or public.");
    }

    const allResults: Record<string, any> = {};

    for (const scenario of SCENARIOS) {
        console.log(`=== Scenario: ${scenario.name} ===`);
        console.log(`Command: "${scenario.command}"`);

        const results: { total: number; breakdown?: any }[] = [];

        for (let i = 0; i < ITERATIONS; i++) {
            const start = Date.now();
            try {
                const res = await fetch(`${BASE_URL}/api/ai`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Cookie": cookie,
                        "X-Benchmark": "true"
                    },
                    body: JSON.stringify({
                        command: scenario.command,
                        conversationHistory: []
                    })
                });

                const total = Date.now() - start;

                if (!res.ok) {
                    console.error(`Request ${i + 1} failed: ${res.status} ${res.statusText}`);
                    const text = await res.text();
                    console.error(text);
                    continue;
                }

                const data = await res.json();
                const serverTiming = (data as any)._timing;

                console.log(`Iteration ${i + 1}: Client=${total}ms, Server=${serverTiming?.t_api_total_ms ?? "?"}ms`);
                console.log("Full Server Timing:", JSON.stringify(serverTiming, null, 2));
                results.push({ total, breakdown: serverTiming });

            } catch (err) {
                console.error(`Request ${i + 1} error:`, err);
            }
        }

        if (results.length > 0) {
            const times = results.map(r => r.total).sort((a, b) => a - b);
            const p50 = times[Math.floor(times.length * 0.5)];
            const executorTimes = results.map(r => r.breakdown?.t_executor_ms || 0).sort((a, b) => a - b);
            const llm1Times = results.map(r => r.breakdown?.t_llm1_ms || 0).sort((a, b) => a - b);
            const toolTimes = results.map(r => r.breakdown?.t_tools_total_ms || 0).sort((a, b) => a - b);

            console.log(`\n-- Stats for ${scenario.name} --`);
            console.log(`Total (Client): ${p50}ms`);
            console.log(`Executor:       ${executorTimes[Math.floor(executorTimes.length * 0.5)]}ms`);
            console.log(`LLM Call 1:     ${llm1Times[Math.floor(llm1Times.length * 0.5)]}ms`);
            console.log(`Tools:          ${toolTimes[Math.floor(toolTimes.length * 0.5)]}ms`);
            console.log("\n");
        }
    }
}

runBenchmark();
