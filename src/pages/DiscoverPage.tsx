import React, { useMemo, useState } from 'react';
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { CategoryChips } from '../components/CategoryChips';
import { Hero } from '../components/Hero';
import { ItemCard, SkeletonCard } from '../components/ItemCard';
import { Reveal } from '../components/Motion';
import { EmptyShelfState } from '../components/ShelfLine';
import { useAuth } from '../hooks/useAuth';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { isItemOnLoanToday } from '../lib/format';
import { ITEM_CATEGORIES, type Item } from '../types';

interface DiscoverPageProps {
  onOpenShareModal: () => void;
}

const LOOP_STEPS = [
  { num: '1', title: 'Request', desc: 'Pick dates that work for your project' },
  { num: '2', title: 'Get approved', desc: 'Confirm pickup with your neighbor' },
  { num: '3', title: 'Return', desc: 'Bring it back and complete the loop' },
] as const;

export function DiscoverPage({ onOpenShareModal }: DiscoverPageProps) {
  const navigate = useNavigate();
  const { user, profile, openAuthModal } = useAuth();
  const { items, busyDates, loadingItems } = useShareShelfData();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [hideLoopStrip, setHideLoopStrip] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('shareshelf_hide_loop_strip') === '1';
    } catch {
      return false;
    }
  });

  const dismissLoopStrip = () => {
    setHideLoopStrip(true);
    try {
      window.localStorage.setItem('shareshelf_hide_loop_strip', '1');
    } catch {
      // ignore storage errors
    }
  };

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const neighborhoodCounts = useMemo(() => {
    const counts = new Map<string, number>();
    safeItems.forEach((it) => {
      const hood = it.neighborhood?.trim();
      if (hood) {
        counts.set(hood, (counts.get(hood) || 0) + 1);
      }
    });
    const myHood = profile?.neighborhood?.trim().toLowerCase() || '';
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        isMine: Boolean(myHood && name.toLowerCase() === myHood),
      }))
      .sort((a, b) => {
        if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [profile?.neighborhood, safeItems]);

  const neighborhoods = useMemo(
    () => neighborhoodCounts.map((n) => n.name),
    [neighborhoodCounts]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return safeItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (selectedNeighborhood !== 'All' && item.neighborhood !== selectedNeighborhood) {
        return false;
      }
      if (availableOnly) {
        if (!item.is_available || isItemOnLoanToday(busyDates, item.id)) {
          return false;
        }
      }
      if (q) {
        const haystack =
          `${item.name} ${item.description} ${item.category} ${item.neighborhood}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [safeItems, busyDates, search, selectedCategory, selectedNeighborhood, availableOnly]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedCategory !== 'All' ||
    selectedNeighborhood !== 'All' ||
    availableOnly;

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('All');
    setSelectedNeighborhood('All');
    setAvailableOnly(false);
  };

  const handleShareClick = () => {
    if (!user) {
      openAuthModal('Sign in to continue. It only takes a minute.', () => {
        onOpenShareModal();
      });
      return;
    }
    onOpenShareModal();
  };

  const handleSelectItem = (item: Item) => {
    navigate(`/item/${item.id}`);
  };

  const scrollToGrid = () => {
    document.getElementById('discover-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="pb-28 lg:pb-16">
      {/* v2 Hero */}
      <Hero
        items={items}
        loading={loadingItems}
        onExplore={scrollToGrid}
        onShare={handleShareClick}
        onSelectItem={handleSelectItem}
      />

      {/* Dismissible "How the loop works" strip */}
      <AnimatePresence>
        {!hideLoopStrip && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8"
          >
            <div className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-[var(--orange)]">
                    How the loop works
                  </span>
                  <p className="mt-0.5 text-sm font-bold text-[var(--navy)]">
                    New here? Browse, request, return. That's the whole loop.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissLoopStrip}
                  aria-label="Dismiss how the loop works"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full border border-[var(--line)] bg-[var(--cream)] text-[var(--muted)] hover:bg-[var(--sun-soft)] hover:text-[var(--navy)] sm:self-auto"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {LOOP_STEPS.map((step, idx) => (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.08 }}
                    className="flex items-start gap-3 rounded-2xl bg-[var(--sun-soft)]/70 p-3.5"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--blue)] text-xs font-extrabold text-white">
                      {step.num}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[var(--navy)]">{step.title}</p>
                      <p className="text-xs font-medium text-[var(--navy)]/80">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <section id="discover-grid" className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-extrabold text-[var(--navy)] sm:text-3xl">
              Find something nearby
            </h2>
            <p className="text-sm font-semibold text-[var(--muted)] tabular-nums">
              {loadingItems
                ? 'Loading neighborhood shelf...'
                : `${filteredItems.length} ${
                    filteredItems.length === 1 ? 'item' : 'items'
                  } available to explore`}
            </p>
          </div>
        </Reveal>

        <div className="space-y-3">
          {/* Search + Neighborhood + Available toggle */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search drills, tents, books, or neighborhoods..."
                aria-label="Search neighborhood items"
                className="min-h-[48px] w-full rounded-full border border-[var(--line)] bg-white pl-12 pr-11 text-base font-medium text-[var(--navy)] shadow-[var(--shadow)] placeholder:text-[var(--muted)] focus:border-[var(--blue)] focus:outline-none sm:text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--sun-soft)] hover:text-[var(--navy)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
              <select
                value={selectedNeighborhood}
                onChange={(e) => setSelectedNeighborhood(e.target.value)}
                aria-label="Filter by neighborhood"
                className="min-h-[44px] min-w-0 flex-1 basis-[170px] rounded-full border border-[var(--line)] bg-white px-4 py-2 text-base font-bold text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none sm:flex-initial sm:basis-auto sm:text-sm"
              >
                <option value="All">All neighborhoods ({safeItems.length})</option>
                {neighborhoodCounts.map((hood) => (
                  <option key={hood.name} value={hood.name}>
                    {hood.name} ({hood.count})
                  </option>
                ))}
              </select>

              <button
                type="button"
                role="switch"
                aria-checked={availableOnly}
                onClick={() => setAvailableOnly((v) => !v)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                  availableOnly
                    ? 'border-[var(--sun)] bg-[var(--sun)] text-[var(--navy)]'
                    : 'border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[var(--sun-soft)]'
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    availableOnly ? 'bg-[var(--blue)]' : 'bg-[var(--line)]'
                  }`}
                  aria-hidden="true"
                />
                Available now
              </button>
            </div>
          </div>

          {/* Interactive Neighborhood Filter Bar */}
          {neighborhoods.length > 0 && (
            <LayoutGroup id="discover-neighborhoods">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-[var(--muted)]">
                  <MapPin className="h-3.5 w-3.5 text-[var(--orange)]" aria-hidden="true" />
                  Neighborhood:
                </span>
                <div
                  role="tablist"
                  aria-label="Filter goods by neighborhood"
                  className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedNeighborhood === 'All'}
                    onClick={() => setSelectedNeighborhood('All')}
                    className="relative inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors hover:bg-[var(--sun-soft)]/50"
                  >
                    {selectedNeighborhood === 'All' && (
                      <motion.span
                        layoutId="hood-chip"
                        className="absolute inset-0 rounded-full bg-[var(--navy)]"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span
                      className={`relative inline-flex items-center gap-1.5 ${
                        selectedNeighborhood === 'All' ? 'text-white' : 'text-[var(--navy)]'
                      }`}
                    >
                      <MapPin className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
                      <span>All neighborhoods</span>
                      <span className="opacity-75 tabular-nums">({safeItems.length})</span>
                    </span>
                  </button>

                  {neighborhoodCounts.map((hood) => {
                    const active = selectedNeighborhood === hood.name;
                    return (
                      <button
                        key={hood.name}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedNeighborhood(hood.name)}
                        className="relative inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors hover:bg-[var(--sun-soft)]/50"
                      >
                        {active && (
                          <motion.span
                            layoutId="hood-chip"
                            className="absolute inset-0 rounded-full bg-[var(--navy)]"
                            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                          />
                        )}
                        <span
                          className={`relative inline-flex items-center gap-1.5 ${
                            active ? 'text-white' : 'text-[var(--navy)]'
                          }`}
                        >
                          <MapPin
                            className={`h-3 w-3 ${active ? 'text-[var(--sun)]' : 'text-[var(--orange)]'}`}
                            aria-hidden="true"
                          />
                          <span>{hood.isMine ? `${hood.name} (Near you)` : hood.name}</span>
                          <span className="opacity-75 tabular-nums">({hood.count})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </LayoutGroup>
          )}

          {/* Animated CategoryChips */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CategoryChips
                id="discover-categories"
                value={selectedCategory}
                onChange={setSelectedCategory}
                items={ITEM_CATEGORIES}
                allLabel="All items"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 whitespace-nowrap text-xs font-extrabold text-[var(--blue)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Item Grid */}
        <div className="mt-6">
          {loadingItems ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <SkeletonCard key={n} />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
              <EmptyShelfState
                title="Nothing matches yet. Try another word."
                description="No neighbor has listed that right now — clear your filters or ask on the Wanted board."
                action={
                  hasActiveFilters ? (
                    <Button variant="ghost" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
                secondaryAction={
                  <Button variant="orange" onClick={() => navigate('/wanted')}>
                    Ask your neighbors
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item, idx) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  busyDates={busyDates}
                  onSelect={handleSelectItem}
                  index={idx}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
