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

export async function sendWorkspaceTrialEndingEmail(params: {
  to: string;
  workspaceName: string;
  trialEndsAt: string;
  billingUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[email] RESEND_API_KEY not set; skipping trial reminder email to", params.to, "billingUrl:", params.billingUrl);
      return { ok: true };
    }
    return { ok: false, error: "Email not configured" };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "Saria <onboarding@resend.dev>";
  const trialEndDate = new Date(params.trialEndsAt);
  const formattedTrialEndDate = Number.isNaN(trialEndDate.getTime())
    ? params.trialEndsAt
    : trialEndDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const { error } = await resend.emails.send({
    from,
    to: [params.to],
    subject: `Your ${params.workspaceName} Standard trial ends soon`,
    html: `
      <p>Your <strong>${escapeHtml(params.workspaceName)}</strong> Standard trial ends on <strong>${escapeHtml(formattedTrialEndDate)}</strong>.</p>
      <p>Add a payment method before then to keep Standard active. If you do nothing, the workspace will fall back to Free and any projects, tabs, or blocks above the Free limits will lock.</p>
      <p><a href="${params.billingUrl}" style="display:inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Update plan</a></p>
      <p>Or copy this link: ${params.billingUrl}</p>
    `,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function sendClientPageShareEmail(params: {
  to: string;
  publicUrl: string;
  projectName: string;
  sharerName?: string | null;
  sharerEmail: string;
  tabNames: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[email] RESEND_API_KEY not set; skipping client page share email to",
        params.to,
        "publicUrl:",
        params.publicUrl
      );
      return { ok: true };
    }
    return { ok: false, error: "Email not configured" };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "Saria <onboarding@resend.dev>";
  const sharerLabel = params.sharerName?.trim() || params.sharerEmail;
  const tabsLine =
    params.tabNames.length > 0
      ? `<p>Included tabs: ${escapeHtml(params.tabNames.join(", "))}</p>`
      : "";

  const { error } = await resend.emails.send({
    from,
    to: [params.to],
    subject: `${sharerLabel} shared ${params.projectName} with you`,
    html: `
      <p><strong>${escapeHtml(sharerLabel)}</strong> shared the project <strong>${escapeHtml(params.projectName)}</strong> with you on Saria.</p>
      ${tabsLine}
      <p><a href="${params.publicUrl}" style="display:inline-block; padding: 10px 20px; background: #b8891f; color: white; text-decoration: none; border-radius: 6px;">Open shared link</a></p>
      <p>Or copy this link: ${params.publicUrl}</p>
      <p>Create a free Saria account with this email to save the link in your Shared with me tab.</p>
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
