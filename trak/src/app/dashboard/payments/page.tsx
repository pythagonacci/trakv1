import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getServerUser } from "@/lib/auth/get-server-user";
import { redirect } from "next/navigation";
import PaymentsTable from "./payments-table";

// Keep dynamic for real-time data
export const dynamic = "force-dynamic";

// Payment status types
type PaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

interface Payment {
  id: string;
  project_id: string;
  project_name: string;
  client_id: string | null;
  client_name: string | null;
  client_company?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  due_date: string | null;
  paid_date: string | null;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Mock data for demonstration - replace with actual database queries when payment tables are created
const mockPayments: Payment[] = [
  {
    id: "1",
    project_id: "proj-1",
    project_name: "Website Redesign",
    client_id: "client-1",
    client_name: "Acme Corp",
    client_company: "Acme Corporation",
    amount: 2500,
    currency: "USD",
    status: "paid",
    due_date: "2024-12-01",
    paid_date: "2024-11-28",
    description: "Final payment for website redesign project",
    created_at: "2024-11-01T10:00:00Z",
    updated_at: "2024-11-28T14:30:00Z",
  },
  {
    id: "2",
    project_id: "proj-2",
    project_name: "Brand Identity Package",
    client_id: "client-2",
    client_name: "TechStart Inc",
    client_company: "TechStart Inc",
    amount: 1800,
    currency: "USD",
    status: "pending",
    due_date: "2024-12-15",
    paid_date: null,
    description: "Logo design and brand guidelines",
    created_at: "2024-11-05T09:15:00Z",
    updated_at: "2024-11-05T09:15:00Z",
  },
  {
    id: "3",
    project_id: "proj-3",
    project_name: "Mobile App Development",
    client_id: "client-3",
    client_name: "StartupXYZ",
    amount: 5000,
    currency: "USD",
    status: "overdue",
    due_date: "2024-11-30",
    paid_date: null,
    description: "Phase 1 development - iOS and Android",
    created_at: "2024-10-15T11:20:00Z",
    updated_at: "2024-12-01T08:00:00Z",
  },
  {
    id: "4",
    project_id: "proj-4",
    project_name: "Social Media Campaign",
    client_id: "client-1",
    client_name: "Acme Corp",
    client_company: "Acme Corporation",
    amount: 1200,
    currency: "USD",
    status: "paid",
    due_date: "2024-11-20",
    paid_date: "2024-11-18",
    description: "3-month social media content creation",
    created_at: "2024-10-20T13:45:00Z",
    updated_at: "2024-11-18T16:20:00Z",
  },
  {
    id: "5",
    project_id: "proj-5",
    project_name: "E-commerce Platform",
    client_id: "client-4",
    client_name: "RetailPro",
    amount: 7500,
    currency: "USD",
    status: "pending",
    due_date: "2025-01-15",
    paid_date: null,
    description: "Custom e-commerce solution with payment integration",
    created_at: "2024-11-10T10:30:00Z",
    updated_at: "2024-11-10T10:30:00Z",
  },
];

export default async function PaymentsPage() {
  const workspaceId = await getCurrentWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-500">No workspace selected</p>
        </div>
      </div>
    );
  }

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  // TODO: Replace with actual database query when payment tables are created
  // For now, return mock data
  const payments = mockPayments;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-[var(--foreground)] font-playfair" style={{ fontFamily: 'var(--font-playfair)' }}>
            Payments
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track and manage all payments collected for your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            Export
          </button>
          <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            Filter
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <PaymentsTable
        payments={payments}
        workspaceId={workspaceId}
      />
    </div>
  );
}