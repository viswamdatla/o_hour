import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Clock, Building2, User, ShieldCheck, CheckCircle2 } from 'lucide-react';

type SiteScreenState = 'IDLE' | 'ACTIVE' | 'SUCCESS';

interface ActivePayload {
  otp: string;
  worker_name: string;
  entry_id: string;
}

export default function SiteScreen() {
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get('site');

  const [siteData, setSiteData] = useState<any>(null);
  const [status, setStatus] = useState<SiteScreenState>('IDLE');
  const [activeData, setActiveData] = useState<ActivePayload | null>(null);
  const [countdown, setCountdown] = useState<number>(600); // 10 mins in seconds
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // 1. Fetch site data
  useEffect(() => {
    if (!siteId) return;
    const fetchSite = async () => {
      const { data } = await supabase.from('sites').select('*').eq('id', siteId).single();
      if (data) setSiteData(data);
    };
    fetchSite();
  }, [siteId]);

  // 2. Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Realtime subscription for OTP generated
  useEffect(() => {
    if (!siteId) return;

    const channel = supabase.channel(`site-confirm-${siteId}`);
    
    channel.on('broadcast', { event: 'otp_generated' }, (payload) => {
      console.log('Received broadcast payload:', payload);
      setActiveData(payload.payload as ActivePayload);
      setStatus('ACTIVE');
      setCountdown(600); // reset to 10 mins
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId]);

  // 4. Realtime subscription for Entry confirmation
  useEffect(() => {
    if (!activeData?.entry_id) return;

    const entryChannel = supabase.channel(`entry-updates-${activeData.entry_id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'entries', filter: `id=eq.${activeData.entry_id}` },
        (payload) => {
          if (payload.new.status === 'confirmed') {
            setStatus('SUCCESS');
            // Reset to idle after 5 seconds
            setTimeout(() => {
              setStatus('IDLE');
              setActiveData(null);
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(entryChannel);
    };
  }, [activeData?.entry_id]);

  // 5. Countdown timer for Active state
  useEffect(() => {
    if (status !== 'ACTIVE') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Expired
          setStatus('IDLE');
          setActiveData(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  if (!siteId) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
        <h1 className="text-2xl text-red-400">Invalid Site ID</h1>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-8 font-sans overflow-hidden relative">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-16">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{siteData?.name || 'Loading Site...'}</h1>
            <p className="text-slate-400">Physical Presence Verification</p>
          </div>
        </div>
        <div className="text-right flex items-center space-x-4 bg-slate-800 px-6 py-3 rounded-2xl border border-slate-700">
          <Clock className="w-6 h-6 text-slate-400" />
          <span className="text-3xl font-mono tracking-wider font-light">
            {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        
        {status === 'IDLE' && (
          <div className="text-center animate-in fade-in zoom-in duration-700">
            <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-slate-700">
              <ShieldCheck className="w-16 h-16 text-slate-500" />
            </div>
            <h2 className="text-5xl font-bold text-slate-300 tracking-tight mb-4">Awaiting Submission</h2>
            <p className="text-2xl text-slate-500">Workers must complete the form on their device to generate a code.</p>
          </div>
        )}

        {status === 'ACTIVE' && activeData && (
          <div className="text-center animate-in slide-in-from-bottom-12 fade-in duration-500">
            <div className="inline-flex items-center space-x-3 bg-blue-500/10 text-blue-400 px-6 py-3 rounded-full mb-12 border border-blue-500/20">
              <User className="w-6 h-6" />
              <span className="text-2xl font-medium">{activeData.worker_name}</span>
            </div>
            
            <p className="text-3xl text-slate-400 mb-8">Enter this code on your device to confirm physical presence</p>
            
            <div className="flex space-x-6 justify-center mb-16">
              {activeData.otp.split('').map((digit, i) => (
                <div key={i} className="w-32 h-40 bg-slate-800 border-2 border-slate-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/20">
                  <span className="text-8xl font-bold text-white tracking-tighter">{digit}</span>
                </div>
              ))}
            </div>

            <div className="text-xl text-slate-500">
              Code expires in <span className="font-mono font-bold text-amber-400">{formatTime(countdown)}</span>
            </div>
          </div>
        )}

        {status === 'SUCCESS' && (
          <div className="text-center animate-in zoom-in-95 duration-500">
            <div className="w-48 h-48 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_100px_rgba(34,197,94,0.3)] border border-green-500/30">
              <CheckCircle2 className="w-24 h-24 text-green-400" />
            </div>
            <h2 className="text-6xl font-bold text-white mb-6">Verified Successfully!</h2>
            <p className="text-3xl text-green-400">Thank you, {activeData?.worker_name}</p>
          </div>
        )}

      </div>
    </div>
  );
}
