import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, Edit2, Trash2, Download, Copy, ChevronRight, X,
  Wind, Zap, Battery, Activity, Power, Droplets, Flame, Cpu, QrCode
} from 'lucide-react';
import QRCode from 'qrcode';

// ── Zone options ────────────────────────────────────────────────
const ZONE_OPTIONS = [
  { label: 'HVAC Room',       icon: 'wind',     color: 'bg-sky-100 text-sky-600 border-sky-200' },
  { label: 'Electrical Room', icon: 'zap',      color: 'bg-amber-100 text-amber-600 border-amber-200' },
  { label: 'Battery Room',    icon: 'battery',  color: 'bg-green-100 text-green-600 border-green-200' },
  { label: 'Transformer',     icon: 'activity', color: 'bg-purple-100 text-purple-600 border-purple-200' },
  { label: 'Generator',       icon: 'power',    color: 'bg-orange-100 text-orange-600 border-orange-200' },
  { label: 'Pump Room',       icon: 'droplets', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  { label: 'Fire Panel',      icon: 'flame',    color: 'bg-red-100 text-red-600 border-red-200' },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  wind:     <Wind className="w-8 h-8" />,
  zap:      <Zap className="w-8 h-8" />,
  battery:  <Battery className="w-8 h-8" />,
  activity: <Activity className="w-8 h-8" />,
  power:    <Power className="w-8 h-8" />,
  droplets: <Droplets className="w-8 h-8" />,
  flame:    <Flame className="w-8 h-8" />,
  cpu:      <Cpu className="w-8 h-8" />,
};

const COLOR_MAP: Record<string, string> = {
  wind:     'bg-sky-100 text-sky-600 border-sky-200',
  zap:      'bg-amber-100 text-amber-600 border-amber-200',
  battery:  'bg-green-100 text-green-600 border-green-200',
  activity: 'bg-purple-100 text-purple-600 border-purple-200',
  power:    'bg-orange-100 text-orange-600 border-orange-200',
  droplets: 'bg-blue-100 text-blue-600 border-blue-200',
  flame:    'bg-red-100 text-red-600 border-red-200',
  cpu:      'bg-slate-100 text-slate-600 border-slate-200',
};

// ── QR canvas per device ─────────────────────────────────────────
function DeviceQR({ siteId, deviceId, deviceName }: { siteId: string; deviceId: string; deviceName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${window.location.origin}/collect?site=${siteId}&device=${deviceId}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 128, margin: 1 });
    }
  }, [url]);

  const download = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `qr-${deviceName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <canvas ref={canvasRef} />
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={download}
          className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
        >
          <Download className="w-3 h-3" /> Download
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(url); alert('Link copied!'); }}
          className="flex items-center gap-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 font-medium transition-colors"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
type View = 'zones' | 'devices';

export default function Devices() {
  const [view, setView] = useState<View>('zones');
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [zones, setZones] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);

  // Zone form
  const [isZoneFormOpen, setIsZoneFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zoneForm, setZoneForm] = useState({ name: '', icon: 'zap', form_template_id: '' });

  // Device form
  const [isDeviceFormOpen, setIsDeviceFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [deviceForm, setDeviceForm] = useState({ name: '', device_code: '', form_template_id: '' });

  useEffect(() => { fetchInitial(); }, []);

  const fetchInitial = async () => {
    setIsLoading(true);
    const [zonesRes, templatesRes, sitesRes] = await Promise.all([
      supabase.from('site_zones').select('*, site_devices(count)').order('sort_order'),
      supabase.from('form_templates').select('id, name'),
      supabase.from('sites').select('id, name').limit(1),
    ]);
    setZones(zonesRes.data || []);
    setTemplates(templatesRes.data || []);
    setSites(sitesRes.data || []);
    setIsLoading(false);
  };

  const fetchDevices = async (zoneId: string) => {
    setIsLoading(true);
    const { data } = await supabase
      .from('site_devices').select('*').eq('zone_id', zoneId).order('sort_order');
    setDevices(data || []);
    setIsLoading(false);
  };

  // Navigation
  const handleZoneClick = async (zone: any) => {
    setSelectedZone(zone);
    await fetchDevices(zone.id);
    setView('devices');
  };

  const goBack = () => { setView('zones'); setSelectedZone(null); fetchInitial(); };

  const siteId = sites[0]?.id || '';

  // ── Zone CRUD ──────────────────────────────────────────────────
  const openZoneForm = (zone?: any) => {
    setEditingZone(zone || null);
    setZoneForm(zone
      ? { name: zone.name, icon: zone.icon, form_template_id: zone.form_template_id || '' }
      : { name: '', icon: 'zap', form_template_id: '' });
    setIsZoneFormOpen(true);
  };

  const saveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...zoneForm, site_id: siteId, form_template_id: zoneForm.form_template_id || null };
    if (editingZone) {
      await supabase.from('site_zones').update(payload).eq('id', editingZone.id);
    } else {
      await supabase.from('site_zones').insert(payload);
    }
    setIsZoneFormOpen(false);
    fetchInitial();
  };

  const deleteZone = async (zone: any) => {
    if (!confirm(`Delete zone "${zone.name}" and ALL its devices?`)) return;
    await supabase.from('site_zones').delete().eq('id', zone.id);
    fetchInitial();
  };

  // ── Device CRUD ────────────────────────────────────────────────
  const openDeviceForm = (device?: any) => {
    setEditingDevice(device || null);
    setDeviceForm(device ? { name: device.name, device_code: device.device_code || '', form_template_id: device.form_template_id || '' } : { name: '', device_code: '', form_template_id: '' });
    setIsDeviceFormOpen(true);
  };

  const saveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...deviceForm, zone_id: selectedZone.id, site_id: siteId, form_template_id: deviceForm.form_template_id || null };
    if (editingDevice) {
      await supabase.from('site_devices').update(payload).eq('id', editingDevice.id);
    } else {
      await supabase.from('site_devices').insert(payload);
    }
    setIsDeviceFormOpen(false);
    await fetchDevices(selectedZone.id);
  };

  const deleteDevice = async (device: any) => {
    if (!confirm(`Delete device "${device.name}"?`)) return;
    await supabase.from('site_devices').delete().eq('id', device.id);
    await fetchDevices(selectedZone.id);
  };

  const zoneColor = selectedZone ? (COLOR_MAP[selectedZone.icon] || COLOR_MAP.cpu) : '';

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
        <button onClick={goBack} className={`font-medium transition-colors ${view === 'zones' ? 'text-slate-800' : 'hover:text-amber-600'}`}>
          Device Management
        </button>
        {selectedZone && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="font-medium text-slate-800">{selectedZone.name}</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            {view === 'zones' ? 'Device Management' : selectedZone?.name}
          </h1>
          <p className="text-slate-500 mt-1">
            {view === 'zones' ? 'Manage zones and devices, download QR codes' : `${devices.length} device(s) · QR codes ready to print`}
          </p>
        </div>
        {view === 'zones' && (
          <Button onClick={() => openZoneForm()} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Zone
          </Button>
        )}
        {view === 'devices' && (
          <Button onClick={() => openDeviceForm()} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Device
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">Loading...</div>
      ) : (
        <>
          {/* ── Zone Tiles ── */}
          {view === 'zones' && (
            <>
              {zones.length === 0 ? (
                <Card>
                  <CardContent className="p-16 text-center">
                    <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No zones yet</p>
                    <p className="text-sm text-slate-400 mt-1">Click "Add Zone" to create your first zone</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {zones.map(zone => {
                    const color = COLOR_MAP[zone.icon] || COLOR_MAP.cpu;
                    const count = zone.site_devices?.[0]?.count ?? 0;
                    return (
                      <div key={zone.id} className="group relative">
                        {/* Edit/Delete overlay */}
                        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={e => { e.stopPropagation(); openZoneForm(zone); }}
                            className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-600 shadow-sm border border-slate-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); deleteZone(zone); }}
                            className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-slate-500 hover:text-red-500 shadow-sm border border-slate-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleZoneClick(zone)}
                          className={`w-full flex flex-col items-center justify-center gap-4 p-7 rounded-2xl border-2 font-medium transition-all hover:shadow-xl hover:scale-[1.03] active:scale-[0.97] ${color}`}
                        >
                          <div className="w-16 h-16 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
                            {ICON_MAP[zone.icon] || <Zap className="w-8 h-8" />}
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-base leading-tight">{zone.name}</p>
                            <p className="text-xs opacity-60 mt-1 font-normal">{count} device{count !== 1 ? 's' : ''}</p>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Device Cards with inline QR ── */}
          {view === 'devices' && (
            <>
              {devices.length === 0 ? (
                <Card>
                  <CardContent className="p-16 text-center">
                    <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No devices yet</p>
                    <p className="text-sm text-slate-400 mt-1">Click "Add Device" to add the first device to this zone</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {devices.map(device => (
                    <Card key={device.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      {/* Coloured top bar */}
                      <div className={`h-2 ${zoneColor.split(' ').find(c => c.startsWith('bg-')) || 'bg-amber-400'}`}></div>
                      <CardContent className="p-5">
                        {/* Device header */}
                        <div className="flex items-start justify-between mb-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${zoneColor}`}>
                              {ICON_MAP[selectedZone?.icon]
                                ? React.cloneElement(ICON_MAP[selectedZone.icon] as React.ReactElement<{ className: string }>, { className: 'w-5 h-5' })
                                : <Zap className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{device.name}</p>
                              {device.device_code && (
                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{device.device_code}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openDeviceForm(device)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteDevice(device)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* QR Code */}
                        <div className="flex justify-center bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <DeviceQR siteId={siteId} deviceId={device.id} deviceName={device.name} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Zone Form Modal ── */}
      {isZoneFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle>{editingZone ? 'Edit Zone' : 'Add Zone'}</CardTitle>
              <button onClick={() => setIsZoneFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveZone} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Zone Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ZONE_OPTIONS.map(opt => (
                      <button key={opt.icon} type="button"
                        onClick={() => setZoneForm({ ...zoneForm, name: opt.label, icon: opt.icon })}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-sm font-medium transition-all ${zoneForm.icon === opt.icon ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${opt.color}`}>
                          {ICON_MAP[opt.icon] ? React.cloneElement(ICON_MAP[opt.icon] as React.ReactElement<{ className: string }>, { className: 'w-4 h-4' }) : null}
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="Zone Name" required value={zoneForm.name} onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Form Template (for all devices in this zone)</label>
                  <select className="w-full h-11 px-3 rounded-md border border-slate-300 focus:border-amber-500 outline-none bg-white"
                    value={zoneForm.form_template_id} onChange={e => setZoneForm({ ...zoneForm, form_template_id: e.target.value })}>
                    <option value="">-- None --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsZoneFormOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Zone</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Device Form Modal ── */}
      {isDeviceFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-2xl">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle>{editingDevice ? 'Edit Device' : 'Add Device'}</CardTitle>
              <button onClick={() => setIsDeviceFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveDevice} className="space-y-4">
                <Input label="Device Name" placeholder="e.g. HVAC Unit 1" required value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} />
                <Input label="Device Code / Tag" placeholder="e.g. HVAC-01 (optional)" value={deviceForm.device_code} onChange={e => setDeviceForm({ ...deviceForm, device_code: e.target.value })} />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Form Template
                    <span className="ml-1.5 text-xs font-normal text-slate-400">(overrides zone template)</span>
                  </label>
                  <select
                    className="w-full h-11 px-3 rounded-md border border-slate-300 focus:border-amber-500 outline-none bg-white text-sm"
                    value={deviceForm.form_template_id}
                    onChange={e => setDeviceForm({ ...deviceForm, form_template_id: e.target.value })}
                  >
                    <option value="">-- Use zone template --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {!deviceForm.form_template_id && selectedZone?.form_template_id && (
                    <p className="text-xs text-slate-400 mt-1">
                      Will use: <span className="font-medium">{templates.find(t => t.id === selectedZone.form_template_id)?.name || 'Zone template'}</span>
                    </p>
                  )}
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDeviceFormOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Device</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
