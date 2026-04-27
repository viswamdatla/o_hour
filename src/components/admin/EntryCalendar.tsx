import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths,
  addWeeks, subWeeks, addDays, subDays, isToday } from 'date-fns';

type CalMode = 'monthly' | 'weekly' | 'daily';

interface Props {
  entries: any[];
  onViewEntry: (entry: any) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EntryCalendar({ entries, onViewEntry }: Props) {
  const [mode, setMode] = useState<CalMode>('monthly');
  const [navDate, setNavDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const getForDay = (d: Date) => entries.filter(e => isSameDay(new Date(e.created_at), d));

  // ── Monthly ──────────────────────────────────────────────────
  const MonthlyView = () => {
    const ms = startOfMonth(navDate);
    const me = endOfMonth(navDate);
    const days = eachDayOfInterval({ start: startOfWeek(ms), end: endOfWeek(me) });
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setNavDate(subMonths(navDate, 1))} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-bold text-slate-800 text-lg">{format(navDate, 'MMMM yyyy')}</span>
          <button onClick={() => setNavDate(addMonths(navDate, 1))} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const de = getForDay(day);
            const inMonth = isSameMonth(day, navDate);
            const sel = isSameDay(day, selectedDay);
            const tod = isToday(day);
            return (
              <button key={day.toISOString()} onClick={() => { setSelectedDay(day); setMode('daily'); }}
                className={`relative flex flex-col items-center py-2 rounded-xl transition-all min-h-[56px]
                  ${sel ? 'bg-amber-500 text-white shadow-md' : tod ? 'bg-amber-50 border border-amber-200' : 'hover:bg-slate-50'}
                  ${!inMonth ? 'opacity-30' : ''}`}>
                <span className={`text-sm font-semibold ${sel ? 'text-white' : tod ? 'text-amber-600' : 'text-slate-700'}`}>
                  {format(day, 'd')}
                </span>
                {de.length > 0 && (
                  <span className={`mt-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${sel ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'}`}>
                    {de.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Weekly ───────────────────────────────────────────────────
  const WeeklyView = () => {
    const ws = startOfWeek(navDate);
    const days = eachDayOfInterval({ start: ws, end: endOfWeek(navDate) });
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setNavDate(subWeeks(navDate, 1))} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
          <span className="font-bold text-slate-800">{format(ws, 'MMM d')} – {format(endOfWeek(navDate), 'MMM d, yyyy')}</span>
          <button onClick={() => setNavDate(addWeeks(navDate, 1))} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const de = getForDay(day);
            const tod = isToday(day);
            const sel = isSameDay(day, selectedDay);
            return (
              <div key={day.toISOString()} className={`rounded-xl border p-2 min-h-[100px] flex flex-col gap-1
                ${tod ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <div className="text-center mb-1">
                  <p className="text-xs font-semibold text-slate-400">{format(day, 'EEE')}</p>
                  <p className={`text-base font-bold ${tod ? 'text-amber-600' : 'text-slate-700'}`}>{format(day, 'd')}</p>
                </div>
                {de.length === 0
                  ? <p className="text-xs text-slate-300 text-center mt-2">—</p>
                  : de.map(e => (
                    <button key={e.id} onClick={() => { setSelectedDay(day); onViewEntry(e); }}
                      className="w-full text-left text-xs bg-amber-100 text-amber-800 rounded-lg px-2 py-1 hover:bg-amber-200 transition-colors truncate">
                      {format(new Date(e.created_at), 'HH:mm')}
                    </button>
                  ))
                }
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Daily ────────────────────────────────────────────────────
  const DailyView = () => {
    const de = getForDay(selectedDay);
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setSelectedDay(d => subDays(d, 1))} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center">
            <p className="font-bold text-slate-800 text-lg">{format(selectedDay, 'EEEE')}</p>
            <p className="text-slate-500 text-sm">{format(selectedDay, 'MMMM d, yyyy')}</p>
          </div>
          <button onClick={() => setSelectedDay(d => addDays(d, 1))} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {de.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium">No entries on this day</p>
          </div>
        ) : (
          <div className="space-y-3">
            {de.map(entry => (
              <div key={entry.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-amber-300 hover:shadow-sm transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold text-sm">
                    {format(new Date(entry.created_at), 'HH:mm')}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{entry.worker_phone}</p>
                    <p className="text-xs text-slate-400">{Object.keys(entry.field_values || {}).length} fields recorded</p>
                  </div>
                </div>
                <button onClick={() => onViewEntry(entry)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors">
                  <Eye className="w-4 h-4" /> View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {(['monthly', 'weekly', 'daily'] as CalMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all
              ${mode === m ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {m}
          </button>
        ))}
      </div>
      {mode === 'monthly' && <MonthlyView />}
      {mode === 'weekly' && <WeeklyView />}
      {mode === 'daily' && <DailyView />}
    </div>
  );
}
