
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: workspaces, error: wsError } = await supabase.from('workspaces').select('id, name');
    const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email').limit(1);

    return NextResponse.json({
        workspaces,
        profiles,
        wsError,
        pError
    });
}
