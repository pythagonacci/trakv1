import type { AnalysisFile } from "./types";

export function buildScopeHints(message: string) {
  const lower = message.toLowerCase();
  const workspaceHints = [
    "workspace",
    "across projects",
    "all projects",
    "organization",
    "company-wide",
    "company wide",
    "global",
  ];
  return {
    isWorkspace: workspaceHints.some((hint) => lower.includes(hint)),
    wantsComparison: /(compare|versus|vs\.|vs |difference|between)/i.test(lower),
    wantsCombined: /(together|combined|all files|all of them|overall|aggregate|total)/i.test(lower),
  };
}

export function matchFilesByName<T extends { id: string; file_name: string }>(message: string, files: T[]): T[] {
  const lower = message.toLowerCase();
  return files.filter((file) => {
    const name = file.file_name.toLowerCase();
    const base = name.replace(/\.[^.]+$/, "");
    return lower.includes(name) || (base.length > 2 && lower.includes(base));
  });
}

export function selectFilesForQuery(params: {
  message: string;
  sessionFiles: AnalysisFile[];
  tabFiles: AnalysisFile[];
  projectFiles: AnalysisFile[];
  workspaceFiles: AnalysisFile[];
}) {
  const { message, sessionFiles, tabFiles, projectFiles, workspaceFiles } = params;
  const hints = buildScopeHints(message);
  const candidates = [
    ...sessionFiles,
    ...tabFiles,
    ...projectFiles,
    ...workspaceFiles,
  ];

  const explicitMatches = matchFilesByName(message, candidates);

  const buckets = [
    { label: "session", files: sessionFiles },
    { label: "tab", files: tabFiles },
    { label: "project", files: projectFiles },
    { label: "workspace", files: workspaceFiles },
  ];

  const primaryBucket = buckets.find((bucket) => bucket.files.length > 0);

  if (explicitMatches.length === 0 && primaryBucket && primaryBucket.files.length > 1) {
    if (primaryBucket.label === "session" && !hints.wantsCombined && !hints.wantsComparison) {
      return {
        selectedFiles: [] as AnalysisFile[],
        clarification: {
          question: "You uploaded multiple files. Should I analyze them together or individually?",
          options: ["Together", "Individually"],
        },
      };
    }

    if (!hints.wantsCombined && !hints.wantsComparison) {
      return {
        selectedFiles: [] as AnalysisFile[],
        clarification: {
          question: "Which file should I analyze?",
          options: primaryBucket.files.map((file) => file.file_name),
        },
      };
    }
  }

  let selectedFiles = explicitMatches.length > 0 ? explicitMatches : primaryBucket?.files || [];

  if (hints.wantsCombined || hints.wantsComparison) {
    if (selectedFiles.length === 0) {
      selectedFiles = primaryBucket?.files || [];
    }
  }

  return { selectedFiles, clarification: null };
}
