import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Edit3, MessageCircle, PackagePlus, Plus, Trash2, UserCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { ItemThumbnail } from '../components/ItemThumbnail';
import { Modal } from '../components/Modal';
import { Page } from '../components/Motion';
import { EmptyShelfState } from '../components/ShelfLine';
import { Stepper } from '../components/Stepper';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { formatDateRange, getFirstName, getStatusLabel } from '../lib/format';
import type { BorrowRequest, BorrowRequestStatus, Item } from '../types';

type ActivityTab =
  | 'incoming'
  | 'borrowing'
  | 'my_requests'
  | 'active_loans'
  | 'completed'
  | 'my_items';

interface ActivityPageProps {
  onOpenShareModal: () => void;
  onEditItem: (item: Item) => void;
}

function getStatusBadgeClasses(status: BorrowRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-[var(--sun-soft)] text-[var(--navy)]';
    case 'approved':
      return 'bg-[var(--blue-soft)] text-[var(--blue)]';
    case 'active':
      return 'bg-[var(--blue)] text-white';
    case 'return_requested':
      return 'bg-[var(--orange-soft)] text-[var(--navy)]';
    case 'completed':
      return 'bg-[var(--sun)] text-[var(--navy)]';
    case 'rejected':
    case 'cancelled':
      return 'bg-red-50 text-[var(--danger)] border border-[var(--danger)]/25';
    default:
      return 'bg-[var(--cream)] text-[var(--muted)] border border-[var(--line)]';
  }
}

