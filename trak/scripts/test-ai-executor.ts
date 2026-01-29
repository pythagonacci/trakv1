/**
 * AI Executor Test Harness
 *
 * Systematically tests the Prompt-to-Action AI by running natural language commands
 * and validating the results. Runs directly against the executor (no HTTP API).
 *
 * Run with: npx tsx scripts/test-ai-executor.ts [suite-name]
 * Examples:
 *   npx tsx scripts/test-ai-executor.ts              # Run all suites
 *   npx tsx scripts/test-ai-executor.ts single-tool  # Run specific suite
 */

import { createClient } from "@supabase/supabase-js";
import { executeAICommand, type ExecutionContext } from "@/lib/ai/executor";
import type { ExecutionResult } from "@/lib/ai/executor";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// LOAD ENVIRONMENT VARIABLES
// ============================================================================

// Load .env.local if it exists
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        let value = valueParts.join("=").trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key.trim()] = value;
      }
    }
  });
}

// Enable test mode for all test context features
process.env.ENABLE_TEST_MODE = 'true';

// ============================================================================
// SETUP
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error("❌ Missing AI API key");
  console.error("Required: DEEPSEEK_API_KEY or OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// TYPES
// ============================================================================

export interface TestCase {
  name: string;
  command: string;
  expectedTools?: string[]; // Tools we expect the AI to call
  expectedOutcome?: string; // Description of expected result
  context?: Partial<ExecutionContext>; // Additional context
  validate?: (result: ExecutionResult) => Promise<ValidationResult>;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  description: string;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  tests: TestCase[];
}

export interface TestResult {
  suiteName: string;
  testName: string;
  command: string;
  success: boolean;
  aiResponse: string;
  toolsCalled: string[];
  expectedTools?: string[];
  validationResult?: ValidationResult;
  error?: string;
  executionTime: number;
}

export interface TestReport {
  totalSuites: number;
  totalTests: number;
  passed: number;
  failed: number;
  suites: {
    name: string;
    passed: number;
    failed: number;
    results: TestResult[];
  }[];
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

let testWorkspaceId: string;
let testUserId: string;
let testWorkspaceName: string;
let testUserName: string;

/**
 * Initialize test context by finding or creating test workspace
 */
async function initializeTestContext() {
  console.log("🔧 Initializing test context...\n");

  // Get first available user (assuming we're in dev environment)
  const { data: users, error: userError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .limit(1);

  if (userError || !users || users.length === 0) {
    throw new Error("No users found in database. Please create a user first.");
  }

  testUserId = users[0].id;
  testUserName = users[0].name || users[0].email || "Test User";

  // Find or create a test workspace
  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name")
    .ilike("name", "%test%")
    .limit(1);

  if (wsError) {
    throw new Error(`Error finding workspace: ${wsError.message}`);
  }

  if (workspaces && workspaces.length > 0) {
    testWorkspaceId = workspaces[0].id;
    testWorkspaceName = workspaces[0].name;
    console.log(`✅ Using existing workspace: ${testWorkspaceName} (${testWorkspaceId})`);
  } else {
    // Use first available workspace
    const { data: anyWorkspace, error: anyWsError } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name)")
      .eq("user_id", testUserId)
      .limit(1)
      .single();

    if (anyWsError || !anyWorkspace) {
      throw new Error("No workspaces found. Please create a workspace first.");
    }

    const workspace = Array.isArray(anyWorkspace.workspaces)
      ? anyWorkspace.workspaces[0]
      : anyWorkspace.workspaces as any;

    testWorkspaceId = workspace.id;
    testWorkspaceName = workspace.name;
    console.log(`✅ Using workspace: ${testWorkspaceName} (${testWorkspaceId})`);
  }

  console.log(`✅ Using user: ${testUserName} (${testUserId})`);
  console.log();
}

/**
 * Execute a single test case
 */
async function runTest(
  suite: TestSuite,
  test: TestCase
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Build execution context
    const context: ExecutionContext = {
      workspaceId: testWorkspaceId,
      userId: testUserId,
      workspaceName: testWorkspaceName,
      userName: testUserName,
      ...test.context,
    };

    // Execute AI command
    const result = await executeAICommand(test.command, context, []);

    // Extract tools called
    const toolsCalled = result.toolCallsMade?.map((tc) => tc.tool) || [];

    // Run custom validation if provided
    let validationResult: ValidationResult | undefined;
    if (test.validate) {
      validationResult = await test.validate(result);
    }

    // Determine success
    let success = result.success;

    // Check if expected tools were called (if specified)
    if (test.expectedTools && test.expectedTools.length > 0) {
      const allToolsUsed = test.expectedTools.every((tool) =>
        toolsCalled.includes(tool)
      );
      if (!allToolsUsed) {
        success = false;
      }
    }

    // Override with validation result if provided
    if (validationResult) {
      success = validationResult.passed;
    }

    return {
      suiteName: suite.name,
      testName: test.name,
      command: test.command,
      success,
      aiResponse: result.response,
      toolsCalled,
      expectedTools: test.expectedTools,
      validationResult,
      error: result.error,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      suiteName: suite.name,
      testName: test.name,
      command: test.command,
      success: false,
      aiResponse: "",
      toolsCalled: [],
      expectedTools: test.expectedTools,
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Execute a test suite
 */
async function runSuite(suite: TestSuite): Promise<TestResult[]> {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📦 Test Suite: ${suite.name}`);
  console.log(`   ${suite.description}`);
  console.log(`${"=".repeat(80)}\n`);

  // Run setup if provided
  if (suite.setup) {
    console.log("🔧 Running suite setup...\n");
    await suite.setup();
  }

  const results: TestResult[] = [];

  // Run each test
  for (let i = 0; i < suite.tests.length; i++) {
    const test = suite.tests[i];
    console.log(`\n[${i + 1}/${suite.tests.length}] ${test.name}`);
    console.log(`Command: "${test.command}"`);
    if (test.expectedTools) {
      console.log(`Expected tools: ${test.expectedTools.join(", ")}`);
    }

    const result = await runTest(suite, test);
    results.push(result);

    // Print result
    if (result.success) {
      console.log(`✅ PASSED (${result.executionTime}ms)`);
      console.log(`   Response: ${result.aiResponse}`);
      console.log(`   Tools used: ${result.toolsCalled.join(", ") || "none"}`);
    } else {
      console.log(`❌ FAILED (${result.executionTime}ms)`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.validationResult && !result.validationResult.passed) {
        console.log(`   Validation: ${result.validationResult.message}`);
      }
      console.log(`   Response: ${result.aiResponse}`);
      console.log(`   Tools used: ${result.toolsCalled.join(", ") || "none"}`);
      if (result.expectedTools) {
        const missing = result.expectedTools.filter(
          (t) => !result.toolsCalled.includes(t)
        );
        if (missing.length > 0) {
          console.log(`   Missing tools: ${missing.join(", ")}`);
        }
      }
    }
  }

  // Run teardown if provided
  if (suite.teardown) {
    console.log("\n🔧 Running suite teardown...\n");
    await suite.teardown();
  }

  return results;
}

/**
 * Generate and print test report
 */
function printReport(report: TestReport) {
  console.log("\n\n");
  console.log("═".repeat(80));
  console.log("📊 TEST REPORT");
  console.log("═".repeat(80));
  console.log();
  console.log(`Duration: ${report.durationMs}ms (${(report.durationMs / 1000).toFixed(2)}s)`);
  console.log(`Total Suites: ${report.totalSuites}`);
  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`Passed: ${report.passed} (${((report.passed / report.totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${report.failed} (${((report.failed / report.totalTests) * 100).toFixed(1)}%)`);
  console.log();

  // Per-suite breakdown
  for (const suite of report.suites) {
    const suitePercent = ((suite.passed / (suite.passed + suite.failed)) * 100).toFixed(1);
    console.log(`\n${suite.name}: ${suite.passed}/${suite.passed + suite.failed} passed (${suitePercent}%)`);

    // Show failed tests
    const failedTests = suite.results.filter((r) => !r.success);
    if (failedTests.length > 0) {
      console.log(`  Failed tests:`);
      for (const test of failedTests) {
        console.log(`    ❌ ${test.testName}`);
        if (test.error) {
          console.log(`       Error: ${test.error}`);
        }
        if (test.validationResult && !test.validationResult.passed) {
          console.log(`       ${test.validationResult.message}`);
        }
      }
    }
  }

  console.log();
  console.log("═".repeat(80));
  if (report.failed === 0) {
    console.log("🎉 ALL TESTS PASSED!");
  } else {
    console.log(`⚠️  ${report.failed} TEST${report.failed > 1 ? "S" : ""} FAILED`);
  }
  console.log("═".repeat(80));
  console.log();
}

// ============================================================================
// MAIN
// ============================================================================

export async function runTestSuites(suites: TestSuite[]) {
  const startTime = new Date();
  const report: TestReport = {
    totalSuites: suites.length,
    totalTests: 0,
    passed: 0,
    failed: 0,
    suites: [],
    startTime,
    endTime: new Date(),
    durationMs: 0,
  };

  console.log("\n🧪 AI EXECUTOR TEST HARNESS");
  console.log("═".repeat(80));

  // Initialize test context
  await initializeTestContext();

  // Run all suites
  for (const suite of suites) {
    const results = await runSuite(suite);
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    report.totalTests += results.length;
    report.passed += passed;
    report.failed += failed;
    report.suites.push({
      name: suite.name,
      passed,
      failed,
      results,
    });
  }

  report.endTime = new Date();
  report.durationMs = report.endTime.getTime() - report.startTime.getTime();

  // Print report
  printReport(report);

  return report;
}

// Run tests if called directly
if (require.main === module) {
  const suiteName = process.argv[2];

  import("./test-suites/index.js")
    .then(({ allSuites, suitesByName }) => {
      let suitesToRun: TestSuite[];

      if (suiteName) {
        const suite = suitesByName[suiteName];
        if (!suite) {
          console.error(`❌ Suite "${suiteName}" not found`);
          console.log("\nAvailable suites:");
          Object.keys(suitesByName).forEach((name) => {
            console.log(`  - ${name}`);
          });
          process.exit(1);
        }
        suitesToRun = [suite];
      } else {
        suitesToRun = allSuites;
      }

      return runTestSuites(suitesToRun);
    })
    .then((report) => {
      process.exit(report.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("\n❌ Fatal error:", error);
      process.exit(1);
    });
}
