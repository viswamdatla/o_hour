import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Edit2, X, UploadCloud, Download } from 'lucide-react';

export default function Workers() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('workers').select('*').order('created_at', { ascending: false });
    if (data) setWorkers(data);
    setIsLoading(false);
  };

  const handleOpenForm = (worker?: any) => {
    if (worker) {
      setEditingWorker(worker);
      setFormData({
        name: worker.name,
        phone: worker.phone,
        active: worker.active
      });
    } else {
      setEditingWorker(null);
      setFormData({ name: '', phone: '', active: true });
    }
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWorker) {
        await supabase.from('workers').update(formData).eq('id', editingWorker.id);
      } else {
        await supabase.from('workers').insert(formData);
      }
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error saving worker. Make sure phone number is unique.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
      // Assuming simple CSV: name,phone
      // skip header if present
      const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
      
      const toInsert = [];
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 2) {
          toInsert.push({ name: parts[0].trim(), phone: parts[1].trim(), active: true });
        }
      }

      if (toInsert.length > 0) {
        try {
          const phones = toInsert.map(w => w.phone);
          const { data: existing } = await supabase.from('workers').select('phone').in('phone', phones);
          const existingPhones = new Set(existing?.map(w => w.phone) || []);
          
          const uniqueToInsert = [];
          const seenInCsv = new Set();
          for (const w of toInsert) {
            if (!existingPhones.has(w.phone) && !seenInCsv.has(w.phone)) {
              uniqueToInsert.push(w);
              seenInCsv.add(w.phone);
            }
          }

          if (uniqueToInsert.length > 0) {
            await supabase.from('workers').insert(uniqueToInsert);
          }
          alert(`Successfully imported ${toInsert.length} workers.`);
          setIsBulkOpen(false);
          fetchData();
        } catch (err) {
          console.error(err);
          alert('Error importing workers. Some phone numbers might be duplicates.');
        }
      }
    };
    reader.readAsText(file);
  };

  const downloadSample = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name,Phone\\nJohn Doe,9876543210\\nJane Smith,9876543211";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_workers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Workers</h1>
          <p className="text-slate-500">Manage registered field workers</p>
        </div>
        <div className="space-x-3">
          <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="flex items-center">
            <UploadCloud className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => handleOpenForm()} className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Worker
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Phone</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : workers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No workers found</td></tr>
              ) : (
                workers.map(worker => (
                  <tr key={worker.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{worker.name}</td>
                    <td className="px-6 py-4 text-slate-600">{worker.phone}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${worker.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {worker.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenForm(worker)}>
                        <Edit2 className="w-4 h-4" />
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
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle>{editingWorker ? 'Edit Worker' : 'Add New Worker'}</CardTitle>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="Full Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
                <Input
                  label="Phone Number"
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
                
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <label htmlFor="active" className="text-sm text-slate-700">Worker is active</label>
                </div>

                <div className="pt-6 flex justify-end space-x-3 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Worker</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4 mb-4">
              <CardTitle>Bulk Import Workers</CardTitle>
              <button onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-slate-600">
                Upload a CSV file containing worker details. The file must have exactly two columns: <strong>Name</strong> and <strong>Phone</strong>.
              </p>
              
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-700">Click to select a CSV file</p>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="ghost" onClick={downloadSample} className="text-slate-500">
                  <Download className="w-4 h-4 mr-2" /> Sample CSV
                </Button>
                <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
