import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { CountUp, Page, Reveal } from '../components/Motion';
import { Ribbons } from '../components/Ribbons';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { ITEM_CATEGORIES } from '../types';

export function ImpactPage() {
  const { impact, items, loadingImpact, refreshImpact } = useShareShelfData();

  useEffect(() => {
    refreshImpact();
  }, [refreshImpact]);

  const categoryCounts = useMemo(() => {
    const counts = ITEM_CATEGORIES.map((category) => ({
      category,
      count: items.filter((it) => it.category === category).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({
      ...c,
      percent: Math.round((c.count / max) * 100),
    }));
  }, [items]);

  const cards = [
    {
      label: 'Items listed',
      value: impact?.items_listed ?? 0,
      prefix: '',
      helper: 'Shared across nearby shelves',
      accent: false,
    },
    {
      label: 'Completed exchanges',
      value: impact?.completed_exchanges ?? 0,
      prefix: '',
      helper: 'Borrowed and safely returned',
      accent: false,
    },
    {
      label: 'Borrowed right now',
      value: impact?.borrowed_now ?? 0,
      prefix: '',
      helper: 'Currently out with neighbors',
      accent: false,
    },
    {
      label: 'Estimated money saved ($)',
      value: Math.round(impact?.money_saved ?? 0),
      prefix: '$',
      helper: 'Instead of buying new',
      accent: true,
    },
    {
      label: 'Items reused',
      value: impact?.items_reused ?? 0,
      prefix: '',
      helper: 'Distinct items circulated',
      accent: false,
    },
  ];

  return (
    <Page className="pb-24 lg:pb-16">
      {/* Header with ribbons */}
      <section className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--sun-soft)]/55">
        <Ribbons />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="inline-block rounded-3xl bg-white/90 px-6 py-5 shadow-[var(--shadow)] backdrop-blur-sm">
            <h1 className="text-3xl font-extrabold text-[var(--navy)] sm:text-5xl">
              What sharing adds up to
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--navy)]/80 sm:text-base">
              Every completed borrow keeps useful goods out of landfills and saves neighbors from
              buying items they only need once or twice.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 pt-8 sm:px-6 lg:px-8">
        {/* 5 big CountUp metric cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card, idx) => (
            <Reveal key={card.label} delay={idx * 0.05}>
              <div
                className={`h-full rounded-3xl border p-5 shadow-[var(--shadow)] ${
                  card.accent
                    ? 'border-[var(--blue)] bg-[var(--blue)] text-white'
                    : 'border-[var(--line)] bg-white text-[var(--navy)]'
                }`}
              >
                <p
                  className={`text-xs font-bold ${
                    card.accent ? 'text-white/85' : 'text-[var(--muted)]'
                  }`}
                >
                  {card.label}
                </p>
                {loadingImpact && !impact ? (
                  <div
                    className={`shimmer mt-3 h-9 w-20 rounded-xl ${
                      card.accent ? 'opacity-40' : ''
                    }`}
                  />
                ) : (
                  <p
                    className={`mt-2 text-3xl font-extrabold tabular-nums ${
                      card.accent ? 'text-[var(--sun)]' : 'text-[var(--blue)]'
                    }`}
                  >
                    <CountUp to={card.value} prefix={card.prefix} />
                  </p>
                )}
                <p
                  className={`mt-2 text-xs font-medium ${
                    card.accent ? 'text-white/85' : 'text-[var(--muted)]'
                  }`}
                >
                  {card.helper}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Chart + Calculation explainer */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Animated bar chart of items by category */}
          <section className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)] lg:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold text-[var(--navy)]">Items by category</h2>
                <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">
                  Live breakdown of shared neighborhood inventory
                </p>
              </div>
              <span className="rounded-full bg-[var(--sun-soft)] px-3 py-1 text-xs font-extrabold text-[var(--navy)] tabular-nums">
                {items.length} total
              </span>
            </div>

            <div className="mt-6 space-y-3.5">
              {categoryCounts.map((row, idx) => {
                const targetWidth = row.count === 0 ? 0 : Math.max(6, row.percent);
                return (
                  <div key={row.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--navy)]">{row.category}</span>
                      <span className="font-extrabold text-[var(--blue)] tabular-nums">
                        {row.count}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--cream)]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: idx % 2 === 0 ? 'var(--blue)' : 'var(--orange)',
                        }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${targetWidth}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* How we calculate this */}
          <aside className="flex flex-col justify-between rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)] lg:col-span-5">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--sun-soft)] text-[var(--blue)]">
                <Info className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-[var(--navy)]">
                How we calculate this
              </h2>
              <div className="mt-3 space-y-3 text-sm font-medium leading-relaxed text-[var(--navy)]/85">
                <p>
                  <strong className="font-extrabold text-[var(--navy)]">
                    Estimated money saved
                  </strong>{' '}
                  is the sum of the estimated replacement value of items across completed exchanges.
                </p>
                <p>
                  <strong className="font-extrabold text-[var(--navy)]">Items reused</strong> counts
                  how many distinct items have been borrowed and returned at least once.
                </p>
                <p>All figures update automatically as neighborhood exchanges are completed.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-[var(--sun-soft)] p-4 text-xs font-bold leading-relaxed text-[var(--navy)]">
              Includes{' '}
              <span className="tabular-nums">{impact ? impact.demo_items : '—'}</span>{' '}
              demonstration items. Figures are estimates, not real-world results.
            </div>
          </aside>
        </div>
      </div>
    </Page>
  );
}
