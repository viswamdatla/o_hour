import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus, Edit2, QrCode, X, Copy, ExternalLink, ChevronDown, ChevronRight,
  Wind, Zap, Battery, Activity, Power, Droplets, Flame, Cpu, Trash2, Download
} from 'lucide-react';
import QRCode from 'qrcode';

const ZONE_OPTIONS = [
  { label: 'HVAC Room',       icon: 'wind',     color: 'bg-sky-100 text-sky-600' },
  { label: 'Electrical Room', icon: 'zap',      color: 'bg-amber-100 text-amber-600' },
  { label: 'Battery Room',    icon: 'battery',  color: 'bg-green-100 text-green-600' },
  { label: 'Transformer',     icon: 'activity', color: 'bg-purple-100 text-purple-600' },
  { label: 'Generator',       icon: 'power',    color: 'bg-orange-100 text-orange-600' },
  { label: 'Pump Room',       icon: 'droplets', color: 'bg-blue-100 text-blue-600' },
  { label: 'Fire Panel',      icon: 'flame',    color: 'bg-red-100 text-red-600' },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  wind:     <Wind className="w-5 h-5" />,
  zap:      <Zap className="w-5 h-5" />,
  battery:  <Battery className="w-5 h-5" />,
  activity: <Activity className="w-5 h-5" />,
  power:    <Power className="w-5 h-5" />,
  droplets: <Droplets className="w-5 h-5" />,
  flame:    <Flame className="w-5 h-5" />,
  cpu:      <Cpu className="w-5 h-5" />,
};

const COLOR_MAP: Record<string, string> = {
  wind: 'bg-sky-100 text-sky-600', zap: 'bg-amber-100 text-amber-600',
  battery: 'bg-green-100 text-green-600', activity: 'bg-purple-100 text-purple-600',
  power: 'bg-orange-100 text-orange-600', droplets: 'bg-blue-100 text-blue-600',
  flame: 'bg-red-100 text-red-600', cpu: 'bg-slate-100 text-slate-600',
};

