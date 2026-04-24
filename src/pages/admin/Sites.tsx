import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Edit2, QrCode, X, Copy, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';

export default function Sites() {
  const [sites, setSites] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    site_code: '',
    address: '',
    form_template_id: '',
    active: true
  });

  const [qrModalSite, setQrModalSite] = useState<any>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleOpenForm = (site?: any) => {
    if (site) {
      setEditingSite(site);
      setFormData({
        name: site.name,
        site_code: site.site_code,
        address: site.address || '',
        form_template_id: site.form_template_id || '',
        active: site.active
      });
    } else {
      setEditingSite(null);
      setFormData({ name: '', site_code: '', address: '', form_template_id: '', active: true });
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        form_template_id: formData.form_template_id || null
      };

      if (editingSite) {
        await supabase.from('sites').update(payload).eq('id', editingSite.id);
      } else {
        await supabase.from('sites').insert(payload);
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error saving site');
    }
  };

  const openQrModal = (site: any) => {
    setQrModalSite(site);
    setTimeout(() => {
      if (qrCanvasRef.current) {
        const url = `${window.location.origin}/collect?site=${site.id}`;
        QRCode.toCanvas(qrCanvasRef.current, url, { width: 256, margin: 2 }, (error) => {
          if (error) console.error(error);
        });
      }
    }, 100);
  };

  const downloadQr = () => {
    if (qrCanvasRef.current && qrModalSite) {
      const url = qrCanvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${qrModalSite.site_code}.png`;
      a.click();
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Sites Management</h1>
          <p className="text-slate-500">Manage physical locations and QR codes</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Site Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Code</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Form Template</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : sites.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No sites found</td></tr>
              ) : (
                sites.map(site => (
                  <tr key={site.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{site.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="bg-slate-100 px-2 py-1 rounded font-mono text-sm">{site.site_code}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{site.form_templates?.name || <span className="text-slate-400 italic">None assigned</span>}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${site.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {site.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenForm(site)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openQrModal(site)}>
                        <QrCode className="w-4 h-4 text-indigo-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle>{editingSite ? 'Edit Site' : 'Add New Site'}</CardTitle>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="Site Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
                <Input
                  label="Site Code (Unique)"
                  required
                  value={formData.site_code}
                  onChange={(e) => setFormData({...formData, site_code: e.target.value})}
                />
                <Input
                  label="Address / Location"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Form Template</label>
                  <select
                    className="w-full h-11 px-3 rounded-md border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                    value={formData.form_template_id}
                    onChange={(e) => setFormData({...formData, form_template_id: e.target.value})}
                  >
                    <option value="">-- None --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <label htmlFor="active" className="text-sm text-slate-700">Site is active</label>
                </div>

                <div className="pt-6 flex justify-end space-x-3 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Site</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QR Modal */}
      {qrModalSite && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm shadow-2xl text-center">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle>QR Code: {qrModalSite.name}</CardTitle>
              <button onClick={() => setQrModalSite(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl border mb-6 inline-block">
                <canvas ref={qrCanvasRef}></canvas>
              </div>
              
              <div className="w-full space-y-3">
                <Button onClick={downloadQr} className="w-full flex justify-center items-center">
                  Download QR Code
                </Button>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 flex justify-center items-center"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/collect?site=${qrModalSite.id}`);
                      alert('Link copied!');
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy Link
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 flex justify-center items-center"
                    onClick={() => window.open(`/site-screen?site=${qrModalSite.id}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Site Screen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
