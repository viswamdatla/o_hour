import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/Card';
import { format, startOfDay, isToday } from 'date-fns';
import {
  AlertTriangle, Clock, CheckCircle2, RefreshCw,
  Cpu, MapPin, Phone, Eye, XCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ── Helpers ──────────────────────────────────────────────────────
const Pill = ({ children, cls }: { children: React.ReactNode; cls: string }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
    {children}
  </span>
);

export default function Alerts() {
  const [overdueDevices, setOverdueDevices] = useState<any[]>([]);
  const [pendingEntries, setPendingEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [tab, setTab] = useState<'overdue' | 'pending'>('overdue');

  const load = async () => {
    setIsLoading(true);

    // 1. All active devices + their zones
    const { data: devices } = await supabase
      .from('site_devices')
      .select('*, site_zones(name, icon)')
      .eq('active', true);

    // 2. All entries created today
    const todayStart = startOfDay(new Date()).toISOString();
    const { data: todayEntries } = await supabase
      .from('entries')
      .select('device_id, created_at')
      .gte('created_at', todayStart);

    // Devices with no entry today
    const submittedIds = new Set((todayEntries || []).map((e: any) => e.device_id));
    setOverdueDevices((devices || []).filter((d: any) => !submittedIds.has(d.id)));

    // 3. Pending entries (status = pending), latest first
    const { data: pending } = await supabase
      .from('entries')
      .select('*, site_zones(name), site_devices(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    setPendingEntries(pending || []);

    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markConfirmed = async (id: string) => {
    await supabase.from('entries').update({ status: 'confirmed' }).eq('id', id);
    setPendingEntries(p => p.filter(e => e.id !== id));
  };

  // Summary counts
  const overdueCount = overdueDevices.length;
  const pendingCount = pendingEntries.length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Alerts</h1>
          <p className="text-slate-500 mt-1">Overdue devices & pending entries requiring attention</p>
        </div>
        <button onClick={load} disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button onClick={() => setTab('overdue')}
          className={`p-5 rounded-2xl border-2 text-left transition-all ${tab === 'overdue' ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white hover:border-red-200'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Overdue Today</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">Devices with no reading submitted today</p>
        </button>

        <button onClick={() => setTab('pending')}
          className={`p-5 rounded-2xl border-2 text-left transition-all ${tab === 'pending' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-200'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Pending Review</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">Entries awaiting confirmation</p>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">Loading...</div>
      ) : (
        <>
          {/* ── Overdue Devices ── */}
          {tab === 'overdue' && (
            <Card>
              <CardContent className="p-0">
                {overdueDevices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <CheckCircle2 className="w-12 h-12 text-green-300 mb-3" />
                    <p className="font-semibold text-green-600">All devices have submitted today! 🎉</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {overdueDevices.map(device => (
                      <div key={device.id} className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{device.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <p className="text-xs text-slate-400">{device.site_zones?.name}</p>
                              {device.device_code && (
                                <span className="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{device.device_code}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Pill cls="bg-red-100 text-red-600">
                          <AlertTriangle className="w-3 h-3" /> No reading today
                        </Pill>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Pending Entries ── */}
          {tab === 'pending' && (
            <Card>
              <CardContent className="p-0">
                {pendingEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <CheckCircle2 className="w-12 h-12 text-green-300 mb-3" />
                    <p className="font-semibold text-green-600">No pending entries!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingEntries.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {entry.site_devices?.name || '—'}
                              <span className="ml-2 text-xs text-slate-400 font-normal">({entry.site_zones?.name})</span>
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Phone className="w-3 h-3" />{entry.worker_phone}
                              </span>
                              <span className="text-xs text-slate-400">
                                {format(new Date(entry.created_at), 'MMM d, HH:mm')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedEntry(entry)}
                            className="flex items-center gap-1.5 text-xs border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600 px-3 py-1.5 rounded-lg transition-colors">
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button onClick={() => markConfirmed(entry.id)}
                            className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Entry Detail Modal ── */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="font-bold text-slate-800">Entry Details</p>
                <p className="text-xs text-slate-400">{format(new Date(selectedEntry.created_at), 'PPP pp')}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl">
                <div><p className="text-xs text-slate-400 uppercase font-semibold mb-1">Zone</p><p className="font-medium">{selectedEntry.site_zones?.name || '—'}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold mb-1">Device</p><p className="font-medium">{selectedEntry.site_devices?.name || '—'}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold mb-1">Worker</p><p className="font-medium font-mono">{selectedEntry.worker_phone}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold mb-1">Status</p>
                  <Pill cls="bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> Pending</Pill>
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-3">Form Data</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedEntry.field_values || {}).map(([k, v]) => (
                    <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="text-xs text-slate-400 uppercase font-semibold mb-1">{k}</p>
                      <p className="text-slate-800 font-medium">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { markConfirmed(selectedEntry.id); setSelectedEntry(null); }}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Mark as Confirmed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
