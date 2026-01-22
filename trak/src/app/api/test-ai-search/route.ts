"use server";

import { NextRequest } from "next/server";
import {
  searchBlocks,
  searchProjects,
  searchTasks,
} from "@/app/actions/ai-search";
import {
  getProjectWithContext,
  getTaskWithContext,
} from "@/app/actions/ai-context";

export async function GET(_request: NextRequest) {
  console.log("\n🧪 STARTING AI SEARCH TESTS\n");

  const results = { total: 0, passed: 0, failed: 0 };

  try {
    const r = await searchTasks({ status: "todo", limit: 5 });
    console.log(r.error ? "❌ searchTasks failed" : `✅ searchTasks: ${r.data?.length ?? 0} tasks`);
    r.error ? results.failed++ : results.passed++;
  } catch (error) {
    console.log("❌ searchTasks exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const r = await searchProjects({ limit: 5 });
    console.log(r.error ? "❌ searchProjects failed" : `✅ searchProjects: ${r.data?.length ?? 0} projects`);
    r.error ? results.failed++ : results.passed++;
  } catch (error) {
    console.log("❌ searchProjects exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const r = await searchBlocks({ type: "text", limit: 5 });
    console.log(r.error ? "❌ searchBlocks failed" : `✅ searchBlocks: ${r.data?.length ?? 0} blocks`);
    r.error ? results.failed++ : results.passed++;
  } catch (error) {
    console.log("❌ searchBlocks exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const search = await searchTasks({ limit: 1 });
    if (search.data?.[0]) {
      const r = await getTaskWithContext({ taskId: search.data[0].id });
      if (r.error) {
        console.log("❌ getTaskWithContext failed");
        results.failed++;
      } else {
        console.log(`✅ getTaskWithContext: ${r.data?.task.title}`);
        console.log(`   Assignees: ${r.data?.assignees.length ?? 0}, Tags: ${r.data?.tags.length ?? 0}`);
        results.passed++;
      }
    } else {
      console.log("⚠️  getTaskWithContext skipped (no tasks)");
    }
  } catch (error) {
    console.log("❌ getTaskWithContext exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const search = await searchProjects({ limit: 1 });
    if (search.data?.[0]) {
      const r = await getProjectWithContext({ projectId: search.data[0].id });
      if (r.error) {
        console.log("❌ getProjectWithContext failed");
        results.failed++;
      } else {
        console.log(`✅ getProjectWithContext: ${r.data?.project.name}`);
        console.log(`   Tabs: ${r.data?.tabs.length ?? 0}, Tasks: ${r.data?.taskSummary.total ?? 0}`);
        results.passed++;
      }
    } else {
      console.log("⚠️  getProjectWithContext skipped (no projects)");
    }
  } catch (error) {
    console.log("❌ getProjectWithContext exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const projectSearch = await searchProjects({ searchText: "feature test", limit: 1 });
    const project = projectSearch.data?.[0];
    if (!project) {
      console.log("⚠️  medium priority tasks test skipped (project not found)");
    } else {
      const r = await searchTasks({ projectId: project.id, priority: "medium", limit: 50 });
      console.log(
        r.error
          ? "❌ medium priority tasks test failed"
          : `✅ medium priority tasks in \"${project.name}\": ${r.data?.length ?? 0}`
      );
      r.error ? results.failed++ : results.passed++;
    }
  } catch (error) {
    console.log("❌ medium priority tasks test exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const search = await searchProjects({ limit: 1 });
    const context = search.data?.[0]
      ? await getProjectWithContext({ projectId: search.data[0].id })
      : null;
    if (context?.data) {
      console.log("✅ Integration: Search → Context works");
      results.passed++;
    } else {
      console.log("❌ Integration failed");
      results.failed++;
    }
  } catch (error) {
    console.log("❌ Integration exception:", error);
    results.failed++;
  }
  results.total++;

  console.log(
    `\n📊 SUMMARY: ${results.passed}/${results.total} passed${
      results.failed > 0 ? ` (${results.failed} failed)` : ""
    }`
  );
  console.log(results.failed === 0 ? "🎉 ALL TESTS PASSED!\n" : "⚠️  SOME TESTS FAILED\n");

  return Response.json({
    success: results.failed === 0,
    message: results.failed === 0 ? "All tests passed!" : "Some tests failed. Check terminal.",
    results,
  });
}
