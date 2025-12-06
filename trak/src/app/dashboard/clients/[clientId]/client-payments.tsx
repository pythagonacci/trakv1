"use client";

import React from "react";
import { DollarSign, Calendar, CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";
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

// Mock data for client payments - replace with actual data fetching
const mockClientPayments = [
  {
    id: "1",
    project_name: "Website Redesign",
    amount: 2500,
    currency: "USD",
    status: "paid" as const,
    due_date: "2024-12-01",
    paid_date: "2024-11-28",
    description: "Final payment for website redesign project",
    invoice_number: "INV-2024-001",
  },
  {
    id: "2",
    project_name: "Brand Identity Package",
    amount: 1800,
    currency: "USD",
    status: "pending" as const,
    due_date: "2024-12-15",
    paid_date: null,
    description: "Logo design and brand guidelines",
    invoice_number: "INV-2024-002",
  },
  {
    id: "3",
    project_name: "Mobile App Development",
    amount: 5000,
    currency: "USD",
    status: "overdue" as const,
    due_date: "2024-11-30",
    paid_date: null,
    description: "Phase 1 development - iOS and Android",
    invoice_number: "INV-2024-003",
  },
];

interface ClientPaymentsProps {
  clientId: string;
  clientName: string;
}

export default function ClientPayments({ clientId, clientName }: ClientPaymentsProps) {
  const formatCurrency = (amount: number, currency: string = "USD"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return { text: "No date", isOverdue: false };

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

  const getStatusIcon = (status: "paid" | "pending" | "overdue" | "cancelled") => {
    const icons = {
      paid: CheckCircle,
      pending: Clock,
      overdue: AlertTriangle,
      cancelled: XCircle,
    };
    const colors = {
      paid: "text-green-600",
      pending: "text-yellow-600",
      overdue: "text-red-600",
      cancelled: "text-gray-600",
    };

    const IconComponent = icons[status];
    return <IconComponent className={cn("h-4 w-4", colors[status])} />;
  };

  const getStatusBadge = (status: "paid" | "pending" | "overdue" | "cancelled") => {
    const labels = {
      paid: "Paid",
      pending: "Pending",
      overdue: "Overdue",
      cancelled: "Cancelled",
    };

    const colors = {
      paid: "bg-green-100 text-green-800 border-green-200",
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      overdue: "bg-red-100 text-red-800 border-red-200",
      cancelled: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        colors[status]
      )}>
        {getStatusIcon(status)}
        {labels[status]}
      </span>
    );
  };

  const totalPaid = mockClientPayments
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = mockClientPayments
    .filter(p => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOverdue = mockClientPayments
    .filter(p => p.status === "overdue")
    .reduce((sum, p) => sum + p.amount, 0);

  if (mockClientPayments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-[var(--surface)] p-3">
          <DollarSign className="h-8 w-8 text-[var(--muted-foreground)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          No payments yet
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
          Payments for {clientName} will appear here once invoices are created and payments are processed.
        </p>
        <button className="mt-4 inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
          Create Invoice
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-[var(--foreground)]">Total Paid</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalPaid)}
          </div>
        </div>

        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-[var(--foreground)]">Pending</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {formatCurrency(totalPending)}
          </div>
        </div>

        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-[var(--foreground)]">Overdue</span>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(totalOverdue)}
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Payment History
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            All payments and invoices for {clientName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            Export
          </button>
          <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
            Create Invoice
          </button>
        </div>
      </div>

      <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border)] hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Invoice
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
            {mockClientPayments.map((payment) => {
              const dueDate = formatDate(payment.due_date);

              return (
                <TableRow
                  key={payment.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <TableCell className="py-4">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {payment.invoice_number}
                    </span>
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
                    {getStatusBadge(payment.status)}
                  </TableCell>

                  <TableCell className="py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                        >
                          <div className="h-4 w-4 flex items-center justify-center">⋯</div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="text-sm">
                          View invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-sm">
                          Send reminder
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-sm">
                          Download PDF
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
    </div>
  );
}