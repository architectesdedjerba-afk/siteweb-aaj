/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Month-grid calendar for the "Avis Commissions" overview. Each day with at
 * least one published commission shows a coloured dot per commission, the
 * colour identifying the originating town (admin-customisable). Hovering a
 * day reveals a tooltip listing the commissions on that date — including
 * multiple commissions for the same date.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { colorForTown } from '../lib/memberConfig';

export interface CalendarEvent {
  /** ISO date `YYYY-MM-DD` (no timezone). */
  date: string;
  town: string;
  type?: string;
  count?: number;
}

interface CommissionCalendarProps {
  events: CalendarEvent[];
  colors: Record<string, string>;
  /** Optional callback fired when a day with events is clicked. */
  onDayClick?: (date: string, events: CalendarEvent[]) => void;
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const FR_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDate(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function formatLongFr(iso: string): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return iso;
  return `${d} ${FR_MONTHS[m - 1]} ${y}`;
}

export default function CommissionCalendar({
  events,
  colors,
  onDayClick,
}: CommissionCalendarProps) {
  const today = new Date();
  const [view, setView] = useState<{ year: number; month0: number }>({
    year: today.getFullYear(),
    month0: today.getMonth(),
  });

  // Group events by ISO date for O(1) lookup while rendering the grid.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (!ev?.date) continue;
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    return map;
  }, [events]);

  // Build the 6×7 grid of cells for the current view, padding with previous /
  // next month days so every row is full-width.
  const cells = useMemo(() => {
    const { year, month0 } = view;
    const firstOfMonth = new Date(year, month0, 1);
    // JS getDay(): 0 Sunday … 6 Saturday. We want Monday-first.
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month0 + 1, 0).getDate();
    const result: Array<{ iso: string; day: number; inMonth: boolean }> = [];

    // Trailing days from previous month.
    const prevMonth0 = month0 === 0 ? 11 : month0 - 1;
    const prevYear = month0 === 0 ? year - 1 : year;
    const prevDays = new Date(prevYear, prevMonth0 + 1, 0).getDate();
    for (let i = leadingBlanks - 1; i >= 0; i--) {
      const day = prevDays - i;
      result.push({ iso: isoDate(prevYear, prevMonth0, day), day, inMonth: false });
    }
    // Current month.
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({ iso: isoDate(year, month0, day), day, inMonth: true });
    }
    // Next month padding to reach 42 cells.
    const nextMonth0 = month0 === 11 ? 0 : month0 + 1;
    const nextYear = month0 === 11 ? year + 1 : year;
    let pad = 1;
    while (result.length < 42) {
      result.push({ iso: isoDate(nextYear, nextMonth0, pad), day: pad, inMonth: false });
      pad++;
    }
    return result;
  }, [view]);

  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const goPrev = () =>
    setView((v) =>
      v.month0 === 0 ? { year: v.year - 1, month0: 11 } : { year: v.year, month0: v.month0 - 1 }
    );
  const goNext = () =>
    setView((v) =>
      v.month0 === 11 ? { year: v.year + 1, month0: 0 } : { year: v.year, month0: v.month0 + 1 }
    );
  const goToday = () =>
    setView({ year: today.getFullYear(), month0: today.getMonth() });

  // Towns present in current visible month → mini legend.
  const townsInView = useMemo(() => {
    const set = new Set<string>();
    for (const cell of cells) {
      const evs = eventsByDate.get(cell.iso);
      if (!evs) continue;
      for (const ev of evs) set.add(ev.town);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [cells, eventsByDate]);

  return (
    <div className="border border-aaj-border rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-aaj-border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Mois précédent"
            className="w-9 h-9 flex items-center justify-center rounded border border-aaj-border bg-white hover:bg-aaj-royal hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Mois suivant"
            className="w-9 h-9 flex items-center justify-center rounded border border-aaj-border bg-white hover:bg-aaj-royal hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-2 text-[10px] font-black uppercase tracking-widest border border-aaj-border bg-white px-3 py-2 rounded hover:bg-aaj-dark hover:text-white transition-colors"
          >
            Aujourd&apos;hui
          </button>
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-aaj-dark">
          {FR_MONTHS[view.month0]} {view.year}
        </h3>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-white border-b border-aaj-border">
        {WEEKDAY_LABELS.map((wd) => (
          <div
            key={wd}
            className="px-2 py-2 text-center text-[10px] font-black uppercase tracking-widest text-aaj-gray"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const evs = eventsByDate.get(cell.iso) ?? [];
          const hasEvents = evs.length > 0;
          const isToday = cell.iso === todayIso;
          const isClickable = hasEvents && onDayClick;
          return (
            <div
              key={`${cell.iso}-${idx}`}
              className={[
                'group relative min-h-[68px] border-b border-r border-aaj-border px-2 py-1.5 flex flex-col gap-1',
                cell.inMonth ? 'bg-white' : 'bg-slate-50/60 text-aaj-gray',
                isClickable ? 'cursor-pointer hover:bg-aaj-royal/5' : '',
              ].join(' ')}
              onClick={isClickable ? () => onDayClick!(cell.iso, evs) : undefined}
            >
              <span
                className={[
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black',
                  isToday
                    ? 'bg-aaj-royal text-white'
                    : cell.inMonth
                      ? 'text-aaj-dark'
                      : 'text-aaj-gray/70',
                ].join(' ')}
              >
                {cell.day}
              </span>

              {hasEvents && (
                <div className="flex flex-wrap gap-1 mt-auto">
                  {evs.slice(0, 6).map((ev, i) => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full ring-1 ring-white/50 shadow-sm"
                      style={{ backgroundColor: colorForTown(ev.town, colors) }}
                      aria-hidden="true"
                    />
                  ))}
                  {evs.length > 6 && (
                    <span className="text-[9px] font-black text-aaj-gray">
                      +{evs.length - 6}
                    </span>
                  )}
                </div>
              )}

              {hasEvents && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute z-30 left-1/2 top-full -translate-x-1/2 mt-2 hidden group-hover:block min-w-[220px] max-w-[280px] bg-aaj-dark text-white text-[11px] rounded shadow-xl p-3 space-y-1.5"
                >
                  <div className="font-black uppercase tracking-widest text-[10px] text-white/60 mb-1">
                    {formatLongFr(cell.iso)}
                  </div>
                  {evs.map((ev, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorForTown(ev.town, colors) }}
                      />
                      <span className="font-bold">{ev.town}</span>
                      {ev.type && (
                        <span className="text-white/70 text-[10px] uppercase tracking-wider">
                          · {ev.type}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {townsInView.length > 0 && (
        <div className="px-5 py-3 bg-slate-50 border-t border-aaj-border flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-aaj-gray">
            Légende
          </span>
          {townsInView.map((town) => (
            <span key={town} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colorForTown(town, colors) }}
              />
              <span className="text-[11px] font-bold text-aaj-dark uppercase tracking-wider">
                {town}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
