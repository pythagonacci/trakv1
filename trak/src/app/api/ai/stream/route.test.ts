import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  executeAICommandStreamMock,
  executeWorkflowAICommandStreamMock,
  requireUserMock,
  getCurrentWorkspaceIdMock,
  resolveRouteContextFromPathnameMock,
  assertAndConsumeFreeAiCommandQuotaMock,
} = vi.hoisted(() => ({
  executeAICommandStreamMock: vi.fn(),
  executeWorkflowAICommandStreamMock: vi.fn(),
  requireUserMock: vi.fn(),
  getCurrentWorkspaceIdMock: vi.fn(),
  resolveRouteContextFromPathnameMock: vi.fn(),
  assertAndConsumeFreeAiCommandQuotaMock: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({
  executeAICommandStream: executeAICommandStreamMock,
}));

vi.mock("@/lib/ai/workflow-executor", () => ({
  executeWorkflowAICommandStream: executeWorkflowAICommandStreamMock,
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
  isUnauthorizedApiError: () => false,
}));

vi.mock("@/app/actions/workspace", () => ({
  getCurrentWorkspaceId: getCurrentWorkspaceIdMock,
}));

vi.mock("@/lib/route-context", () => ({
  resolveRouteContextFromPathname: resolveRouteContextFromPathnameMock,
}));

vi.mock("@/lib/billing/limits", () => ({
  assertAndConsumeFreeAiCommandQuota: assertAndConsumeFreeAiCommandQuotaMock,
}));

vi.mock("@/lib/billing/errors", () => ({
  toBillingErrorPayload: () => null,
}));

import { POST } from "./route";

async function* mockStreamResponse(content: string) {
  yield { type: "response", content };
}

describe("POST /api/ai/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      user: { id: "user-1" },
      supabase: {},
    });
    getCurrentWorkspaceIdMock.mockResolvedValue("workspace-1");
    assertAndConsumeFreeAiCommandQuotaMock.mockResolvedValue(undefined);
  });

  it("falls back to the generic executor when no tab context is available", async () => {
    resolveRouteContextFromPathnameMock.mockResolvedValue({
      projectId: "project-1",
      tabId: null,
    });
    executeAICommandStreamMock.mockReturnValue(mockStreamResponse("generic ok"));

    const response = await POST(
      new Request("http://localhost/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          referer: "http://localhost/dashboard/projects/project-slug",
        },
        body: JSON.stringify({
          command: "what is overdue?",
          messages: [{ role: "user", content: "earlier question" }],
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(executeWorkflowAICommandStreamMock).not.toHaveBeenCalled();
    expect(executeAICommandStreamMock).toHaveBeenCalledTimes(1);
    expect(executeAICommandStreamMock).toHaveBeenCalledWith(
      "what is overdue?",
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        currentProjectId: "project-1",
      }),
      [{ role: "user", content: "earlier question" }],
      expect.objectContaining({
        requireWriteConfirmation: true,
      })
    );

    await expect(response.text()).resolves.toContain("generic ok");
  });

  it("keeps using the workflow executor when a tab context is available", async () => {
    resolveRouteContextFromPathnameMock.mockResolvedValue({
      projectId: "project-1",
      tabId: "tab-1",
    });
    executeWorkflowAICommandStreamMock.mockReturnValue(mockStreamResponse("workflow ok"));

    const response = await POST(
      new Request("http://localhost/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          referer: "http://localhost/dashboard/projects/project-slug/tabs/tab-slug",
        },
        body: JSON.stringify({
          command: "summarize this page",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(executeAICommandStreamMock).not.toHaveBeenCalled();
    expect(executeWorkflowAICommandStreamMock).toHaveBeenCalledTimes(1);
    expect(executeWorkflowAICommandStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tabId: "tab-1",
        command: "summarize this page",
      })
    );

    await expect(response.text()).resolves.toContain("workflow ok");
  });
});
