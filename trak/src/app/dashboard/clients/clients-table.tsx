"use client";

import { useState } from "react";
import { Building2, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ClientDialog, { type ClientFormData } from "./client-dialog";
import { createClient } from "@/app/actions/client";

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
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleRowClick = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`);
  };

  const handleCreateClient = async (data: ClientFormData) => {
    const result = await createClient(workspaceId, data);

    if ("error" in result) {
      throw new Error(result.error);
    }

    // Refresh the page to show the new client
    router.refresh();
  };

  if (clients.length === 0) {
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Clients</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Manage your clients and their projects</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            New client
          </Button>
        </div>
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
        <ClientDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSubmit={handleCreateClient}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Clients</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Manage your clients and their projects</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} size="sm">
          New client
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Client
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Company
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Contact
            </TableHead>
            <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Projects
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow
              key={client.id}
              className="cursor-pointer"
              onClick={() => handleRowClick(client.id)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 text-[var(--velvet-purple)] font-semibold">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-medium text-[var(--foreground)]">
                    {client.name}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {client.company ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <Building2 className="h-4 w-4" />
                    {client.company}
                  </div>
                ) : (
                  <span className="text-sm text-[var(--tertiary-foreground)]">—</span>
                )}
              </TableCell>
              <TableCell>
                {client.email || client.phone ? (
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {client.email && <div>{client.email}</div>}
                    {client.phone && <div>{client.phone}</div>}
                  </div>
                ) : (
                  <span className="text-sm text-[var(--tertiary-foreground)]">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <div className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--dome-teal)]/20 bg-[var(--dome-teal)]/10 px-2.5 py-1 text-xs font-medium text-[var(--dome-teal)]">
                  <Briefcase className="h-3 w-3" />
                  {client.projectCount || 0}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ClientDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateClient}
      />
    </>
  );
}

