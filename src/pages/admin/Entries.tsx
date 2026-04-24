import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Eye, Clock, CheckCircle2, XCircle, Download, Filter, Search, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

export default function Entries() {
  const [entries, setEntries] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  // Filter state
  const [searchPhone, setSearchPhone] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchEntries();
    fetchSites();
  }, []);

  const fetchEntries = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('entries')
      .select(`*, sites(name, id), form_templates(name)`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
    } else {
      setEntries(data || []);
    }
    setIsLoading(false);
  };

  const fetchSites = async () => {
    const { data } = await supabase.from('sites').select('id, name').order('name');
    setSites(data || []);
  };

  // Apply all filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchPhone = searchPhone
        ? entry.worker_phone?.includes(searchPhone)
        : true;
      const matchSite = filterSite
        ? entry.sites?.id === filterSite
        : true;
      const matchStatus = filterStatus
        ? entry.status === filterStatus
        : true;
      const entryDate = new Date(entry.created_at);
      const matchFrom = filterDateFrom
        ? entryDate >= new Date(filterDateFrom)
        : true;
      const matchTo = filterDateTo
        ? entryDate <= new Date(filterDateTo + 'T23:59:59')
        : true;
      return matchPhone && matchSite && matchStatus && matchFrom && matchTo;
    });
  }, [entries, searchPhone, filterSite, filterStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setSearchPhone('');
    setFilterSite('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const activeFilterCount = [searchPhone, filterSite, filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length;

  // Excel Export
  const handleExcelDownload = () => {
    if (filteredEntries.length === 0) return;

    // Flatten field_values into columns
    const allFieldKeys = Array.from(
      new Set(filteredEntries.flatMap(e => Object.keys(e.field_values || {})))
    );

    const rows = filteredEntries.map(entry => {
      const base: Record<string, any> = {
        'Timestamp': format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'Site': entry.sites?.name || 'Unknown',
        'Worker Phone': entry.worker_phone,
        'Form Template': entry.form_templates?.name || 'Unknown',
        'Status': entry.status,
      };
      allFieldKeys.forEach(key => {
        base[key] = entry.field_values?.[key] ?? '';
      });
      return base;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto column widths
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length), 12)
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries');

    const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm');
    XLSX.writeFile(workbook, `o-hour-entries_${dateStr}.xlsx`);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'confirmed':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmed</span>;
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Entries</h1>
          <p className="text-slate-500 mt-1">View, filter and export all submitted field data</p>
        </div>
        <Button
          onClick={handleExcelDownload}
          disabled={filteredEntries.length === 0}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Download Excel
          {filteredEntries.length > 0 && (
            <span className="ml-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {filteredEntries.length}
            </span>
          )}
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Phone search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by phone..."
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>

            {/* Toggle more filters */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showFilters || activeFilterCount > 1
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-amber-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-slate-500 hover:text-red-500 transition-colors underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
              {/* Site filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Site</label>
                <select
                  value={filterSite}
                  onChange={e => setFilterSite(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="">All Sites</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filteredEntries.length}</span> of{' '}
          <span className="font-semibold text-slate-700">{entries.length}</span> entries
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Timestamp</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Site</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Worker Phone</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Template</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading entries...</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-slate-400 font-medium">No entries match your filters</p>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="mt-2 text-sm text-amber-600 underline">Clear filters</button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {entry.sites?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                      {entry.worker_phone}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {entry.form_templates?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedEntry(entry)}>
                        <Eye className="w-4 h-4 mr-2" /> View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-2xl my-8 animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row justify-between items-start border-b pb-4 mb-4 sticky top-0 bg-white z-10 rounded-t-xl">
              <div>
                <CardTitle>Entry Details</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Submitted {format(new Date(selectedEntry.created_at), 'PPP pp')}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Site</p>
                  <p className="font-medium text-slate-900">{selectedEntry.sites?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Worker Phone</p>
                  <p className="font-medium text-slate-900 font-mono">{selectedEntry.worker_phone}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Template</p>
                  <p className="font-medium text-slate-900">{selectedEntry.form_templates?.name || 'Unknown'}</p>
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
                      <p className="text-slate-900 font-medium">
                        {String(value) || <span className="text-slate-400 italic">Empty</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download single entry */}
              <div className="pt-2 border-t">
                <Button
                  onClick={() => {
                    const rows = [{
                      'Timestamp': format(new Date(selectedEntry.created_at), 'yyyy-MM-dd HH:mm:ss'),
                      'Site': selectedEntry.sites?.name || '',
                      'Worker Phone': selectedEntry.worker_phone,
                      'Template': selectedEntry.form_templates?.name || '',
                      'Status': selectedEntry.status,
                      ...selectedEntry.field_values,
                    }];
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Entry');
                    XLSX.writeFile(wb, `entry_${selectedEntry.id.slice(0, 8)}.xlsx`);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export This Entry as Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
