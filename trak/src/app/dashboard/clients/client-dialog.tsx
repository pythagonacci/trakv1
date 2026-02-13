"use client";

import { useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";

interface ClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClientFormData) => Promise<void>;
}

export interface ClientFormData {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
}

export default function ClientDialog({
  isOpen,
  onClose,
  onSubmit,
}: ClientDialogProps) {
  const [formData, setFormData] = useState<ClientFormData>({
    name: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError("Client name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      // Reset form and close
      setFormData({
        name: "",
        company: "",
        email: "",
        phone: "",
        website: "",
        notes: "",
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold">New Client</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Name Input */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Acme Corporation"
              className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)]"
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          {/* Company Input */}
          <div className="space-y-2">
            <label htmlFor="company" className="block text-sm font-medium">
              Company
            </label>
            <input
              id="company"
              name="company"
              type="text"
              value={formData.company}
              onChange={handleChange}
              placeholder="Acme Inc."
              className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)]"
              disabled={isSubmitting}
            />
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contact@acme.com"
              className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)]"
              disabled={isSubmitting}
            />
          </div>

          {/* Phone Input */}
          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 (555) 123-4567"
              className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)]"
              disabled={isSubmitting}
            />
          </div>

          {/* Website Input */}
          <div className="space-y-2">
            <label htmlFor="website" className="block text-sm font-medium">
              Website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://acme.com"
              className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)]"
              disabled={isSubmitting}
            />
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes about this client..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)] resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creating..." : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
