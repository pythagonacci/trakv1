
import { createClient } from "@supabase/supabase-js";
import type { ExecutionContext, ExecutionResult } from "@/lib/ai/executor";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// CONFIG
// ============================================================================

// Force timing on
process.env.AI_TIMING = '1';
process.env.ENABLE_TEST_MODE = 'true';

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line) => {
        line = line.trim();
        if (line && !line.startsWith("#")) {
            const [key, ...valueParts] = line.split("=");
            if (key && valueParts.length > 0) {
                let value = valueParts.join("=").trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key.trim()] = value;
            }
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

// Global supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// COMMANDS
// ============================================================================

const SIMPLE_COMMANDS = [
    // "Show my tasks",
    "List projects",
    // "Search tables named roadmap",
    // "Find tasks assigned to Amna",
    // "Show timeline events for this project"
];

const COMPLEX_COMMANDS: string[] = [
    // "Create a table of Q1 tasks by priority and populate 10 rows",
    // "Move all high-priority tasks to done",
    // "Create a task board from tasks assigned to Amna",
    // "Update table rows where Status=Blocked to In Progress",
    "Create a project, add a tab, and add a table"
];

// ============================================================================
// CONTEXT SETUP
// ============================================================================

let testContext: any;

async function setupContext() {
    console.log("Setting up context...");

    // Find a user
    const { data: users } = await supabase.from("profiles").select("id, name, email").limit(1);
    if (!users?.length) throw new Error("No users found");
    const user = users[0];

    // Find a workspace
    const { data: workspaces } = await supabase.from("workspace_members")
        .select("workspace_id, workspaces(id, name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    if (!workspaces) throw new Error("No workspace found for user");

    const ws = Array.isArray(workspaces.workspaces) ? workspaces.workspaces[0] : workspaces.workspaces;

    // Find a project to be "current" project
    const { data: projects } = await supabase.from("projects")
        .select("id")
        .eq("workspace_id", ws.id)
        .limit(1);

    const projectId = projects?.[0]?.id;

    testContext = {
        workspaceId: ws.id,
        workspaceName: ws.name,
        userId: user.id,
        userName: user.name || user.email || "Test User",
        currentProjectId: projectId
    };

    console.log(`Context: User=${user.email}, WS=${ws.name}`);
}

// ============================================================================
// EXECUTION
// ============================================================================

// Intercept console.log to capture AI TIMING
const originalLog = console.log;
let capturedTimings: any[] = [];

console.log = (...args) => {
    const msg = args.join(" ");
    if (msg.includes("[AI TIMING]")) {
        try {
            const jsonStr = msg.replace("[AI TIMING] ", "");
            capturedTimings.push(JSON.parse(jsonStr));
        } catch (e) {
            // ignore
        }
    }
    originalLog(...args);
};

async function runBenchmark() {
    const { executeAICommand } = await import("@/lib/ai/executor");
    await setupContext();

    const results = {
        simple: [] as any[],
        complex: [] as any[]
    };

    console.log("\n=== RUNNING SIMPLE COMMANDS ===");
    for (const cmd of SIMPLE_COMMANDS) {
        console.log(`\nExecuting: "${cmd}"`);
        capturedTimings = [];
        const start = Date.now();

        try {
            const res = await executeAICommand(cmd, testContext, []);
            const totalTime = Date.now() - start;
            const timing = capturedTimings[0] || {}; // Should be one timing per command usually

            results.simple.push({
                command: cmd,
                totalTime,
                timing,
                success: res.success,
                responseLength: res.response?.length
            });
        } catch (e) {
            console.error("Error executing:", e);
            results.simple.push({ command: cmd, error: String(e) });
        }
    }

    console.log("\n=== RUNNING COMPLEX COMMANDS ===");
    for (const cmd of COMPLEX_COMMANDS) {
        console.log(`\nExecuting: "${cmd}"`);
        capturedTimings = [];
        const start = Date.now();

        try {
            const res = await executeAICommand(cmd, testContext, []);
            const totalTime = Date.now() - start;
            const timing = capturedTimings[0] || {};

            results.complex.push({
                command: cmd,
                totalTime,
                timing,
                success: res.success,
                responseLength: res.response?.length
            });
        } catch (e) {
            console.error("Error executing:", e);
            results.complex.push({ command: cmd, error: String(e) });
        }
    }

    // Restore console
    console.log = originalLog;

    // Output JSON report
    console.log("\n\n=== BENCHMARK REPORT JSON ===");
    console.log(JSON.stringify(results, null, 2));
    console.log("=== END REPORT ===");

    // Write to file as well
    fs.writeFileSync("benchmark_results.json", JSON.stringify(results, null, 2));
}

runBenchmark().catch(console.error);
