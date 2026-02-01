
import { createClient } from "@supabase/supabase-js";
import { IndexingQueue } from "../src/lib/search/job-queue";
import { ResourceIndexer } from "../src/lib/search/indexer";
import { UnstructuredSearch } from "../src/lib/search/query";
import fs from "fs";
import path from "path";

// Load env (Node 20+ style or manual)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
}

// Mock Supabase Client (Service Role for Setup, User for Query)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Env keys");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log("🚀 Starting Unstructured RAG Test...");

    // 1. Setup Data: Create a Fake File
    const workspaceId = "00000000-0000-0000-0000-000000000000"; // Replace with real one if needed, or use service role bypass
    // Actually, RLS will fail for 0000... if we enforce FK.
    // Let's rely on finding a valid workspace or creating one.
    // For simplicity, I'll fetch the first workspace.

    const { data: workspaces } = await supabaseAdmin.from("workspaces").select("id").limit(1);
    if (!workspaces || workspaces.length === 0) {
        throw new Error("No workspaces found. Cannot test.");
    }
    const realWorkspaceId = workspaces[0].id;
    console.log("Using Workspace:", realWorkspaceId);

    // Create a dummy Text Block to index (easier than file upload mock)
    // We need a valid Tab/Project usually.
    // Let's check for a tab.
    const { data: tabs } = await supabaseAdmin.from("tabs").select("id, project_id").eq("workspace_id", realWorkspaceId).limit(1);
    // Actually tabs don't have workspace_id directly usually? Schema says: projects->workspace.
    // Let's find a project.
    const { data: projects } = await supabaseAdmin.from("projects").select("id").eq("workspace_id", realWorkspaceId).limit(1);
    if (!projects?.length) throw new Error("No projects found");
    const projectId = projects[0].id;

    const { data: realTabs } = await supabaseAdmin.from("tabs").select("id").eq("project_id", projectId).limit(1);
    if (!realTabs?.length) throw new Error("No tabs found");
    const tabId = realTabs[0].id;

    const blockId = crypto.randomUUID();
    const testContent = "The project code name is Project Firefly. It launches in December 2025. Key stakeholders are Sarah and Mike.";

    // Insert Block
    const { error: blockError } = await supabaseAdmin.from("blocks").insert({
        id: blockId,
        tab_id: tabId,
        type: "text",
        content: testContent,
        position: 0
    });

    if (blockError) {
        console.error("Block insert failed", blockError);
        // Might fail if generic text block schema differs, but let's try.
        // If fail, we assume block table structure from schema doc.
    }
    console.log("Created Mock Block:", blockId);

    // 2. Enqueue Job
    const queue = new IndexingQueue(supabaseAdmin);
    const jobId = await queue.enqueue({
        workspaceId: realWorkspaceId,
        resourceType: "block",
        resourceId: blockId
    });
    console.log("Enqueued Job:", jobId);

    // 3. Process Job (Simulate Worker)
    const indexer = new ResourceIndexer(supabaseAdmin);
    const job = await queue.pickNextJob();
    if (job && job.id === jobId) {
        console.log("Picked Job. Processing...");
        await indexer.processJob(job);
        await queue.completeJob(job.id);
        console.log("Job Completed.");
    } else {
        console.warn("Could not pick the specific job (maybe picked another one)");
    }

    // 4. Validate Index
    const { data: parent } = await supabaseAdmin.from("unstructured_parents")
        .select("*")
        .eq("source_id", blockId)
        .single();

    console.log("Parent Index Created:", !!parent);
    if (parent) {
        console.log("Parent Summary:", parent.summary);

        const { count } = await supabaseAdmin.from("unstructured_chunks")
            .select("*", { count: 'exact' })
            .eq("parent_id", parent.id);
        console.log("Chunks Created:", count);
    }

    // 5. Search (using Admin to bypass RLS for test, or user)
    // Testing logic class directly
    const searcher = new UnstructuredSearch(supabaseAdmin);

    console.log("Searching for 'Firefly'...");
    const results = await searcher.searchWorkspace(realWorkspaceId, "Firefly");
    console.log("Search Results:", results.length);
    if (results.length > 0) {
        console.log("Top Result:", results[0].summary);
    }

    console.log("Asking Question: 'When does it launch?'");
    const answer = await searcher.answerQuery(realWorkspaceId, "When does it launch?");
    console.log("Answer:", answer.answer);

    // Cleanup
    console.log("Cleaning up...");
    await supabaseAdmin.from("blocks").delete().eq("id", blockId);
    await supabaseAdmin.from("unstructured_parents").delete().eq("source_id", blockId);
    // Jobs cascade? No, manual clean
    if (jobId) await supabaseAdmin.from("indexing_jobs").delete().eq("id", jobId);

    console.log("Done.");
}

runTest().catch(console.error);
