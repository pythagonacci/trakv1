/**
 * Send workspace invitation email with accept link.
 * Requires RESEND_API_KEY. From address: RESEND_FROM_EMAIL or Resend default.
 */
export async function sendWorkspaceInvitationEmail(params: {
  to: string;
  workspaceName: string;
  acceptUrl: string;
  inviterEmail?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[email] RESEND_API_KEY not set; skipping invite email to", params.to, "acceptUrl:", params.acceptUrl);
      return { ok: true };
    }
    return { ok: false, error: "Email not configured" };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "Saria <onboarding@resend.dev>";

  const inviterLine = params.inviterEmail
    ? `\n<p>You were invited by ${escapeHtml(params.inviterEmail)}.</p>\n`
    : "";

  const { error } = await resend.emails.send({
    from,
    to: [params.to],
    subject: `You're invited to ${params.workspaceName} on Saria`,
    html: `
      <p>You've been invited to join the workspace <strong>${escapeHtml(params.workspaceName)}</strong> on Saria.</p>
      ${inviterLine}
      <p><a href="${params.acceptUrl}" style="display:inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Accept invitation</a></p>
      <p>Or copy this link: ${params.acceptUrl}</p>
      <p>This invitation will expire in 7 days.</p>
    `,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
