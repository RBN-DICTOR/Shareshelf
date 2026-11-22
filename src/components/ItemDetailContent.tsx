import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Edit3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useShareShelfData } from '../hooks/useShareShelfData';
import {
  datesOverlap,
  formatDateRange,
  getInitials,
  getTodayISO,
  isItemOnLoanToday,
} from '../lib/format';
import type { Item, ItemBusyDate } from '../types';
import { Button } from './Button';
import { ItemThumbnail } from './ItemThumbnail';

interface ItemDetailContentProps {
  item: Item;
  busyDates: ItemBusyDate[];
  onClose?: () => void;
  onEditItem: (item: Item) => void;
}

export function ItemDetailContent({
  item,
  busyDates,
  onClose,
  onEditItem,
}: ItemDetailContentProps) {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const { openChatWith } = useChat();
  const { submitBorrowRequest, removeItem } = useShareShelfData();

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const today = getTodayISO();
  const isOwner = Boolean(user && user.id === item.owner_id);
  const itemBusy = useMemo(
    () => busyDates.filter((b) => b.item_id === item.id),
    [busyDates, item.id]
  );
  const onLoanToday = isItemOnLoanToday(busyDates, item.id);
  const ownerName = item.owner?.full_name || 'Neighbor';

  // Inline date validation
  const dateValidationError = useMemo(() => {
    if (!startDate && !endDate) return null;
    if (startDate && startDate < today) {
      return 'Start date cannot be in the past.';
    }
    if (endDate && endDate < today) {
      return 'Return date cannot be in the past.';
    }
    if (startDate && endDate && endDate < startDate) {
      return 'Return date cannot be before the start date.';
    }
    if (startDate && endDate) {
      const overlaps = itemBusy.some((b) =>
        datesOverlap(startDate, endDate, b.start_date, b.end_date)
      );
      if (overlaps) {
        return 'Those dates overlap a reserved loan. Try another range.';
      }
    }
    return null;
  }, [endDate, itemBusy, startDate, today]);

  const handleOpenRequestForm = () => {
    if (!user) {
      openAuthModal('Sign in to continue. It only takes a minute.', () => {
        setShowRequestForm(true);
      });
      return;
    }
    setShowRequestForm(true);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!user) {
      openAuthModal('Sign in to continue. It only takes a minute.', () => {
        setShowRequestForm(true);
      });
      return;
    }

    if (!startDate || !endDate) {
      setSubmitError('Please pick both a start date and a return date.');
      return;
    }

    if (dateValidationError) {
      setSubmitError(dateValidationError);
      return;
    }

    setSubmitting(true);
    try {
      await submitBorrowRequest({
        item,
        start_date: startDate,
        end_date: endDate,
        message,
      });
      onClose?.();
      navigate('/activity?tab=my_requests');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not send borrow request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setSubmitError(null);
    try {
      await removeItem(item.id);
      onClose?.();
      navigate('/');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not remove this item.');
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  const statusLabel = !item.is_available
    ? 'Unavailable'
    : onLoanToday
      ? 'On loan'
      : 'Available';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12">
      {/* Left image & rules column */}
      <div className="space-y-4 border-b border-[var(--line)] bg-[var(--cream)] p-5 sm:p-6 lg:col-span-6 lg:border-r lg:border-b-0">
        <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
          <ItemThumbnail
            imageUrl={item.image_url}
            name={item.name}
            category={item.category}
            iconSize="lg"
          />
        </div>

        {/* Owner card */}
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-white p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-sm font-extrabold text-white">
              {getInitials(ownerName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[var(--navy)]">{ownerName}</p>
              <p className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.neighborhood}</span>
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--sun-soft)] px-3 py-1 text-xs font-extrabold text-[var(--navy)]">
            Neighbor
          </span>
        </div>

        {/* Borrowing rules */}
        <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[var(--navy)]">
            <ShieldCheck className="h-4 w-4 text-[var(--blue)]" aria-hidden="true" />
            Borrowing rules
          </h3>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--muted)]">
            {item.rules || 'Please return it on time and in the condition you received it.'}
          </p>
        </div>
      </div>

      {/* Right details & request panel */}
      <div className="flex flex-col justify-between space-y-6 bg-white p-5 sm:p-6 lg:col-span-6">
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  statusLabel === 'Available'
                    ? 'bg-[var(--blue)] text-white'
                    : 'border border-[var(--line)] bg-[var(--cream)] text-[var(--muted)]'
                }`}
              >
                {statusLabel}
              </span>
              <span className="text-xs font-bold text-[var(--orange)]">{item.category}</span>
              <span className="text-xs font-medium text-[var(--muted)]">
                {item.condition} · {item.neighborhood}
              </span>
            </div>

            <div className="mt-3 flex items-start justify-between gap-4">
              <h2 className="text-2xl font-extrabold text-[var(--navy)] sm:text-3xl">
                {item.name}
              </h2>
              <span className="shrink-0 rounded-full bg-[var(--sun-soft)] px-3.5 py-1 text-sm font-extrabold text-[var(--navy)]">
                FREE
              </span>
            </div>

            <p className="mt-3 text-sm font-medium leading-relaxed text-[var(--navy)]/85">
              {item.description}
            </p>
          </div>

          {/* Reserved dates strip */}
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--cream)] p-4">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--navy)]">
              <Calendar className="h-4 w-4 text-[var(--blue)]" aria-hidden="true" />
              <span>Reserved dates</span>
            </div>
            {itemBusy.length === 0 ? (
              <p className="mt-1.5 text-xs font-medium text-[var(--muted)]">
                No upcoming reservations — open for requests.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {itemBusy.map((b, idx) => (
                  <span
                    key={`${b.start_date}-${b.end_date}-${idx}`}
                    className="inline-flex items-center rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-bold text-[var(--navy)]"
                  >
                    Reserved {formatDateRange(b.start_date, b.end_date)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* How borrowing works mini-explainer */}
          <div className="rounded-3xl bg-[var(--sun-soft)] p-4">
            <p className="text-xs font-extrabold text-[var(--navy)]">How borrowing works</p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-xs font-semibold text-[var(--navy)] sm:grid-cols-3">
              <div className="flex items-start gap-1.5">
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--blue)]"
                  aria-hidden="true"
                />
                <span>1. Request dates</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--blue)]"
                  aria-hidden="true"
                />
                <span>2. Owner approves</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--blue)]"
                  aria-hidden="true"
                />
                <span>3. Pick up &amp; return</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action / Owner controls / Inline Request Form */}
        <div className="border-t border-[var(--line)] pt-5">
          {isOwner ? (
            <div className="space-y-3">
              <p className="text-sm font-extrabold text-[var(--blue)]">This is your item</p>
              {submitError && (
                <div
                  role="alert"
                  className="rounded-[14px] border border-[var(--danger)]/30 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-[var(--danger)]"
                >
                  {submitError}
                </div>
              )}
              {confirmRemove ? (
                <div className="space-y-3 rounded-2xl border border-[var(--danger)]/30 bg-red-50 p-3.5">
                  <p className="text-xs font-bold text-[var(--danger)]">
                    Remove "{item.name}" from ShareShelf? This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      loading={removing}
                      onClick={handleRemove}
                      className="min-h-[40px] px-4 py-2 text-xs"
                    >
                      Yes, remove
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmRemove(false)}
                      className="min-h-[40px] px-4 py-2 text-xs"
                    >
                      Keep item
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    variant="navy"
                    onClick={() => onEditItem(item)}
                    className="flex-1"
                  >
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmRemove(true)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ) : !item.is_available ? (
            <div className="space-y-2.5">
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button disabled variant="ghost" className="w-full sm:flex-1">
                  Currently unavailable
                </Button>
                <Button
                  variant="blue"
                  onClick={() =>
                    openChatWith({
                      recipient: item.owner || {
                        id: item.owner_id,
                        full_name: ownerName,
                        neighborhood: item.neighborhood,
                      },
                      item,
                    })
                  }
                  className="w-full sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Message {ownerName.split(' ')[0]}
                </Button>
              </div>
              <p className="text-center text-xs font-medium text-[var(--muted)]">
                The owner has paused borrowing for this item right now.
              </p>
            </div>
          ) : !showRequestForm ? (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button variant="orange" onClick={handleOpenRequestForm} className="w-full sm:flex-1">
                Request to borrow
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  openChatWith({
                    recipient: item.owner || {
                      id: item.owner_id,
                      full_name: ownerName,
                      neighborhood: item.neighborhood,
                    },
                    item,
                  })
                }
                className="w-full sm:w-auto"
              >
                <MessageCircle className="h-4 w-4 text-[var(--blue)]" aria-hidden="true" />
                Chat with {ownerName.split(' ')[0]}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRequestSubmit} className="space-y-4" noValidate>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[var(--navy)]">Choose borrow dates</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestForm(false);
                    setSubmitError(null);
                  }}
                  className="text-xs font-bold text-[var(--muted)] hover:text-[var(--navy)]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    htmlFor="borrow-start"
                    className="mb-1 block text-xs font-bold text-[var(--navy)]"
                  >
                    Start date
                  </label>
                  <input
                    id="borrow-start"
                    type="date"
                    min={today}
                    value={startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      if (endDate && val > endDate) {
                        setEndDate(val);
                      }
                      setSubmitError(null);
                    }}
                    className="min-h-[44px] min-w-0 w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-base font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none sm:text-sm"
                    required
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="borrow-end"
                    className="mb-1 block text-xs font-bold text-[var(--navy)]"
                  >
                    Return date
                  </label>
                  <input
                    id="borrow-end"
                    type="date"
                    min={startDate || today}
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setSubmitError(null);
                    }}
                    className="min-h-[44px] min-w-0 w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-base font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="borrow-msg" className="text-xs font-bold text-[var(--navy)]">
                    Message to {ownerName.split(' ')[0]} (optional)
                  </label>
                  <span className="text-[11px] font-bold text-[var(--muted)] tabular-nums">
                    {message.length}/300
                  </span>
                </div>
                <textarea
                  id="borrow-msg"
                  rows={2}
                  maxLength={300}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi! I'd love to borrow this for a weekend project."
                  className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-base font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none sm:text-sm"
                />
              </div>

              {(dateValidationError || submitError) && (
                <div
                  role="alert"
                  className="rounded-[14px] border border-[var(--danger)]/30 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-[var(--danger)]"
                >
                  {dateValidationError || submitError}
                </div>
              )}

              <Button
                type="submit"
                variant="blue"
                loading={submitting}
                disabled={Boolean(dateValidationError)}
                className="w-full"
              >
                Request to borrow
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
