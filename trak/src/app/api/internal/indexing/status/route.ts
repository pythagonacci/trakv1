import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get("workspaceId");

        const query = supabase.from("indexing_jobs").select("*", { count: "exact", head: true });

        if (workspaceId) {
            query.eq("workspace_id", workspaceId);
        }

        const { count: pending } = await query.eq("status", "pending");
        const { count: processing } = await supabase.from("indexing_jobs").select("*", { count: "exact", head: true }).eq("status", "processing");
        const { count: failed } = await supabase.from("indexing_jobs").select("*", { count: "exact", head: true }).eq("status", "failed");
        const { count: completed } = await supabase.from("indexing_jobs").select("*", { count: "exact", head: true }).eq("status", "completed");

        const { count: parents } = await supabase.from("unstructured_parents").select("*", { count: "exact", head: true });
        const { count: chunks } = await supabase.from("unstructured_chunks").select("*", { count: "exact", head: true });

        return NextResponse.json({
            pending,
            processing,
            failed,
            completed,
            total_indexed: {
                parents,
                chunks
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