export function ActivityPage({ onOpenShareModal, onEditItem }: ActivityPageProps) {
  const { user, profile, openAuthModal } = useAuth();
  const { openChatWith } = useChat();
  const {
    items,
    requests,
    busyDates,
    loadingRequests,
    actionCount,
    changeRequestStatus,
    toggleItemAvailability,
    removeItem,
  } = useShareShelfData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [itemPendingDelete, setItemPendingDelete] = useState<Item | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<{ id: string; message: string } | null>(null);

  const myItems = useMemo(
    () => (user ? items.filter((it) => it.owner_id === user.id) : []),
    [items, user]
  );

  const incomingRequests = useMemo(() => {
    if (!user) return [];
    return requests.filter(
      (r) =>
        r.owner_id === user.id &&
        ['pending', 'return_requested', 'approved'].includes(r.status)
    );
  }, [requests, user]);

  const borrowingItems = useMemo(() => {
    if (!user) return [];
    return requests.filter(
      (r) =>
        r.borrower_id === user.id &&
        ['approved', 'active', 'return_requested'].includes(r.status)
    );
  }, [requests, user]);

  const myRequests = useMemo(() => {
    if (!user) return [];
    return requests.filter((r) => r.borrower_id === user.id);
  }, [requests, user]);

  const activeLoans = useMemo(() => {
    if (!user) return [];
    return requests.filter((r) => ['active', 'return_requested'].includes(r.status));
  }, [requests, user]);

  const completedExchanges = useMemo(() => {
    if (!user) return [];
    return requests.filter((r) => r.status === 'completed');
  }, [requests, user]);

  // Open on the tab with the most urgent action
  const urgentDefaultTab: ActivityTab = useMemo(() => {
    if (!user) return 'my_items';
    const ownerNeedsAction = requests.some(
      (r) => r.owner_id === user.id && (r.status === 'pending' || r.status === 'return_requested')
    );
    if (ownerNeedsAction) return 'incoming';

    const borrowerNeedsAction = requests.some(
      (r) => r.borrower_id === user.id && (r.status === 'approved' || r.status === 'active')
    );
    if (borrowerNeedsAction) return 'borrowing';

    if (myRequests.some((r) => r.status === 'pending')) return 'my_requests';
    if (myItems.length > 0) return 'my_items';
    return 'incoming';
  }, [myItems.length, myRequests, requests, user]);

  const paramTab = searchParams.get('tab') as ActivityTab | null;
  const [activeTab, setActiveTab] = useState<ActivityTab>(paramTab || urgentDefaultTab);

  useEffect(() => {
    if (paramTab) {
      setActiveTab(paramTab);
    } else if (!loadingRequests) {
      setActiveTab(urgentDefaultTab);
    }
  }, [paramTab, urgentDefaultTab, loadingRequests]);

  const selectTab = (tab: ActivityTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
    setInlineError(null);
  };

  if (!user) {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-12 pb-24 sm:px-6">
        <div className="rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
          <EmptyShelfState
            title="Sign in to continue. It only takes a minute."
            description="Track items you are sharing, incoming borrow requests from neighbors, and active pickups."
            action={
              <Button
                variant="orange"
                onClick={() => openAuthModal('Sign in to continue. It only takes a minute.')}
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                Sign in or try demo
              </Button>
            }
          />
        </div>
      </Page>
    );
  }

  const firstName = getFirstName(
    profile?.full_name || (user.user_metadata?.full_name as string) || user.email
  );

  const tabs: { id: ActivityTab; label: string; count: number }[] = [
    { id: 'my_items', label: 'My items', count: myItems.length },
    { id: 'incoming', label: 'Incoming requests', count: incomingRequests.length },
    { id: 'borrowing', label: "Items I'm borrowing", count: borrowingItems.length },
    { id: 'my_requests', label: 'My requests', count: myRequests.length },
    { id: 'active_loans', label: 'Active loans', count: activeLoans.length },
    { id: 'completed', label: 'Completed exchanges', count: completedExchanges.length },
  ];

  const handleStatusTransition = async (req: BorrowRequest, nextStatus: BorrowRequestStatus) => {
    setInlineError(null);
    setBusyActionId(`${req.id}:${nextStatus}`);
    try {
      await changeRequestStatus(req.id, nextStatus);
    } catch (err) {
      setInlineError({
        id: req.id,
        message: err instanceof Error ? err.message : 'Could not update request.',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemPendingDelete) return;
    const item = itemPendingDelete;
    setInlineError(null);
    setDeletingItemId(item.id);
    try {
      await removeItem(item.id);
      setItemPendingDelete(null);
    } catch (err) {
      setInlineError({
        id: item.id,
        message: err instanceof Error ? err.message : 'Could not remove item.',
      });
      setItemPendingDelete(null);
    } finally {
      setDeletingItemId(null);
    }
  };

  const renderRequestCard = (req: BorrowRequest) => {
    const isOwner = req.owner_id === user.id;
    const isBorrower = req.borrower_id === user.id;
    const otherPerson = isOwner ? req.borrower : req.owner;

    return (
      <motion.article
        key={req.id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)] sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* Item thumbnail */}
          <Link
            to={`/item/${req.item_id}`}
            className="w-full shrink-0 overflow-hidden rounded-2xl border border-[var(--line)] sm:w-36"
          >
            <ItemThumbnail
              imageUrl={req.item?.image_url}
              name={req.item?.name || 'Shared item'}
              category={req.item?.category || 'Other'}
              iconSize="sm"
            />
          </Link>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/item/${req.item_id}`}
                  className="text-lg font-extrabold text-[var(--navy)] hover:text-[var(--blue)] hover:underline"
                >
                  {req.item?.name || 'Shared item'}
                </Link>
                <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">
                  {isOwner ? 'Requested by ' : 'Owned by '}
                  <span className="font-bold text-[var(--navy)]">
                    {otherPerson?.full_name || 'Neighbor'}
                  </span>
                  {otherPerson?.neighborhood ? ` (${otherPerson.neighborhood})` : ''} ·{' '}
                  <span className="font-bold text-[var(--navy)]">
                    {formatDateRange(req.start_date, req.end_date)}
                  </span>
                </p>
              </div>

              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${getStatusBadgeClasses(
                  req.status
                )}`}
              >
                {getStatusLabel(req.status)}
              </span>
            </div>

            {req.message && (
              <p className="rounded-2xl bg-[var(--cream)] px-3.5 py-2.5 text-sm font-medium text-[var(--navy)]/85">
                "{req.message}"
              </p>
            )}

            {/* Animated v2 Stepper */}
            <Stepper status={req.status} />

            {inlineError?.id === req.id && (
              <div
                role="alert"
                className="rounded-[14px] border border-[var(--danger)]/30 bg-red-50 px-3.5 py-2 text-xs font-bold text-[var(--danger)]"
              >
                {inlineError.message}
              </div>
            )}

            {/* Action buttons based on role and status */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {isOwner && req.status === 'pending' && (
                <>
                  <Button
                    variant="blue"
                    loading={busyActionId === `${req.id}:approved`}
                    disabled={busyActionId !== null}
                    onClick={() => handleStatusTransition(req, 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    loading={busyActionId === `${req.id}:rejected`}
                    disabled={busyActionId !== null}
                    onClick={() => handleStatusTransition(req, 'rejected')}
                  >
                    Decline
                  </Button>
                </>
              )}

              {isBorrower && req.status === 'approved' && (
                <Button
                  variant="blue"
                  loading={busyActionId === `${req.id}:active`}
                  disabled={busyActionId !== null}
                  onClick={() => handleStatusTransition(req, 'active')}
                >
                  I picked it up
                </Button>
              )}

              {isBorrower && req.status === 'active' && (
                <Button
                  variant="orange"
                  loading={busyActionId === `${req.id}:return_requested`}
                  disabled={busyActionId !== null}
                  onClick={() => handleStatusTransition(req, 'return_requested')}
                >
                  Request return confirmation
                </Button>
              )}

              {isOwner && req.status === 'return_requested' && (
                <Button
                  variant="blue"
                  loading={busyActionId === `${req.id}:completed`}
                  disabled={busyActionId !== null}
                  onClick={() => handleStatusTransition(req, 'completed')}
                >
                  Confirm item returned
                </Button>
              )}

              {isBorrower && (req.status === 'pending' || req.status === 'approved') && (
                <Button
                  variant="ghost"
                  loading={busyActionId === `${req.id}:cancelled`}
                  disabled={busyActionId !== null}
                  onClick={() => handleStatusTransition(req, 'cancelled')}
                >
                  Cancel request
                </Button>
              )}

              {otherPerson && otherPerson.id !== user.id && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    openChatWith({
                      recipient: otherPerson,
                      item: req.item
                        ? {
                            id: req.item.id,
                            name: req.item.name,
                            image_url: req.item.image_url,
                            category: req.item.category,
                            neighborhood: req.item.neighborhood,
                          }
                        : null,
                      requestId: req.id,
                    })
                  }
                  className="sm:ml-auto"
                >
                  <MessageCircle className="h-4 w-4 text-[var(--blue)]" aria-hidden="true" />
                  Chat with {getFirstName(otherPerson.full_name)}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.article>
    );
  };

  const currentRequestList =
    activeTab === 'incoming'
      ? incomingRequests
      : activeTab === 'borrowing'
        ? borrowingItems
        : activeTab === 'my_requests'
          ? myRequests
          : activeTab === 'active_loans'
            ? activeLoans
            : completedExchanges;

  const emptyMessageMap: Record<Exclude<ActivityTab, 'my_items'>, string> = {
    incoming: "No requests waiting. They'll show up here.",
    borrowing: "You're not borrowing anything right now. Browse items.",
    my_requests: 'No requests yet. Find something you need.',
    active_loans: 'None of your items are out on loan.',
    completed: 'Your finished exchanges will appear here.',
  };

  return (
    <Page className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--navy)] sm:text-4xl">
            Hi, {firstName}
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            {actionCount === 0
              ? "You're all caught up on your neighborhood exchanges."
              : `${actionCount} ${actionCount === 1 ? 'thing needs' : 'things need'} your attention`}
          </p>
        </div>

        <Button
          variant="orange"
          onClick={onOpenShareModal}
          className="self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Share an item
        </Button>
      </div>

      {/* Scrollable tabs with sliding underline */}
      <LayoutGroup id="activity-tabs">
        <div
          role="tablist"
          aria-label="Activity sections"
          className="no-scrollbar mt-6 flex items-center gap-2 overflow-x-auto border-b border-[var(--line)] pb-1"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(tab.id)}
                className="relative inline-flex min-h-[44px] shrink-0 items-center gap-2 px-3 py-2 text-sm font-bold whitespace-nowrap transition-colors"
              >
                <span className={isActive ? 'text-[var(--blue)]' : 'text-[var(--muted)]'}>
                  {tab.label}
                </span>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums ${
                    isActive
                      ? 'bg-[var(--blue)] text-white'
                      : 'bg-[var(--sun-soft)] text-[var(--navy)]'
                  }`}
                >
                  {tab.count}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="activity-underline"
                    className="absolute inset-x-2 -bottom-1 h-1 rounded-full bg-[var(--blue)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'my_items' ? (
          myItems.length === 0 ? (
            <div className="rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
              <EmptyShelfState
                title="Nothing on your shelf yet. Share your first item."
                description="Share a drill, ladder, projector, or board game so a neighbor can put it to good use."
                action={
                  <Button variant="orange" onClick={onOpenShareModal}>
                    <PackagePlus className="h-4 w-4" aria-hidden="true" />
                    Share an item
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {myItems.map((item) => {
                const hasActiveReservation = busyDates.some((b) => b.item_id === item.id);
                return (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)] sm:p-5"
                  >
                    <div className="flex gap-3 sm:gap-4">
                      <Link
                        to={`/item/${item.id}`}
                        className="w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--line)] sm:w-28"
                      >
                        <ItemThumbnail
                          imageUrl={item.image_url}
                          name={item.name}
                          category={item.category}
                          iconSize="sm"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/item/${item.id}`}
                            className="truncate text-base font-extrabold text-[var(--navy)] hover:text-[var(--blue)] hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              item.is_available
                                ? 'bg-[var(--blue)] text-white'
                                : 'border border-[var(--line)] bg-[var(--cream)] text-[var(--muted)]'
                            }`}
                          >
                            {item.is_available ? 'Available' : 'Paused'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">
                          {item.category} · {item.condition} · {item.neighborhood}
                        </p>
                        {hasActiveReservation && (
                          <p className="mt-1.5 text-xs font-bold text-[var(--blue)]">
                            Has an approved or active loan
                          </p>
                        )}
                      </div>
                    </div>

                    {inlineError?.id === item.id && (
                      <div
                        role="alert"
                        className="mt-3 rounded-[14px] border border-[var(--danger)]/30 bg-red-50 px-3.5 py-2 text-xs font-bold text-[var(--danger)]"
                      >
                        {inlineError.message}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3.5">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[var(--navy)]">
                        <input
                          type="checkbox"
                          checked={item.is_available}
                          onChange={() => toggleItemAvailability(item)}
                          className="h-4 w-4 rounded accent-[var(--blue)]"
                        />
                        <span>Available for neighbors</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => onEditItem(item)}
                          className="min-h-[38px] px-4 py-1.5 text-xs"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            if (hasActiveReservation) {
                              setInlineError({
                                id: item.id,
                                message:
                                  'This item cannot be removed while a loan is approved or active.',
                              });
                              return;
                            }
                            setInlineError(null);
                            setItemPendingDelete(item);
                          }}
                          className="min-h-[38px] px-4 py-1.5 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : loadingRequests ? (
          <div className="space-y-4">
            {[0, 1].map((n) => (
              <div
                key={n}
                className="shimmer h-44 rounded-3xl border border-[var(--line)] bg-white"
              />
            ))}
          </div>
        ) : currentRequestList.length === 0 ? (
          <div className="rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
            <EmptyShelfState
              title={emptyMessageMap[activeTab]}
              description="Explore items nearby on Discover to borrow what you need."
              action={
                <Button variant="navy" onClick={() => navigate('/')}>
                  Explore items
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">{currentRequestList.map(renderRequestCard)}</div>
        )}
      </div>

      {/* Confirmation sheet for removing an item */}
      <Modal
        open={Boolean(itemPendingDelete)}
        onClose={() => setItemPendingDelete(null)}
        title="Remove item?"
        maxWidthClass="max-w-md"
      >
        {itemPendingDelete && (
          <div className="space-y-4 p-5 sm:p-6">
            <p className="text-sm font-medium text-[var(--navy)]">
              Remove <strong>{itemPendingDelete.name}</strong> from ShareShelf? Neighbors will no
              longer see it on Discover.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setItemPendingDelete(null)}>
                Keep item
              </Button>
              <Button
                variant="danger"
                loading={deletingItemId === itemPendingDelete.id}
                onClick={handleConfirmDeleteItem}
              >
                Remove
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
