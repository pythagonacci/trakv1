import fs from "fs";
import path from "path";
import assert from "assert";
import crypto from "crypto";
import XLSX from "xlsx";
import { extractFileContent } from "@/lib/file-analysis/extractor";
import { shouldUseRag } from "@/lib/file-analysis/service";
import { selectFilesForQuery } from "@/lib/file-analysis/selection";
import { setTestUserContext } from "@/lib/auth-utils";
import { saveFileAnalysisAsBlock, saveFileAnalysisAsComment } from "@/app/actions/file-analysis";
import { createClient } from "@supabase/supabase-js";

async function testParsing() {
  const fixtures = path.join(process.cwd(), "scripts/fixtures/file-analysis");
  const csvBuffer = fs.readFileSync(path.join(fixtures, "sample.csv"));
  const pdfBuffer = fs.readFileSync(path.join(fixtures, "sample.pdf"));
  const docxBuffer = fs.readFileSync(path.join(fixtures, "sample.docx"));

  const csvResult = await extractFileContent({
    buffer: csvBuffer,
    fileName: "sample.csv",
    fileType: "text/csv",
  });
  assert(csvResult.tables.length > 0, "CSV should produce table data");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "amount"],
    ["A", 10],
    ["B", 20],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const xlsxResult = await extractFileContent({
    buffer: Buffer.from(xlsxBuffer),
    fileName: "sample.xlsx",
    fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  assert(xlsxResult.tables.length > 0, "XLSX should produce table data");

  const pdfResult = await extractFileContent({
    buffer: pdfBuffer,
    fileName: "sample.pdf",
    fileType: "application/pdf",
  });
  assert(pdfResult.text.includes("Hello"), "PDF should extract text");

  const docxResult = await extractFileContent({
    buffer: docxBuffer,
    fileName: "sample.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  assert(docxResult.text.includes("Hello DOCX"), "DOCX should extract text");

  console.log("OK: Parsing tests passed");
}

function testThresholds() {
  assert(
    shouldUseRag({ fileSize: 10, tokenEstimate: 100, rowCount: 10, pageCount: 1 }) === false,
    "Small file should not use RAG"
  );
  assert(
    shouldUseRag({ fileSize: 5 * 1024 * 1024, tokenEstimate: 100, rowCount: 10, pageCount: 1 }) === true,
    "Large file size should use RAG"
  );
  console.log("OK: Threshold tests passed");
}

function testSelection() {
  const mockFile = (id: string, name: string) => ({
    id,
    file_name: name,
    file_size: 10,
    file_type: "text/csv",
    storage_path: "",
    workspace_id: "w",
    project_id: "p",
    created_at: new Date().toISOString(),
    source: "session" as const,
    is_attached: true,
  });

  const result = selectFilesForQuery({
    message: "Analyze sales",
    sessionFiles: [mockFile("1", "sales_q1.csv"), mockFile("2", "sales_q2.csv")],
    tabFiles: [],
    projectFiles: [],
    workspaceFiles: [],
  });
  assert(result.clarification, "Should request clarification when multiple uploads exist");

  const explicit = selectFilesForQuery({
    message: "Use sales_q1",
    sessionFiles: [mockFile("1", "sales_q1.csv"), mockFile("2", "sales_q2.csv")],
    tabFiles: [],
    projectFiles: [],
    workspaceFiles: [],
  });
  assert(explicit.selectedFiles.length === 1, "Should select explicit file match");

  console.log("OK: Selection tests passed");
}

async function testSaveActions() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.log("SKIP: save action tests (missing Supabase env vars)");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    console.log("SKIP: save action tests (no workspace membership found)");
    return;
  }

  const workspaceId = membership.workspace_id;
  const userId = membership.user_id;

  process.env.ENABLE_TEST_MODE = "true";
  await setTestUserContext(userId);

  const projectId = crypto.randomUUID();
  const { data: project } = await supabase
    .from("projects")
    .insert({
      id: projectId,
      workspace_id: workspaceId,
      name: "File Analysis Test",
      status: "not_started",
      project_type: "project",
    })
    .select("id")
    .single();

  const { data: tab } = await supabase
    .from("tabs")
    .insert({
      project_id: projectId,
      name: "File Analysis",
      position: 0,
    })
    .select("id")
    .single();

  const fileId = crypto.randomUUID();
  await supabase
    .from("files")
    .insert({
      id: fileId,
      workspace_id: workspaceId,
      project_id: projectId,
      uploaded_by: userId,
      file_name: "sample.csv",
      file_size: 20,
      file_type: "text/csv",
      storage_path: `tests/${fileId}.csv`,
    });

  const { data: block } = await supabase
    .from("blocks")
    .insert({
      tab_id: tab.id,
      type: "text",
      content: { text: "Test" },
      position: 0,
      column: 0,
      is_template: false,
    })
    .select("id")
    .single();

  await supabase
    .from("file_attachments")
    .insert({
      file_id: fileId,
      block_id: block.id,
      display_mode: "inline",
    });

  const { data: session } = await supabase
    .from("file_analysis_sessions")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      tab_id: tab.id,
      user_id: userId,
      scope_type: "tab",
    })
    .select("id")
    .single();

  const { data: message } = await supabase
    .from("file_analysis_messages")
    .insert({
      session_id: session.id,
      role: "assistant",
      content: { text: "Test summary" },
    })
    .select("id")
    .single();

  const blockResult = await saveFileAnalysisAsBlock({ messageId: message.id, tabId: tab.id });
  assert("data" in blockResult, "Save as block should succeed");

  const commentResult = await saveFileAnalysisAsComment({ messageId: message.id, fileId });
  assert("data" in commentResult, "Save as comment should succeed");

  console.log("OK: Save action tests passed");
}

async function run() {
  await testParsing();
  testThresholds();
  testSelection();
  await testSaveActions();
}

run().catch((error) => {
  console.error("FAIL: File analysis tests failed", error);
  process.exit(1);
});
