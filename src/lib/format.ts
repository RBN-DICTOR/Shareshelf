import type { BorrowRequestStatus, ItemBusyDate } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (Number.isNaN(monthIdx) || Number.isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    return dateStr;
  }
  return `${day} ${MONTHS[monthIdx]}`;
}

export function formatDateRange(start: string, end: string): string {
  const s = formatShortDate(start);
  const e = formatShortDate(end);
  if (s === e) return s;
  return `${s} – ${e}`;
}

export function formatRelativeTime(isoStr: string): string {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatShortDate(isoStr);
}

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'N';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function getFirstName(name?: string | null): string {
  if (!name || !name.trim()) return 'Neighbor';
  return name.trim().split(/\s+/)[0];
}

export function cleanText(value: string): string {
  return value.trim().replace(/[<>]/g, '');
}

export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

export function isItemOnLoanToday(busyDates: ItemBusyDate[], itemId: string): boolean {
  const today = getTodayISO();
  return busyDates.some(
    (b) => b.item_id === itemId && b.start_date <= today && today <= b.end_date
  );
}

export function formatCurrency(value: number): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

export function getStatusLabel(status: BorrowRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Waiting for approval';
    case 'approved':
      return 'Approved, ready for pickup';
    case 'rejected':
      return 'Not approved this time';
    case 'active':
      return 'Out on loan';
    case 'return_requested':
      return 'Return pending';
    case 'completed':
      return 'All done';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function mapSupabaseError(err: unknown): string {
  if (!err) return 'Something went wrong. Check your connection and try again.';
  const rawMessage =
    typeof err === 'string'
      ? err
      : (err as { message?: string; error_description?: string; details?: string })?.message ||
        (err as { error_description?: string })?.error_description ||
        'Something went wrong. Check your connection and try again.';
  const code = (err as { code?: string })?.code || '';
  const lower = rawMessage.toLowerCase();

  if (
    code === '23P01' ||
    lower.includes('exclusion') ||
    lower.includes('borrow_requests_item_id_daterange_excl') ||
    lower.includes('conflicting key value violates exclusion constraint')
  ) {
    return 'Those dates are already reserved. Try another range.';
  }

  if (lower.includes('that status change is not allowed')) {
    return 'That status change is not allowed right now. Please refresh and try again.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Email or password did not match. Double-check and try again.';
  }

  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (lower.includes('password should be at least')) {
    return 'Password should be at least 6 characters long.';
  }

  if (lower.includes('row-level security')) {
    return 'You do not have permission to make this change.';
  }

  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Something went wrong. Check your connection and try again.';
  }

  return rawMessage;
}
