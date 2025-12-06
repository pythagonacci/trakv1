import { getServerUser } from "@/lib/auth/get-server-user";

// Payment status types
export type PaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface Payment {
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

export async function getAllPayments(workspaceId: string): Promise<{ data?: Payment[]; error?: string }> {
  const authResult = await getServerUser();

  if (!authResult) {
    return { error: "Unauthorized" };
  }

  // TODO: Replace with actual database query when payment tables are created
  // For now, return mock data filtered by workspace context

  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return { data: mockPayments };
  } catch (error) {
    console.error("Error fetching payments:", error);
    return { error: "Failed to fetch payments" };
  }
}

export async function getPaymentById(paymentId: string): Promise<{ data?: Payment; error?: string }> {
  const authResult = await getServerUser();

  if (!authResult) {
    return { error: "Unauthorized" };
  }

  try {
    // TODO: Replace with actual database query
    const payment = mockPayments.find(p => p.id === paymentId);

    if (!payment) {
      return { error: "Payment not found" };
    }

    return { data: payment };
  } catch (error) {
    console.error("Error fetching payment:", error);
    return { error: "Failed to fetch payment" };
  }
}

export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  paidDate?: string
): Promise<{ error?: string }> {
  const authResult = await getServerUser();

  if (!authResult) {
    return { error: "Unauthorized" };
  }

  try {
    // TODO: Replace with actual database update
    const paymentIndex = mockPayments.findIndex(p => p.id === paymentId);

    if (paymentIndex === -1) {
      return { error: "Payment not found" };
    }

    mockPayments[paymentIndex].status = status;
    mockPayments[paymentIndex].paid_date = paidDate || null;
    mockPayments[paymentIndex].updated_at = new Date().toISOString();

    return {};
  } catch (error) {
    console.error("Error updating payment status:", error);
    return { error: "Failed to update payment status" };
  }
}

// Helper function to format currency
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

// Helper function to get payment status color
export function getPaymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case "paid":
      return "var(--dome-teal)";
    case "pending":
      return "var(--tram-yellow)";
    case "overdue":
      return "var(--error-red)";
    case "cancelled":
      return "var(--muted-foreground)";
    default:
      return "var(--muted-foreground)";
  }
}