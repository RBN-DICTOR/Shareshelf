import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/Button';
import { CategoryChips } from '../components/CategoryChips';
import { Modal } from '../components/Modal';
import { Page, Reveal } from '../components/Motion';
import { EmptyShelfState } from '../components/ShelfLine';
import { useAuth } from '../hooks/useAuth';
import { useShareShelfData } from '../hooks/useShareShelfData';
import {
  cleanText,
  formatRelativeTime,
  formatShortDate,
  getInitials,
  getTodayISO,
} from '../lib/format';
import { ITEM_CATEGORIES, type ItemWant } from '../types';

export function WantedPage() {
  const { user, profile, openAuthModal } = useAuth();
  const {
    wants,
    loadingWants,
    addWant,
    markWantFulfilled,
    removeWant,
    respondToWant,
  } = useShareShelfData();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All');
  const [showFulfilled, setShowFulfilled] = useState(false);

  // Create want modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Tools');
  const [neighborhood, setNeighborhood] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Respond drawer/modal state
  const [activeWantId, setActiveWantId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const today = getTodayISO();

  const activeWant = useMemo(
    () => wants.find((w) => w.id === activeWantId) || null,
    [wants, activeWantId]
  );

  const wantNeighborhoods = useMemo(() => {
    const set = new Set<string>();
    wants.forEach((w) => {
      if (w.neighborhood?.trim()) set.add(w.neighborhood.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [wants]);

  const filteredWants = useMemo(() => {
    return wants.filter((w) => {
      if (!showFulfilled && w.status !== 'open') return false;
      if (selectedCategory !== 'All' && w.category !== selectedCategory) return false;
      if (selectedNeighborhood !== 'All' && w.neighborhood !== selectedNeighborhood) return false;
      return true;
    });
  }, [wants, selectedCategory, selectedNeighborhood, showFulfilled]);

  const handleOpenCreate = () => {
    const openForm = () => {
      setTitle('');
      setDescription('');
      setCategory('Tools');
      setNeighborhood(profile?.neighborhood || '');
      setNeededBy('');
      setCreateError(null);
      setCreateOpen(true);
    };
    if (!user) {
      openAuthModal('Sign in to continue. It only takes a minute.', openForm);
      return;
    }
    openForm();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!cleanText(title)) {
      setCreateError('What item are you looking for?');
      return;
    }
    if (!cleanText(neighborhood)) {
      setCreateError('Please enter your neighborhood.');
      return;
    }
    if (!neededBy) {
      setCreateError('Choose the date you need it by.');
      return;
    }
    if (neededBy < today) {
      setCreateError('Needed-by date cannot be in the past.');
      return;
    }

    setCreating(true);
    try {
      await addWant({
        title: cleanText(title),
        description: cleanText(description),
        category,
        neighborhood: cleanText(neighborhood),
        needed_by: neededBy,
      });
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not post your request.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRespond = (want: ItemWant) => {
    setActiveWantId(want.id);
    setReplyMessage('');
    setReplyError(null);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWant) return;
    setReplyError(null);

    if (!user) {
      openAuthModal('Sign in to continue. It only takes a minute.');
      return;
    }
    if (!cleanText(replyMessage)) {
      setReplyError('Write a short message letting your neighbor know how you can help.');
      return;
    }

    setSendingReply(true);
    try {
      await respondToWant(activeWant.id, cleanText(replyMessage), activeWant.requester?.full_name);
      setReplyMessage('');
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Could not send response.');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <Page className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:pb-16">
      {/* Header */}
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--navy)] sm:text-4xl [text-wrap:balance]">
              Can't find it? Ask your neighbors.
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm font-medium text-[var(--muted)] sm:text-base">
              Post what you need for a project or weekend trip — someone nearby might have one in a
              closet.
            </p>
          </div>

          <Button
            variant="orange"
            onClick={handleOpenCreate}
            className="self-start sm:self-auto shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Request an item
          </Button>
        </div>
      </Reveal>

      {/* Category & Neighborhood filters & Fulfilled toggle */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <CategoryChips
            id="wanted-categories"
            value={selectedCategory}
            onChange={setSelectedCategory}
            items={ITEM_CATEGORIES}
            allLabel="All requests"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {wantNeighborhoods.length > 0 && (
            <select
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              aria-label="Filter neighbor requests by neighborhood"
              className="min-h-[40px] rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
            >
              <option value="All">All neighborhoods</option>
              {wantNeighborhoods.map((hood) => (
                <option key={hood} value={hood}>
                  {hood}
                </option>
              ))}
            </select>
          )}

          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold text-[var(--muted)]">
            <input
              type="checkbox"
              checked={showFulfilled}
              onChange={(e) => setShowFulfilled(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--blue)]"
            />
            <span>Show fulfilled</span>
          </label>
        </div>
      </div>

      {/* Wants Grid */}
      <div className="mt-6">
        {loadingWants ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((n) => (
              <div
                key={n}
                className="shimmer h-52 rounded-3xl border border-[var(--line)] bg-white"
              />
            ))}
          </div>
        ) : filteredWants.length === 0 ? (
          <div className="rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
            <EmptyShelfState
              title="No requests yet. Be the first to ask."
              description="Looking for a ladder, camping stove, or sewing machine? Ask your neighbors first before buying new."
              action={
                <Button variant="orange" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Request an item
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredWants.map((want) => {
              const isRequester = Boolean(user && user.id === want.requester_id);
              const requesterName = want.requester?.full_name || 'Neighbor';
              const responseCount = want.want_responses?.length || 0;

              return (
                <article
                  key={want.id}
                  className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--orange)]">
                        {want.category} · {want.neighborhood}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          want.status === 'fulfilled'
                            ? 'bg-[var(--sun-soft)] text-[var(--navy)]'
                            : 'bg-[var(--blue)] text-white'
                        }`}
                      >
                        {want.status === 'fulfilled' ? 'Fulfilled' : 'Open'}
                      </span>
                    </div>

                    <h2 className="mt-2 text-lg font-extrabold text-[var(--navy)]">
                      {want.title}
                    </h2>

                    {want.description && (
                      <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--navy)]/80">
                        {want.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-[var(--blue)]" aria-hidden="true" />
                        Needed by {formatShortDate(want.needed_by)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[var(--blue)]" aria-hidden="true" />
                        {want.neighborhood}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 border-t border-[var(--line)] pt-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sun-soft)] text-[11px] font-extrabold text-[var(--navy)]">
                          {getInitials(requesterName)}
                        </span>
                        <span className="truncate text-xs font-bold text-[var(--navy)]">
                          {requesterName}
                        </span>
                      </div>

                      <Button
                        variant="blue"
                        onClick={() => handleOpenRespond(want)}
                        className="min-h-[40px] shrink-0 px-4 py-2 text-xs"
                      >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        Respond ({responseCount})
                      </Button>
                    </div>

                    {isRequester && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            markWantFulfilled(
                              want.id,
                              want.status === 'open' ? 'fulfilled' : 'open'
                            )
                          }
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--cream)] px-3 py-1.5 text-xs font-bold text-[var(--blue)] hover:bg-[var(--sun-soft)]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {want.status === 'open' ? 'Mark as fulfilled' : 'Reopen'}
                        </button>

                        {confirmDeleteId === want.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await removeWant(want.id);
                                setConfirmDeleteId(null);
                              }}
                              className="min-h-[38px] rounded-full bg-[var(--danger)] px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[38px] rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--navy)]"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(want.id)}
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-[var(--danger)] hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Request Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ask your neighbors"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
          <div>
            <label htmlFor="want-title" className="mb-1 block text-sm font-bold text-[var(--navy)]">
              Item needed
            </label>
            <input
              id="want-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Pressure washer for patio"
              className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="want-desc" className="mb-1 block text-sm font-bold text-[var(--navy)]">
              Details (optional)
            </label>
            <textarea
              id="want-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share how long you need it for or any helpful specs."
              className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="want-cat" className="mb-1 block text-sm font-bold text-[var(--navy)]">
                Category
              </label>
              <select
                id="want-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="min-w-0 w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
              >
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="want-date" className="mb-1 block text-sm font-bold text-[var(--navy)]">
                Needed by
              </label>
              <input
                id="want-date"
                type="date"
                min={today}
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className="min-w-0 w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="want-hood" className="mb-1 block text-sm font-bold text-[var(--navy)]">
              Neighborhood
            </label>
            <input
              id="want-hood"
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="e.g., Riverside"
              className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
              required
            />
          </div>

          {createError && (
            <div
              role="alert"
              className="rounded-[14px] border border-[var(--danger)]/30 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-[var(--danger)]"
            >
              {createError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="orange" loading={creating}>
              Post request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Respond Modal */}
      <Modal
        open={Boolean(activeWant)}
        onClose={() => setActiveWantId(null)}
        title={activeWant ? activeWant.title : 'Respond to neighbor'}
        maxWidthClass="max-w-lg"
      >
        {activeWant && (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-bold text-[var(--muted)]">
                Asked by {activeWant.requester?.full_name || 'Neighbor'} · {activeWant.neighborhood}{' '}
                · Needed by {formatShortDate(activeWant.needed_by)}
              </p>
              {activeWant.description && (
                <p className="mt-2 text-sm font-medium text-[var(--navy)]">
                  {activeWant.description}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-[var(--navy)]">
                Neighbor responses ({activeWant.want_responses?.length || 0})
              </h3>
              <div className="mt-3 max-h-60 space-y-2.5 overflow-y-auto">
                {!activeWant.want_responses || activeWant.want_responses.length === 0 ? (
                  <p className="rounded-2xl bg-[var(--sun-soft)]/70 px-4 py-3 text-xs font-semibold text-[var(--navy)]">
                    No responses yet — be the first neighbor to offer help!
                  </p>
                ) : (
                  activeWant.want_responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="rounded-2xl border border-[var(--line)] bg-white p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[var(--navy)]">
                          {resp.responder?.full_name || 'Neighbor'}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--muted)]">
                          {formatRelativeTime(resp.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-[var(--navy)]/90">
                        {resp.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {user ? (
              <form onSubmit={handleSendReply} className="space-y-3 border-t border-[var(--line)] pt-4">
                <label
                  htmlFor="want-reply"
                  className="block text-sm font-bold text-[var(--navy)]"
                >
                  Reply to {activeWant.requester?.full_name?.split(' ')[0] || 'neighbor'}
                </label>
                <textarea
                  id="want-reply"
                  rows={2}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="I have one you can borrow"
                  className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
                  required
                />
                {replyError && (
                  <p role="alert" className="text-xs font-bold text-[var(--danger)]">
                    {replyError}
                  </p>
                )}
                <Button type="submit" variant="blue" loading={sendingReply} className="w-full">
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Respond
                </Button>
              </form>
            ) : (
              <div className="border-t border-[var(--line)] pt-4">
                <Button
                  variant="orange"
                  onClick={() => openAuthModal('Sign in to continue. It only takes a minute.')}
                  className="w-full"
                >
                  Sign in to respond
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Page>
  );
}
