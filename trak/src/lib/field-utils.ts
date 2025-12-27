/**
 * Field Utilities
 *
 * Validators, formatters, and helpers for table field types
 */

// ============================================================================
// VALIDATORS
// ============================================================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters for validation
  const digits = phone.replace(/\D/g, '');
  // Accept 10-15 digits (handles US and international formats)
  return digits.length >= 10 && digits.length <= 15;
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  if (seconds < 2592000) {
    const weeks = Math.floor(seconds / 604800);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  if (seconds < 31536000) {
    const months = Math.floor(seconds / 2592000);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(seconds / 31536000);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

export function formatUserDisplay(user: { name?: string; email?: string } | null): string {
  if (!user) return 'Unknown User';
  return user.name || user.email?.split('@')[0] || 'Unknown User';
}

export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Format US numbers as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Format with country code as +X (XXX) XXX-XXXX
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if not a standard format
  return phone;
}

// ============================================================================
// NUMBER FORMATTING (from legacy table-block)
// ============================================================================

export interface NumberFormatConfig {
  format?: 'number' | 'currency' | 'percent';
  currency?: string;
  decimals?: number;
  separator?: string;
}

export function formatNumber(value: number, config: NumberFormatConfig = {}): string {
  const {
    format = 'number',
    currency = 'USD',
    decimals = 2,
  } = config;

  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  if (format === 'percent') {
    return `${(value * 100).toFixed(decimals)}%`;
  }

  return value.toFixed(decimals);
}

export function parseNumber(value: string): number | null {
  if (!value) return null;

  // Remove currency symbols, percent signs, and commas
  const cleaned = value.replace(/[$,%]/g, '').trim();
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// URL HELPERS
// ============================================================================

export function ensureHttps(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

export function getDisplayUrl(url: string): string {
  try {
    const urlObj = new URL(ensureHttps(url));
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url;
  }
}
