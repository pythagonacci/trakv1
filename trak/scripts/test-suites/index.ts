/**
 * Test Suites Index
 *
 * Aggregates all test suites for the AI executor test harness
 */

import { singleToolTests } from "./01-single-tool-tests";
import { multiStepWorkflowTests } from "./02-multi-step-workflows";
import type { TestSuite } from "../test-ai-executor";

export const allSuites: TestSuite[] = [
  singleToolTests,
  multiStepWorkflowTests,
];

export const suitesByName: Record<string, TestSuite> = {
  "single-tool": singleToolTests,
  "multi-step": multiStepWorkflowTests,
};
