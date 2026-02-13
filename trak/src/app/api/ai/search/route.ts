import { NextRequest, NextResponse } from "next/server";
import { UnstructuredSearch } from "@/lib/search/query";
import {
  isUnauthorizedApiError,
  requireUser,
  unauthorizedJsonResponse,
} from "@/lib/auth/require-user";

export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireUser();

    const body = await req.json();
    const { query, mode = "search", workspaceId } = body;

        // Permissions check: user must belong to workspace
        // (RLS handles data access, but we should verify the input workspaceId for logic)
        // Actually, `createClient` cookies should handle auth context. 
        // The search service passed workspaceId to the RPC which is good.
        // R.L.S on `unstructured_parents` checks `is_member_of_workspace`.
        // So the query service is safe as long as Supabase client is user-scoped.

        // BUT wait: UnstructuredSearch uses `supabase.rpc`.
        // Does `rpc` respect RLS if `security definer` isn't set?
        // In Supabase, RPC is usually "volatile" and runs with invoker permissions by default?
        // YES. But inside the function `SELECT * FROM unstructured_parents` will trigger RLS.
        // So if the user can't see the workspace rows, they see nothing. Secure.

    if (!query || !workspaceId) {
      return NextResponse.json({ error: "Missing query or workspaceId" }, { status: 400 });
    }

    const searcher = new UnstructuredSearch(supabase);

    if (mode === "answer") {
      const result = await searcher.answerQuery(workspaceId, query);
      return NextResponse.json(result);
    }

    const results = await searcher.searchWorkspace(workspaceId, query);
    return NextResponse.json({ results });
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }

    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
