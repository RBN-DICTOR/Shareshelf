import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { formatRelativeTime, getFirstName, getInitials } from '../lib/format';
import type { Profile } from '../types';
import { Button } from './Button';
import { ItemThumbnail } from './ItemThumbnail';
import { Modal } from './Modal';

const QUICK_REPLIES = [
  'Hi! Is this available for pickup?',
  'What time works best to meet?',
  'On my way now!',
  'Just returned it — thank you!',
] as const;

export function ChatDrawer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, requests } = useShareShelfData();
  const {
    threads,
    unreadMessagesCount,
    drawerOpen,
    activeConversation,
    selectThread,
    openChatWith,
    clearActiveConversation,
    closeChat,
    sendMessage,
  } = useChat();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeThreadMessages = useMemo(() => {
    if (!activeConversation) return [];
    const found = threads.find((t) => t.threadKey === activeConversation.threadKey);
    return found?.messages || [];
  }, [activeConversation, threads]);

  // Suggested neighbors to message if inbox is empty or user wants a quick start
  const suggestedContacts = useMemo(() => {
    if (!user) return [];
    const seen = new Set<string>();
    const results: Array<{
      key: string;
      recipient: Profile;
      item: (typeof items)[number] | null;
      subtitle: string;
    }> = [];

    for (const req of requests) {
      const other = req.owner_id === user.id ? req.borrower : req.owner;
      if (!other || other.id === user.id) continue;
      const key = `${req.item_id}::${other.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        key,
        recipient: other,
        item: req.item || null,
        subtitle: req.item?.name ? `About ${req.item.name}` : 'Borrow request',
      });
      if (results.length >= 4) return results;
    }

    for (const it of items) {
      if (it.owner_id === user.id || !it.owner) continue;
      const key = `${it.id}::${it.owner.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        key,
        recipient: it.owner,
        item: it,
        subtitle: `${it.name} · ${it.neighborhood}`,
      });
      if (results.length >= 4) break;
    }

    return results;
  }, [items, requests, user]);

  useEffect(() => {
    if (!drawerOpen || !activeConversation) return;
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [drawerOpen, activeConversation, activeThreadMessages.length]);

  useEffect(() => {
    setSendError(null);
  }, [activeConversation?.threadKey]);

  const handleSend = async (textToSend?: string) => {
    const content = (textToSend ?? draft).trim();
    if (!content || !activeConversation || sending) return;
    setSendError(null);
    setSending(true);
    try {
      await sendMessage(content);
      if (textToSend === undefined) {
        setDraft('');
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSend();
  };

  const handleOpenItem = (itemId: string) => {
    closeChat();
    navigate(`/item/${itemId}`);
  };

  const showConversationOnMobile = Boolean(activeConversation);

  return (
    <Modal
      open={drawerOpen}
      onClose={closeChat}
      title={
        unreadMessagesCount > 0
          ? `Neighbor Messages (${unreadMessagesCount} unread)`
          : 'Neighbor Messages'
      }
      maxWidthClass="max-w-4xl"
    >
      <div className="flex h-[74dvh] min-h-[420px] max-h-[640px] flex-col overflow-hidden bg-white md:flex-row">
        {/* Left column: Inbox / Conversation list */}
        <aside
          className={`flex-col border-b border-[var(--line)] bg-[var(--cream)] md:flex md:w-80 md:shrink-0 md:border-r md:border-b-0 ${
            showConversationOnMobile ? 'hidden' : 'flex min-h-0 flex-1 md:flex-initial'
          }`}
        >
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="text-xs font-extrabold text-[var(--muted)]">
              {threads.length > 0
                ? `${threads.length} ${threads.length === 1 ? 'conversation' : 'conversations'}`
                : 'Your inbox'}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[var(--line)]">
            {threads.length === 0 ? (
              <div className="p-4 space-y-4">
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sun-soft)] text-[var(--blue)]">
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-extrabold text-[var(--navy)]">No messages yet</p>
                  <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                    Coordinate pickup times, care tips, and returns directly with neighbors.
                  </p>
                </div>

                {suggestedContacts.length > 0 && (
                  <div className="space-y-2">
                    <p className="px-1 text-xs font-extrabold text-[var(--navy)]">
                      Message a neighbor
                    </p>
                    {suggestedContacts.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() =>
                          openChatWith({
                            recipient: c.recipient,
                            item: c.item,
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 text-left transition-colors hover:bg-[var(--sun-soft)]/60"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-xs font-extrabold text-white">
                          {getInitials(c.recipient.full_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-extrabold text-[var(--navy)]">
                            {c.recipient.full_name}
                          </p>
                          <p className="truncate text-[11px] font-medium text-[var(--muted)]">
                            {c.subtitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = activeConversation?.threadKey === thread.threadKey;
                return (
                  <button
                    key={thread.threadKey}
                    type="button"
                    onClick={() => selectThread(thread)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--blue-soft)]/70'
                        : 'bg-transparent hover:bg-white'
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-xs font-extrabold text-white">
                      {getInitials(thread.otherUser.full_name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-extrabold text-[var(--navy)]">
                          {thread.otherUser.full_name}
                        </p>
                        <span className="shrink-0 text-[11px] font-semibold text-[var(--muted)]">
                          {formatRelativeTime(thread.lastMessageAt)}
                        </span>
                      </div>

                      {thread.itemName && (
                        <p className="truncate text-[11px] font-bold text-[var(--orange)]">
                          {thread.itemName}
                        </p>
                      )}

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-xs ${
                            thread.unreadCount > 0
                              ? 'font-bold text-[var(--navy)]'
                              : 'font-medium text-[var(--muted)]'
                          }`}
                        >
                          {thread.lastMessage}
                        </p>
                        {thread.unreadCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] px-1.5 text-[10px] font-extrabold text-white tabular-nums">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right column: Active conversation */}
        <section
          className={`min-h-0 flex-1 flex-col bg-white ${
            showConversationOnMobile ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={clearActiveConversation}
                    aria-label="Back to conversations"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--cream)] text-[var(--navy)] hover:bg-[var(--sun-soft)] md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-xs font-extrabold text-white">
                    {getInitials(activeConversation.recipient.full_name)}
                  </span>

                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-extrabold text-[var(--navy)]">
                      {activeConversation.recipient.full_name}
                    </h3>
                    <p className="flex items-center gap-1 truncate text-xs font-medium text-[var(--muted)]">
                      <MapPin className="h-3 w-3 shrink-0 text-[var(--blue)]" aria-hidden="true" />
                      <span className="truncate">
                        {activeConversation.recipient.neighborhood || 'Neighbor'}
                      </span>
                    </p>
                  </div>
                </div>

                {activeConversation.item && (
                  <button
                    type="button"
                    onClick={() => handleOpenItem(activeConversation.item!.id)}
                    className="inline-flex max-w-[175px] shrink-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--cream)] px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--sun-soft)]"
                  >
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                      <ItemThumbnail
                        imageUrl={activeConversation.item.image_url}
                        name={activeConversation.item.name}
                        category={activeConversation.item.category}
                        iconSize="sm"
                      />
                    </div>
                    <span className="truncate text-xs font-bold text-[var(--navy)]">
                      {activeConversation.item.name}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-[var(--blue)]" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Message feed */}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--cream)]/55 p-4">
                {activeThreadMessages.length === 0 ? (
                  <div className="mx-auto max-w-sm py-8 text-center">
                    <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--sun-soft)] text-[var(--orange)]">
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-extrabold text-[var(--navy)]">
                      Say hello to {getFirstName(activeConversation.recipient.full_name)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                      {activeConversation.item
                        ? `Ask about ${activeConversation.item.name}, arrange pickup, or share return plans.`
                        : 'Send a quick message to coordinate your neighborhood share.'}
                    </p>
                  </div>
                ) : (
                  activeThreadMessages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm font-medium leading-relaxed shadow-sm sm:max-w-[75%] ${
                            isMine
                              ? 'rounded-br-md bg-[var(--blue)] text-white'
                              : 'rounded-bl-md border border-[var(--line)] bg-white text-[var(--navy)]'
                          }`}
                        >
                          <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                        </div>
                        <span className="mt-1 px-1.5 text-[10px] font-semibold text-[var(--muted)]">
                          {formatRelativeTime(msg.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies */}
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-[var(--line)] bg-white px-4 py-2">
                {QUICK_REPLIES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={sending}
                    onClick={() => void handleSend(preset)}
                    className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--cream)] px-3 py-1.5 text-xs font-bold text-[var(--navy)] whitespace-nowrap transition-colors hover:bg-[var(--sun-soft)] disabled:opacity-50"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Message composer */}
              <form
                onSubmit={handleFormSubmit}
                className="border-t border-[var(--line)] bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
              >
                {sendError && (
                  <p role="alert" className="mb-2 text-xs font-bold text-[var(--danger)]">
                    {sendError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={1000}
                    placeholder={`Message ${getFirstName(activeConversation.recipient.full_name)}...`}
                    aria-label="Write a message"
                    className="min-h-[44px] min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--cream)] px-4 py-2 text-base font-medium text-[var(--navy)] placeholder:text-[var(--muted)] focus:border-[var(--blue)] focus:bg-white focus:outline-none sm:text-sm"
                  />
                  <Button
                    type="submit"
                    variant="blue"
                    loading={sending}
                    disabled={!draft.trim()}
                    aria-label="Send message"
                    className="min-h-[44px] shrink-0 px-4 sm:px-5"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sun-soft)] text-[var(--blue)]">
                <MessageCircle className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-extrabold text-[var(--navy)]">
                Choose a conversation
              </h3>
              <p className="mt-1.5 max-w-sm text-sm font-medium text-[var(--muted)]">
                Select an existing thread on the left or click "Message neighbor" on any item or
                borrow request.
              </p>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
