"use client";

import React from "react";
import { MoreHorizontal, CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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

// Helper function to format currency
function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

// Helper function to get payment status color
function getPaymentStatusColor(status: PaymentStatus): string {
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

interface PaymentsTableProps {
  payments: Payment[];
  workspaceId: string;
}

const statusIcons = {
  paid: CheckCircle,
  pending: Clock,
  overdue: AlertTriangle,
  cancelled: XCircle,
};

const statusLabels = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export default function PaymentsTable({ payments, workspaceId }: PaymentsTableProps) {
  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return { text: "No due date", isOverdue: false };

    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now && date.toDateString() !== now.toDateString();

    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return { text: formatted, isOverdue };
  };

  const getStatusIcon = (status: Payment["status"]) => {
    const IconComponent = statusIcons[status];
    return <IconComponent className="h-4 w-4" />;
  };

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-[var(--surface)] p-3">
          <CheckCircle className="h-8 w-8 text-[var(--muted-foreground)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No payments yet</h3>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
          Payments collected for your workspace will appear here. Start by creating projects and setting up payment terms.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[var(--border)] hover:bg-transparent">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Client
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Project
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Amount
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Due Date
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Status
            </TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const dueDate = formatDueDate(payment.due_date);
            const statusColor = getPaymentStatusColor(payment.status);

            return (
              <TableRow
                key={payment.id}
                className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <TableCell className="py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {payment.client_name || "No client"}
                    </span>
                    {payment.client_company && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {payment.client_company}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {payment.project_name}
                    </span>
                    {payment.description && (
                      <span className="text-xs text-[var(--muted-foreground)] truncate max-w-xs">
                        {payment.description}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="py-4">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {formatCurrency(payment.amount, payment.currency)}
                  </span>
                </TableCell>

                <TableCell className="py-4">
                  <span
                    className={cn(
                      "text-sm",
                      dueDate.isOverdue && payment.status !== "paid" && "text-red-500 font-medium"
                    )}
                  >
                    {dueDate.text}
                  </span>
                </TableCell>

                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${statusColor}15`,
                        color: statusColor,
                      }}
                    >
                      {getStatusIcon(payment.status)}
                      <span>{statusLabels[payment.status]}</span>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem className="text-sm">
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-sm">
                        Edit payment
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-sm">
                        Download invoice
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-sm text-red-600 hover:text-red-700">
                        Mark as overdue
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}