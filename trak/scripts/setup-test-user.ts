/**
 * Setup Test User
 *
 * Ensures the test user is properly configured as a workspace member
 * Run with: npx tsx scripts/setup-test-user.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        let value = valueParts.join("=").trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key.trim()] = value;
      }
    }
  });
}

// Enable test mode
process.env.ENABLE_TEST_MODE = 'true';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTestUser() {
  console.log("🔧 Setting up test user for AI testing...\n");

  // Get first user
  const { data: users, error: userError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error("❌ No users found");
    process.exit(1);
  }

  const user = users[0];
  console.log(`Found user: ${user.name || user.email} (${user.id})`);

  // Find test workspace
  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name")
    .ilike("name", "%test%")
    .limit(1);

  let workspaceId: string;
  let workspaceName: string;

  if (workspaces && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
    workspaceName = workspaces[0].name;
    console.log(`Found test workspace: ${workspaceName} (${workspaceId})`);
  } else {
    // Get any workspace the user is already a member of
    const { data: membership, error: memError } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (memError || !membership) {
      console.error("❌ User has no workspace memberships");
      process.exit(1);
    }

    const workspace = Array.isArray(membership.workspaces)
      ? membership.workspaces[0]
      : membership.workspaces as any;

    workspaceId = workspace.id;
    workspaceName = workspace.name;
    console.log(`Using existing workspace: ${workspaceName} (${workspaceId})`);
  }

  // Check if user is already a member
  const { data: existing, error: checkError } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (checkError) {
    console.error("❌ Error checking membership:", checkError.message);
    process.exit(1);
  }

  if (existing) {
    console.log(`✅ User is already a member (role: ${existing.role})`);
  } else {
    // Add user as owner
    const { error: insertError } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        role: "owner",
      });

    if (insertError) {
      console.error("❌ Error adding membership:", insertError.message);
      process.exit(1);
    }

    console.log("✅ Added user as workspace owner");
  }

  console.log("\n✅ Test user setup complete!");
  console.log(`   User: ${user.email}`);
  console.log(`   Workspace: ${workspaceName}`);
  console.log(`   Workspace ID: ${workspaceId}`);
}

setupTestUser().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
