"use client";

import { Building2, Briefcase } from "lucide-react";

interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at: string;
  projectCount?: number;
}

interface ClientsTableProps {
  clients: Client[];
  workspaceId: string;
}

export default function ClientsTable({ clients, workspaceId }: ClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border)] rounded-[4px] bg-[var(--surface)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 text-[var(--velvet-purple)] mb-4">
          <Building2 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          No clients yet
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] text-center max-w-md">
          Clients will appear here once you create projects.
          <br />
          Just type a client name when creating a new project.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Contact
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                Projects
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-[var(--surface-hover)] transition-colors"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 text-[var(--velvet-purple)] font-semibold">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-medium text-[var(--foreground)]">
                      {client.name}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {client.company ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <Building2 className="h-4 w-4" />
                      {client.company}
                    </div>
                  ) : (
                    <span className="text-sm text-[var(--tertiary-foreground)]">—</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  {client.email || client.phone ? (
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {client.email && <div>{client.email}</div>}
                      {client.phone && <div>{client.phone}</div>}
                    </div>
                  ) : (
                    <span className="text-sm text-[var(--tertiary-foreground)]">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--dome-teal)]/20 bg-[var(--dome-teal)]/10 px-2.5 py-1 text-xs font-medium text-[var(--dome-teal)]">
                    <Briefcase className="h-3 w-3" />
                    {client.projectCount || 0}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

