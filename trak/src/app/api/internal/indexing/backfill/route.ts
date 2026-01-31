import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IndexingQueue } from "@/lib/search/job-queue";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { workspaceId } = body;

        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }

        // Verify membership
        const { data: member } = await supabase
            .from("workspace_members")
            .select("role")
            .eq("workspace_id", workspaceId)
            .eq("user_id", user.id)
            .single();

        if (!member) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const queue = new IndexingQueue(supabase);
        const jobsToEnqueue: Array<{ workspaceId: string; resourceType: string; resourceId: string }> = [];

        // 1. Fetch all Blocks
        const { data: blocks } = await supabase
            .from("blocks")
            .select("id")
            .eq("workspace_id", workspaceId) // Correct index check
            .limit(1000);

        if (blocks) {
            blocks.forEach(block => jobsToEnqueue.push({
                workspaceId,
                resourceType: "block",
                resourceId: block.id
            }));
        }

        // 2. Fetch all Files
        const { data: files } = await supabase
            .from("files")
            .select("id")
            .eq("workspace_id", workspaceId)
            .limit(1000);

        if (files) {
            files.forEach(file => jobsToEnqueue.push({
                workspaceId,
                resourceType: "file",
                resourceId: file.id
            }));
        }

        // 3. Fetch all Tables
        const { data: tables } = await supabase
            .from("tables")
            .select("id")
            .eq("workspace_id", workspaceId)
            .limit(1000);

        if (tables) {
            tables.forEach(table => jobsToEnqueue.push({
                workspaceId,
                resourceType: "table",
                resourceId: table.id
            }));
        }

        // Bulk Enqueue
        if (jobsToEnqueue.length > 0) {
            await queue.bulkEnqueue(jobsToEnqueue);
        }

        return NextResponse.json({
            success: true,
            message: `Enqueued ${jobsToEnqueue.length} items for indexing`,
            count: jobsToEnqueue.length
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
