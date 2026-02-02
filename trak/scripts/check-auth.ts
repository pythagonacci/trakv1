import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
envContent.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
    }
});

async function check() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const userId = "af951fd0-523f-41bb-a35e-08e17dccda03";
    const workspaceId = "4e52f23e-915d-4673-aac2-b4b485eeb276";
    
    const { data: membership, error } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();
        
    console.log("Membership:", membership);
    console.log("Error:", error);
    
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    console.log("User:", user?.user?.email);
    console.log("User Error:", userError);
}

check();
