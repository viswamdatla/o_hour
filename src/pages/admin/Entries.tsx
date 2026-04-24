import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Eye, Clock, CheckCircle2, XCircle, Download, ChevronRight,
  Wind, Zap, Battery, Activity, Power, Droplets, Flame, Cpu
} from 'lucide-react';
import { format } from 'date-fns';

// ── Icon / colour maps (same as worker flow) ──────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  wind:     <Wind className="w-7 h-7" />,
  zap:      <Zap className="w-7 h-7" />,
  battery:  <Battery className="w-7 h-7" />,
  activity: <Activity className="w-7 h-7" />,
  power:    <Power className="w-7 h-7" />,
  droplets: <Droplets className="w-7 h-7" />,
  flame:    <Flame className="w-7 h-7" />,
  cpu:      <Cpu className="w-7 h-7" />,
};
const COLOR_MAP: Record<string, { tile: string; badge: string }> = {
  wind:     { tile: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',     badge: 'bg-sky-100 text-sky-700' },
  zap:      { tile: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100', badge: 'bg-amber-100 text-amber-700' },
  battery:  { tile: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100', badge: 'bg-green-100 text-green-700' },
  activity: { tile: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100', badge: 'bg-purple-100 text-purple-700' },
  power:    { tile: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100', badge: 'bg-orange-100 text-orange-700' },
  droplets: { tile: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',  badge: 'bg-blue-100 text-blue-700' },
  flame:    { tile: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',      badge: 'bg-red-100 text-red-700' },
  cpu:      { tile: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100', badge: 'bg-slate-100 text-slate-700' },
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'confirmed')
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmed</span>;
  if (status === 'pending')
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Pending</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>;
};

type View = 'zones' | 'devices' | 'entries';

export default function Entries() {
  const [view, setView] = useState<View>('zones');

  // Data
  const [zones, setZones] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);

  // Selection
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);

  // Load zones on mount
  useEffect(() => { fetchZones(); }, []);

  const fetchZones = async () => {
    setIsLoading(true);
    // Fetch all zones across all sites, with device counts
    const { data } = await supabase
      .from('site_zones')
      .select('*, site_devices(count)')
      .eq('active', true)
      .order('sort_order');
    setZones(data || []);
    setIsLoading(false);
  };

  const fetchDevices = async (zone: any) => {
    setIsLoading(true);
    const { data } = await supabase
      .from('site_devices')
      .select('*')
      .eq('zone_id', zone.id)
      .eq('active', true)
      .order('sort_order');
    setDevices(data || []);
    setIsLoading(false);
  };

  const fetchEntries = async (device: any) => {
    setIsLoading(true);
    const { data } = await supabase
      .from('entries')
      .select('*, sites(name), form_templates(name), site_zones(name), site_devices(name)')
      .eq('device_id', device.id)
      .order('created_at', { ascending: false });
    setEntries(data || []);
    setIsLoading(false);
  };

  // Navigation handlers
  const handleZoneClick = async (zone: any) => {
    setSelectedZone(zone);
    await fetchDevices(zone);
    setView('devices');
  };

  const handleDeviceClick = async (device: any) => {
    setSelectedDevice(device);
    await fetchEntries(device);
    setView('entries');
  };

  const goToZones = () => { setView('zones'); setSelectedZone(null); setSelectedDevice(null); };
  const goToDevices = () => { setView('devices'); setSelectedDevice(null); };

  // Excel export for current device's entries
  const handleExcelDownload = () => {
    if (entries.length === 0) return;
    const allFieldKeys = Array.from(new Set(entries.flatMap(e => Object.keys(e.field_values || {}))));
    const rows = entries.map(entry => {
      const base: Record<string, any> = {
        'Timestamp':   format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'Zone':        entry.site_zones?.name || '',
        'Device':      entry.site_devices?.name || '',
        'Worker Phone': entry.worker_phone,
        'Status':      entry.status,
      };
      allFieldKeys.forEach(k => { base[k] = entry.field_values?.[k] ?? ''; });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length), 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entries');
    XLSX.writeFile(wb, `entries_${selectedDevice?.name?.replace(/\s+/g, '-')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const zoneColors = selectedZone ? (COLOR_MAP[selectedZone.icon] || COLOR_MAP.cpu) : COLOR_MAP.cpu;

  return (
    <div className="p-8">

      {/* ── Breadcrumb header ── */}
      <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
        <button onClick={goToZones} className={`font-medium transition-colors ${view === 'zones' ? 'text-slate-800' : 'hover:text-amber-600'}`}>Entries</button>
        {selectedZone && (
          <>
            <ChevronRight className="w-4 h-4" />
            <button onClick={goToDevices} className={`font-medium transition-colors ${view === 'devices' ? 'text-slate-800' : 'hover:text-amber-600'}`}>
              {selectedZone.name}
            </button>
          </>
        )}
        {selectedDevice && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="font-medium text-slate-800">{selectedDevice.name}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            {view === 'zones' && 'Entries'}
            {view === 'devices' && selectedZone?.name}
            {view === 'entries' && selectedDevice?.name}
          </h1>
          <p className="text-slate-500 mt-1">
            {view === 'zones' && 'Select a zone to browse device entries'}
            {view === 'devices' && 'Select a device to view its entries'}
            {view === 'entries' && `${entries.length} entries recorded`}
          </p>
        </div>
        {view === 'entries' && (
          <Button
            onClick={handleExcelDownload}
            disabled={entries.length === 0}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Download Excel
            {entries.length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{entries.length}</span>
            )}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">Loading...</div>
      ) : (
        <>
          {/* ── VIEW: Zone Tiles ── */}
          {view === 'zones' && (
            <>
              {zones.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-slate-400">
                    <p className="font-medium">No zones found</p>
                    <p className="text-sm mt-1">Go to Sites → Add Zone to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {zones.map(zone => {
                    const colors = COLOR_MAP[zone.icon] || COLOR_MAP.cpu;
                    const deviceCount = zone.site_devices?.[0]?.count ?? 0;
                    return (
                      <button
                        key={zone.id}
                        onClick={() => handleZoneClick(zone)}
                        className={`flex flex-col items-center justify-center gap-4 p-6 rounded-2xl border-2 font-medium transition-all hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] ${colors.tile}`}
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
                          {ICON_MAP[zone.icon] || <Zap className="w-7 h-7" />}
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-base leading-tight">{zone.name}</p>
                          <p className="text-xs opacity-60 mt-1">{deviceCount} device{deviceCount !== 1 ? 's' : ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── VIEW: Device List ── */}
          {view === 'devices' && (
            <div className="space-y-3">
              {devices.length === 0 ? (
                <Card><CardContent className="p-12 text-center text-slate-400">No devices in this zone.</CardContent></Card>
              ) : devices.map(device => (
                <button
                  key={device.id}
                  onClick={() => handleDeviceClick(device)}
                  className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${zoneColors.badge}`}>
                      {ICON_MAP[selectedZone?.icon] || <Zap className="w-6 h-6" />}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800 text-lg">{device.name}</p>
                      {device.device_code && <p className="text-xs text-slate-400 font-mono mt-0.5">{device.device_code}</p>}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* ── VIEW: Entries Table ── */}
          {view === 'entries' && (
            <>
              {/* Device info card */}
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 mb-6 ${zoneColors.tile}`}>
                <div className="w-9 h-9 rounded-lg bg-white/60 flex items-center justify-center">
                  {ICON_MAP[selectedZone?.icon] || <Zap className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold">{selectedDevice?.name}</p>
                  <p className="text-xs opacity-70">{selectedZone?.name}{selectedDevice?.device_code ? ` · ${selectedDevice.device_code}` : ''}</p>
                </div>
              </div>

              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Timestamp</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Worker Phone</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entries.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                            No entries for this device yet.
                          </td>
                        </tr>
                      ) : entries.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 text-sm">
                            {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-sm">{entry.worker_phone}</td>
                          <td className="px-6 py-4"><StatusBadge status={entry.status} /></td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="outline" size="sm" onClick={() => setSelectedEntry(entry)}>
                              <Eye className="w-4 h-4 mr-2" /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Entry Detail Modal ── */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-2xl my-8 animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row justify-between items-start border-b pb-4 mb-4 sticky top-0 bg-white z-10 rounded-t-xl">
              <div>
                <CardTitle>Entry Details</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Submitted {format(new Date(selectedEntry.created_at), 'PPP pp')}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100">
                <XCircle className="w-6 h-6" />
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Zone</p>
                  <p className="font-medium text-slate-900">{selectedEntry.site_zones?.name || selectedZone?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Device</p>
                  <p className="font-medium text-slate-900">{selectedEntry.site_devices?.name || selectedDevice?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Worker Phone</p>
                  <p className="font-medium text-slate-900 font-mono">{selectedEntry.worker_phone}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Status</p>
                  <div className="mt-1"><StatusBadge status={selectedEntry.status} /></div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-4 border-b pb-2">Form Data</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(selectedEntry.field_values || {}).map(([key, value]) => (
                    <div key={key} className="bg-white p-3 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{key}</p>
                      <p className="text-slate-900 font-medium">{String(value) || <span className="text-slate-400 italic">Empty</span>}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button
                  onClick={() => {
                    const rows = [{
                      'Timestamp': format(new Date(selectedEntry.created_at), 'yyyy-MM-dd HH:mm:ss'),
                      'Zone': selectedEntry.site_zones?.name || '',
                      'Device': selectedEntry.site_devices?.name || '',
                      'Worker Phone': selectedEntry.worker_phone,
                      'Status': selectedEntry.status,
                      ...selectedEntry.field_values,
                    }];
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Entry');
                    XLSX.writeFile(wb, `entry_${selectedEntry.id.slice(0, 8)}.xlsx`);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 font-semibold"
                >
                  <Download className="w-4 h-4" /> Export This Entry as Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
