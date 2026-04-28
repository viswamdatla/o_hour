import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Building2, Users, FileText, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSites: 0,
    totalWorkers: 0,
    totalEntries: 0,
    confirmedEntries: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      // Fetch aggregations (for a small project, multiple queries are fine)
      const [
        { count: sitesCount },
        { count: workersCount },
        { count: entriesCount },
        { count: confirmedCount },
        { data: recent },
        { data: last7Days }
      ] = await Promise.all([
        supabase.from('sites').select('*', { count: 'exact', head: true }),
        supabase.from('workers').select('*', { count: 'exact', head: true }),
        supabase.from('entries').select('*', { count: 'exact', head: true }),
        supabase.from('entries').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('entries')
          .select(`*, site_zones(name), site_devices(name), form_templates(name)`)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('entries')
          .select('created_at, status')
          .gte('created_at', subDays(new Date(), 7).toISOString())
      ]);

      setStats({
        totalSites: sitesCount || 0,
        totalWorkers: workersCount || 0,
        totalEntries: entriesCount || 0,
        confirmedEntries: confirmedCount || 0,
      });

      if (recent) setRecentEntries(recent);

      // Process chart data
      if (last7Days) {
        const days = Array.from({ length: 7 }).map((_, i) => {
          const d = subDays(new Date(), 6 - i);
          return format(d, 'MMM dd');
        });
        
        const counts = days.reduce((acc, day) => ({ ...acc, [day]: 0 }), {} as Record<string, number>);
        last7Days.forEach(entry => {
          const day = format(new Date(entry.created_at), 'MMM dd');
          if (counts[day] !== undefined) {
            counts[day]++;
          }
        });

        setChartData(days.map(day => ({ name: day, entries: counts[day] })));
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Sites', value: stats.totalSites, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-100' },
    { title: 'Total Workers', value: stats.totalWorkers, icon: Users, color: 'text-amber-500', bg: 'bg-amber-100' },
    { title: 'Total Entries', value: stats.totalEntries, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-100' },
    { title: 'Confirmed Entries', value: stats.confirmedEntries, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100' },
  ];

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading dashboard data...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Dashboard Overview</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Entries Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="entries" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center space-x-4">
                  <div className={`w-2 h-2 rounded-full ${entry.status === 'confirmed' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {entry.site_devices?.name || 'Unknown Device'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {entry.worker_phone} • {entry.site_zones?.name || entry.form_templates?.name}
                    </p>
                  </div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    {format(new Date(entry.created_at), 'MMM dd, HH:mm')}
                  </div>
                </div>
              ))}
              {recentEntries.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No recent entries found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
