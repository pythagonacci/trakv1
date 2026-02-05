"use client";

import { ArrowLeft, Building2, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  created_at: string;
  project_count?: number;
}

interface ClientHeaderProps {
  client: Client;
}

export default function ClientHeader({ client }: ClientHeaderProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4 mb-6">
      <button
        onClick={() => router.push("/dashboard/clients")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to clients
      </button>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 text-[var(--velvet-purple)] font-semibold text-lg">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-normal text-[var(--foreground)] font-playfair" style={{ fontFamily: 'var(--font-playfair)' }}>
                {client.name}
              </h1>
              {client.company && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                  <Building2 className="h-4 w-4" />
                  {client.company}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            {client.email && (
              <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                <Mail className="h-4 w-4" />
                {client.email}
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                <Phone className="h-4 w-4" />
                {client.phone}
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                <span className="text-xs">🌐</span>
                {client.website}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
              <Calendar className="h-4 w-4" />
              Added {formatDate(client.created_at)}
            </div>
          </div>

          {client.notes && (
            <div className="text-sm text-[var(--muted-foreground)] max-w-2xl">
              <p>{client.notes}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            Edit client
          </button>
          <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            New project
          </button>
        </div>
      </div>
    </div>
  );
}