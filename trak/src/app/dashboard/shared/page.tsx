import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getSharedClientPagesForUser } from "@/lib/client-page-shares";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SharedWithMePage() {
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  const shares = await getSharedClientPagesForUser({
    userId: authResult.user.id,
    email: authResult.user.email,
  });

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80">
          Shared with me
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Saved magic links
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Public client links shared to {authResult.user.email ?? "your account"} show up here.
        </p>
      </div>

      {shares.length === 0 ? (
        <div className="rounded-[18px] border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,248,225,0.95),rgba(255,255,255,0.96))] p-8">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            No shared links yet
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
            When someone shares a client magic link to this email, it will land here with the
            project name, the visible tabs in the link, and who sent it.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))] shadow-[0_16px_40px_rgba(180,138,35,0.08)]">
          <table className="w-full border-collapse text-left">
            <thead className="bg-amber-100/80">
              <tr className="border-b border-amber-200/80">
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/80">
                  Project
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/80">
                  Tabs in link
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/80">
                  Shared by
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/80">
                  Shared to
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/80">
                  Last shared
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-900/80">
                  Link
                </th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => (
                <tr
                  key={share.id}
                  className="border-b border-amber-100/80 last:border-b-0 hover:bg-amber-50/60"
                >
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {share.projectName}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          share.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {share.isActive ? "Active link" : "Link disabled"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    {share.tabs.length > 0 ? (
                      <div className="flex max-w-xl flex-wrap gap-1.5">
                        {share.tabs.map((tab) => (
                          <span
                            key={tab.id}
                            className="rounded-full border border-amber-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-amber-900/85"
                          >
                            {tab.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        No public tabs available right now.
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {share.sharedByName || share.sharedByEmail}
                    </p>
                    {share.sharedByName && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {share.sharedByEmail}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top text-sm text-[var(--foreground)]">
                    {share.sharedWithEmail}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="text-sm text-[var(--foreground)]">
                      {formatTimestamp(share.updatedAt)}
                    </p>
                    {share.updatedAt !== share.createdAt && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        First shared {formatTimestamp(share.createdAt)}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <Link
                      href={share.publicPath}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-200/70 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-200"
                    >
                      Open link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