export default function Sites() {
  const [sites, setSites] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [zonesMap, setZonesMap] = useState<Record<string, any[]>>({});
  const [devicesMap, setDevicesMap] = useState<Record<string, any[]>>({});
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);

  // Site form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', site_code: '', address: '', form_template_id: '', active: true });

  // Zone form
  const [isZoneFormOpen, setIsZoneFormOpen] = useState(false);
  const [zoneFormSiteId, setZoneFormSiteId] = useState('');
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zoneForm, setZoneForm] = useState({ name: '', icon: 'zap', form_template_id: '' });

  // Device form
  const [isDeviceFormOpen, setIsDeviceFormOpen] = useState(false);
  const [deviceFormZoneId, setDeviceFormZoneId] = useState('');
  const [deviceFormSiteId, setDeviceFormSiteId] = useState('');
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [deviceForm, setDeviceForm] = useState({ name: '', device_code: '' });

  // QR modal
  const [qrItem, setQrItem] = useState<{ label: string; url: string } | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [sitesRes, templatesRes] = await Promise.all([
      supabase.from('sites').select('*, form_templates(name)').order('created_at', { ascending: false }),
      supabase.from('form_templates').select('id, name')
    ]);
    if (sitesRes.data) setSites(sitesRes.data);
    if (templatesRes.data) setTemplates(templatesRes.data);
    setIsLoading(false);
  };

  const fetchZonesForSite = async (siteId: string) => {
    const { data } = await supabase
      .from('site_zones').select('*, form_templates(name)')
      .eq('site_id', siteId).order('sort_order');
    const zones = data || [];
    setZonesMap(prev => ({ ...prev, [siteId]: zones }));
    // Also load devices for all zones
    for (const zone of zones) {
      await fetchDevicesForZone(zone.id);
    }
  };

  const fetchDevicesForZone = async (zoneId: string) => {
    const { data } = await supabase
      .from('site_devices').select('*').eq('zone_id', zoneId).order('sort_order');
    setDevicesMap(prev => ({ ...prev, [zoneId]: data || [] }));
  };

  const toggleSiteExpand = async (siteId: string) => {
    if (expandedSiteId === siteId) { setExpandedSiteId(null); return; }
    setExpandedSiteId(siteId);
    if (!zonesMap[siteId]) await fetchZonesForSite(siteId);
  };

  // ── Site CRUD ──
  const handleOpenSiteForm = (site?: any) => {
    setEditingSite(site || null);
    setFormData(site ? { name: site.name, site_code: site.site_code, address: site.address || '', form_template_id: site.form_template_id || '', active: site.active }
      : { name: '', site_code: '', address: '', form_template_id: '', active: true });
    setIsFormOpen(true);
  };
  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, form_template_id: formData.form_template_id || null };
    if (editingSite) { await supabase.from('sites').update(payload).eq('id', editingSite.id); }
    else { await supabase.from('sites').insert(payload); }
    setIsFormOpen(false); fetchData();
  };

  // ── Zone CRUD ──
  const handleOpenZoneForm = (siteId: string, zone?: any) => {
    setZoneFormSiteId(siteId);
    setEditingZone(zone || null);
    setZoneForm(zone ? { name: zone.name, icon: zone.icon, form_template_id: zone.form_template_id || '' }
      : { name: '', icon: 'zap', form_template_id: '' });
    setIsZoneFormOpen(true);
  };
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...zoneForm, site_id: zoneFormSiteId, form_template_id: zoneForm.form_template_id || null };
    if (editingZone) { await supabase.from('site_zones').update(payload).eq('id', editingZone.id); }
    else { await supabase.from('site_zones').insert(payload); }
    setIsZoneFormOpen(false);
    await fetchZonesForSite(zoneFormSiteId);
  };
  const handleDeleteZone = async (zone: any) => {
    if (!confirm(`Delete zone "${zone.name}" and all its devices?`)) return;
    await supabase.from('site_zones').delete().eq('id', zone.id);
    await fetchZonesForSite(zone.site_id);
  };

  // ── Device CRUD ──
  const handleOpenDeviceForm = (zoneId: string, siteId: string, device?: any) => {
    setDeviceFormZoneId(zoneId);
    setDeviceFormSiteId(siteId);
    setEditingDevice(device || null);
    setDeviceForm(device ? { name: device.name, device_code: device.device_code || '' } : { name: '', device_code: '' });
    setIsDeviceFormOpen(true);
  };
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...deviceForm, zone_id: deviceFormZoneId, site_id: deviceFormSiteId };
    if (editingDevice) { await supabase.from('site_devices').update(payload).eq('id', editingDevice.id); }
    else { await supabase.from('site_devices').insert(payload); }
    setIsDeviceFormOpen(false);
    await fetchDevicesForZone(deviceFormZoneId);
  };
  const handleDeleteDevice = async (device: any) => {
    if (!confirm(`Delete device "${device.name}"?`)) return;
    await supabase.from('site_devices').delete().eq('id', device.id);
    await fetchDevicesForZone(device.zone_id);
  };

  // ── QR ──
  const openQr = (label: string, url: string) => {
    setQrItem({ label, url });
    setTimeout(() => {
      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, url, { width: 256, margin: 2 });
      }
    }, 100);
  };
  const downloadQr = () => {
    if (!qrCanvasRef.current || !qrItem) return;
    const a = document.createElement('a');
    a.href = qrCanvasRef.current.toDataURL('image/png');
    a.download = `qr-${qrItem.label.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Sites Management</h1>
          <p className="text-slate-500">Manage sites, zones, devices and QR codes</p>
        </div>
        <Button onClick={() => handleOpenSiteForm()} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Add Site
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-slate-400">Loading...</CardContent></Card>
        ) : sites.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-slate-400">No sites found</CardContent></Card>
        ) : sites.map(site => (
          <Card key={site.id} className="overflow-hidden">
            {/* Site Row */}
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleSiteExpand(site.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`transition-transform duration-200 ${expandedSiteId === site.id ? 'rotate-90' : ''}`}>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-lg">{site.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-xs text-slate-600">{site.site_code}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${site.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {site.active ? 'Active' : 'Inactive'}
                    </span>
                    {site.form_templates && <span className="text-xs text-slate-400">{site.form_templates.name}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Button variant="outline" size="sm" onClick={() => openQr(site.name, `${window.location.origin}/collect?site=${site.id}`)}>
                  <QrCode className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`/site-screen?site=${site.id}`, '_blank')}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenSiteForm(site)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Expanded: Zones + Devices */}
            {expandedSiteId === site.id && (
              <div className="border-t bg-slate-50 px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Zones & Devices</h3>
                  <Button size="sm" onClick={() => handleOpenZoneForm(site.id)} className="flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Zone
                  </Button>
                </div>

                {(!zonesMap[site.id] || zonesMap[site.id].length === 0) ? (
                  <p className="text-slate-400 text-sm py-4 text-center">No zones yet. Add a zone to get started.</p>
                ) : (
                  <div className="space-y-3">
                    {zonesMap[site.id].map(zone => (
                      <div key={zone.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {/* Zone Header */}
                        <div
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
                          onClick={() => setExpandedZoneId(expandedZoneId === zone.id ? null : zone.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${COLOR_MAP[zone.icon] || 'bg-slate-100 text-slate-600'}`}>
                              {ICON_MAP[zone.icon] || <Zap className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{zone.name}</p>
                              <p className="text-xs text-slate-400">
                                {devicesMap[zone.id]?.length || 0} device(s)
                                {zone.form_templates && ` · ${zone.form_templates.name}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleOpenDeviceForm(zone.id, site.id)}
                              className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100 font-medium flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Device
                            </button>
                            <button onClick={() => handleOpenZoneForm(site.id, zone)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteZone(zone)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedZoneId === zone.id ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Devices List */}
                        {expandedZoneId === zone.id && (
                          <div className="border-t divide-y divide-slate-100">
                            {(!devicesMap[zone.id] || devicesMap[zone.id].length === 0) ? (
                              <p className="px-4 py-3 text-slate-400 text-sm">No devices in this zone yet.</p>
                            ) : devicesMap[zone.id].map(device => (
                              <div key={device.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${COLOR_MAP[zone.icon] || 'bg-slate-100'}`}>
                                    {ICON_MAP[zone.icon] ? React.cloneElement(ICON_MAP[zone.icon] as React.ReactElement<{ className: string }>, { className: 'w-3.5 h-3.5' }) : null}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-800 text-sm">{device.name}</p>
                                    {device.device_code && <p className="text-xs font-mono text-slate-400">{device.device_code}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openQr(`${device.name}`, `${window.location.origin}/collect?site=${site.id}&device=${device.id}`)}
                                    className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-100 font-medium"
                                  >
                                    <QrCode className="w-3 h-3" /> QR
                                  </button>
                                  <button onClick={() => handleOpenDeviceForm(zone.id, site.id, device)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteDevice(device)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* ── Site Form Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle>{editingSite ? 'Edit Site' : 'Add New Site'}</CardTitle>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSite} className="space-y-4">
                <Input label="Site Name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <Input label="Site Code (Unique)" required value={formData.site_code} onChange={e => setFormData({ ...formData, site_code: e.target.value })} />
                <Input label="Address / Location" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Default Form Template</label>
                  <select className="w-full h-11 px-3 rounded-md border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    value={formData.form_template_id} onChange={e => setFormData({ ...formData, form_template_id: e.target.value })}>
                    <option value="">-- None --</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} className="w-4 h-4 text-amber-600 rounded" />
                  <label htmlFor="active" className="text-sm text-slate-700">Site is active</label>
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Site</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
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
              <form onSubmit={handleSaveZone} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Zone Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ZONE_OPTIONS.map(opt => (
                      <button key={opt.icon} type="button"
                        onClick={() => setZoneForm({ ...zoneForm, name: opt.label, icon: opt.icon })}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${zoneForm.icon === opt.icon ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${opt.color}`}>
                          {ICON_MAP[opt.icon]}
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="Zone Name" required value={zoneForm.name} onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Form Template (for all devices in this zone)</label>
                  <select className="w-full h-11 px-3 rounded-md border border-slate-300 focus:border-amber-500 outline-none"
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
              <form onSubmit={handleSaveDevice} className="space-y-4">
                <Input label="Device Name" placeholder="e.g. HVAC Unit 1" required value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} />
                <Input label="Device Code / Tag (Optional)" placeholder="e.g. HVAC-01" value={deviceForm.device_code} onChange={e => setDeviceForm({ ...deviceForm, device_code: e.target.value })} />
                <div className="pt-4 flex justify-end gap-3 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDeviceFormOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Device</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── QR Modal ── */}
      {qrItem && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-2xl text-center">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle className="text-base">{qrItem.label}</CardTitle>
              <button onClick={() => setQrItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl border inline-block">
                <canvas ref={qrCanvasRef}></canvas>
              </div>
              <p className="text-xs text-slate-400 break-all font-mono px-2">{qrItem.url}</p>
              <div className="w-full space-y-2">
                <Button onClick={downloadQr} className="w-full flex justify-center items-center gap-2">
                  <Download className="w-4 h-4" /> Download QR
                </Button>
                <Button variant="outline" className="w-full flex justify-center items-center gap-2"
                  onClick={() => { navigator.clipboard.writeText(qrItem.url); alert('Link copied!'); }}>
                  <Copy className="w-4 h-4" /> Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
