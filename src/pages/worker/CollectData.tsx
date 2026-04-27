import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { OtpInput } from '@/components/worker/OtpInput';
import { DynamicFormRender } from '@/components/worker/DynamicFormRender';
import {
  Phone, CheckCircle2, AlertCircle, Building2,
  Wind, Zap, Battery, Activity, Power, Droplets, Flame, ChevronRight, Cpu
} from 'lucide-react';

type Step = 'PHONE_INPUT' | 'WORKER_OTP' | 'ZONE_SELECT' | 'DEVICE_SELECT' | 'FORM' | 'SITE_CONFIRM' | 'SUCCESS';

const ZONE_ICONS: Record<string, React.ReactNode> = {
  wind:     <Wind className="w-8 h-8" />,
  zap:      <Zap className="w-8 h-8" />,
  battery:  <Battery className="w-8 h-8" />,
  activity: <Activity className="w-8 h-8" />,
  power:    <Power className="w-8 h-8" />,
  droplets: <Droplets className="w-8 h-8" />,
  flame:    <Flame className="w-8 h-8" />,
  cpu:      <Cpu className="w-8 h-8" />,
};

const ZONE_COLORS: Record<string, string> = {
  wind:     'bg-sky-100 text-sky-600 border-sky-200',
  zap:      'bg-amber-100 text-amber-600 border-amber-200',
  battery:  'bg-green-100 text-green-600 border-green-200',
  activity: 'bg-purple-100 text-purple-600 border-purple-200',
  power:    'bg-orange-100 text-orange-600 border-orange-200',
  droplets: 'bg-blue-100 text-blue-600 border-blue-200',
  flame:    'bg-red-100 text-red-600 border-red-200',
  cpu:      'bg-slate-100 text-slate-600 border-slate-200',
};

export default function CollectData() {
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get('site');
  const deviceIdParam = searchParams.get('device'); // Direct device QR

  const [step, setStep] = useState<Step>('PHONE_INPUT');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  // Site & device data
  const [siteData, setSiteData] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);

  // Worker data
  const [phone, setPhone] = useState('');
  const [workerOtp, setWorkerOtp] = useState('');
  const [workerSessionId, setWorkerSessionId] = useState('');
  const [workerName, setWorkerName] = useState('');

  // Form data
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Confirmation
  const [siteConfirmOtp, setSiteConfirmOtp] = useState('');
  const [entryId, setEntryId] = useState('');

  // Dev-mode OTP display (remove when SMS integrated)
  const [devOtp, setDevOtp] = useState('');
  const [devSiteOtp, setDevSiteOtp] = useState('');

  // 1. Fetch site data on load
  useEffect(() => {
    if (!siteId) return;
    fetchSiteData();
  }, [siteId]);

  const fetchSiteData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();
      if (error) throw error;
      setSiteData(data);

      // If device QR was scanned, load device+form immediately
      if (deviceIdParam) {
        await loadDeviceDirectly(deviceIdParam);
      }
    } catch (err: any) {
      setError('Invalid or inactive site link.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load a device by ID (used when device QR is scanned directly)
  const loadDeviceDirectly = async (deviceId: string) => {
    const { data: device, error } = await supabase
      .from('site_devices')
      .select('*, form_templates(id, name, form_fields(*)), site_zones(*, form_templates(id, name, form_fields(*)))')
      .eq('id', deviceId)
      .single();
    if (error || !device) return;

    setSelectedDevice(device);
    setSelectedZone(device.site_zones);
    // Device's own template takes priority over zone template
    const template = device.form_templates || device.site_zones?.form_templates;
    loadFormFields(template);
  };

  const loadFormFields = (template: any) => {
    if (template?.form_fields) {
      const sorted = [...template.form_fields].sort((a: any, b: any) => a.sort_order - b.sort_order);
      setFormFields(sorted);
    }
  };

  // Fetch zones for this site (called after worker OTP verified, if no device param)
  const fetchZones = async () => {
    const { data } = await supabase
      .from('site_zones')
      .select('*, form_templates(id, name, form_fields(*))')
      .eq('site_id', siteId)
      .eq('active', true)
      .order('sort_order');
    return data || [];
  };

  // Fetch devices for a zone
  const fetchDevices = async (zoneId: string) => {
    const { data } = await supabase
      .from('site_devices')
      .select('*, form_templates(id, name, form_fields(*))')
      .eq('zone_id', zoneId)
      .eq('active', true)
      .order('sort_order');
    return data || [];
  };

  // Step 1 → 2: Request Worker OTP
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) { setError('Please enter a valid phone number'); return; }
    setError(''); setIsLoading(true);
    try {
      const { data: worker, error: workerErr } = await supabase
        .from('workers').select('*').eq('phone', phone).eq('active', true).single();
      if (workerErr || !worker) { setUnauthorized(true); throw new Error('Number not authorized'); }
      setUnauthorized(false);

      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const { data: session, error: sessionErr } = await supabase
        .from('otp_sessions').insert({ phone, otp_code: generatedOtp, type: 'worker', site_id: siteId, expires_at: expiresAt })
        .select().single();
      if (sessionErr) throw sessionErr;

      // Send OTP via Twilio (Supabase Edge Function)
      const { error: smsErr } = await supabase.functions.invoke('send-otp', {
        body: { phone, otp: generatedOtp },
      });
      if (smsErr) console.warn('SMS send failed (OTP still stored):', smsErr);
      setWorkerSessionId(session.id);
      setWorkerName(worker.name);
      setStep('WORKER_OTP');
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP');
    } finally { setIsLoading(false); }
  };

  // Step 2 → 3: Verify Worker OTP → decide next step
  const handleWorkerOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workerOtp.length !== 4) { setError('Please enter the 4-digit code'); return; }
    setError(''); setIsLoading(true);
    try {
      const { data: session, error } = await supabase
        .from('otp_sessions').select('*').eq('id', workerSessionId).single();
      if (error || !session) throw new Error('Session not found');
      if (session.otp_code !== workerOtp) throw new Error('Invalid OTP. Please try again.');
      if (new Date(session.expires_at) < new Date()) throw new Error('OTP expired. Please go back and request a new one.');
      await supabase.from('otp_sessions').update({ verified: true }).eq('id', workerSessionId);

      // Branch: device QR scanned → go straight to form
      if (deviceIdParam && selectedDevice) {
        setStep('FORM');
        return;
      }

      // Otherwise: load zones
      const fetchedZones = await fetchZones();
      if (fetchedZones.length > 0) {
        setZones(fetchedZones);
        setStep('ZONE_SELECT');
      } else {
        // No zones configured — load site's default form (legacy)
        const { data: site } = await supabase
          .from('sites').select('*, form_templates(id, name, form_fields(*))')
          .eq('id', siteId).single();
        if (site?.form_templates?.form_fields) {
          loadFormFields(site.form_templates);
        }
        setStep('FORM');
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
    } finally { setIsLoading(false); }
  };

  // Step 3: Select Zone → Step 4
  const handleZoneSelect = async (zone: any) => {
    setSelectedZone(zone);
    loadFormFields(zone.form_templates);
    setIsLoading(true);
    const devList = await fetchDevices(zone.id);
    setDevices(devList);
    setIsLoading(false);
    setStep('DEVICE_SELECT');
  };

  // Step 4: Select Device → Step 5
  const handleDeviceSelect = (device: any) => {
    setSelectedDevice(device);
    // Use device's own template if configured, otherwise use the zone's template
    const template = device.form_templates || selectedZone?.form_templates;
    loadFormFields(template);
    setStep('FORM');
  };

  // Step 5 → 6: Submit Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    formFields.forEach(field => {
      if (field.required && !formValues[field.id]) errors[field.id] = 'This field is required';
    });
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setError(''); setIsLoading(true);
    try {
      const { data: entry, error: entryErr } = await supabase
        .from('entries').insert({
          site_id: siteId,
          worker_phone: phone,
          form_template_id: selectedDevice?.form_template_id || selectedZone?.form_template_id || null,
          zone_id: selectedZone?.id || null,
          device_id: selectedDevice?.id || null,
          field_values: formValues,
          status: 'pending'
        }).select().single();
      if (entryErr) throw entryErr;

      const generatedSiteOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const { error: sessionErr } = await supabase.from('otp_sessions').insert({
        phone, otp_code: generatedSiteOtp, type: 'site_confirm', site_id: siteId, entry_id: entry.id, expires_at: expiresAt
      });
      if (sessionErr) throw sessionErr;

      const channel = supabase.channel(`site-confirm-${siteId}`);
      await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'otp_generated', payload: { otp: generatedSiteOtp, worker_name: workerName, entry_id: entry.id, device_name: selectedDevice?.name } });
        }
      });

      setDevSiteOtp(generatedSiteOtp);
      setEntryId(entry.id);
      setStep('SITE_CONFIRM');
    } catch (err: any) {
      setError(err.message || 'Failed to submit form');
    } finally { setIsLoading(false); }
  };

  // Step 6 → 7: Site Screen Confirm
  const handleSiteConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (siteConfirmOtp.length !== 4) { setError('Please enter a 4-digit code'); return; }
    setError(''); setIsLoading(true);
    try {
      const { data: sessions } = await supabase
        .from('otp_sessions').select('*').eq('type', 'site_confirm').eq('entry_id', entryId).eq('verified', false).order('created_at', { ascending: false });
      const session = sessions?.[0];
      if (!session) throw new Error('Session expired or not found.');
      if (session.otp_code !== siteConfirmOtp) throw new Error('Incorrect code. Check the site screen and try again.');
      if (new Date(session.expires_at) < new Date()) throw new Error('Code expired. Please restart.');
      await supabase.from('otp_sessions').update({ verified: true }).eq('id', session.id);
      await supabase.from('entries').update({ status: 'confirmed' }).eq('id', entryId);
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message || 'Confirmation failed');
    } finally { setIsLoading(false); }
  };

  const stepNumber = { PHONE_INPUT: 1, WORKER_OTP: 2, ZONE_SELECT: 3, DEVICE_SELECT: 4, FORM: 5, SITE_CONFIRM: 6, SUCCESS: '✓' }[step];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 sm:p-6 md:p-8">
      {/* Amber header background */}
      <div className="fixed top-0 inset-x-0 h-52 bg-amber-500 rounded-b-[40px] shadow-lg" style={{ zIndex: 0 }}></div>

      <div className="relative max-w-xl w-full mx-auto mt-4 mb-8 text-white flex items-center justify-between" style={{ zIndex: 1 }}>
        <div>
          <h1 className="text-2xl font-bold drop-shadow">Data Collection</h1>
          {siteData && <p className="text-white/90 flex items-center mt-1"><Building2 className="w-4 h-4 mr-1" /> {siteData.name}</p>}
          {selectedZone && <p className="text-white/80 text-sm flex items-center mt-0.5 ml-5">→ {selectedZone.name}{selectedDevice ? ` → ${selectedDevice.name}` : ''}</p>}
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
          <span className="font-bold text-lg">{stepNumber}</span>
        </div>
      </div>

      <Card className="relative w-full max-w-xl mx-auto shadow-xl rounded-2xl overflow-hidden border-0" style={{ zIndex: 1 }}>
        <div className="h-2 bg-gradient-to-r from-amber-400 to-amber-600"></div>
        <CardContent className="p-6 sm:p-8">

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* ── STEP 1: Phone Input ── */}
          {step === 'PHONE_INPUT' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${unauthorized ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  <Phone className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Identify Yourself</h2>
                <p className="text-slate-500 mt-2">Enter your registered mobile number to proceed.</p>
              </div>
              {unauthorized && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700">Number not authorized</p>
                    <p className="text-sm text-red-500 mt-0.5">This number is not registered. Please contact your supervisor.</p>
                  </div>
                </div>
              )}
              <Input label="Phone Number" type="tel" placeholder="e.g. 9876543210"
                value={phone} onChange={(e) => { setPhone(e.target.value); setUnauthorized(false); }} maxLength={10} required />
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading || !siteData}>Send OTP</Button>
            </form>
          )}

          {/* ── STEP 2: Worker OTP ── */}
          {step === 'WORKER_OTP' && (
            <form onSubmit={handleWorkerOtpSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Verify Number</h2>
                <p className="text-slate-500 mt-2">Enter the 4-digit code sent to <br /><span className="font-semibold text-slate-700">{phone}</span></p>
              </div>
              {devOtp && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Demo OTP (No SMS yet)</p>
                    <p className="text-3xl font-mono font-bold text-amber-600 tracking-widest mt-0.5">{devOtp}</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xl">📱</div>
                </div>
              )}
              <OtpInput value={workerOtp} onChange={setWorkerOtp} length={4} />
              <Button type="submit" className="w-full mt-8" size="lg" isLoading={isLoading}>Verify & Continue</Button>
              <div className="text-center">
                <button type="button" onClick={() => setStep('PHONE_INPUT')} className="text-sm text-amber-600 font-medium hover:underline">Change Number</button>
              </div>
            </form>
          )}

          {/* ── STEP 3: Zone Selection (tiles) ── */}
          {step === 'ZONE_SELECT' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Select Area</h2>
                <p className="text-slate-500 mt-2">Which area are you working in?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {zones.map(zone => (
                  <button
                    key={zone.id}
                    onClick={() => handleZoneSelect(zone)}
                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 font-medium transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${ZONE_COLORS[zone.icon] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
                  >
                    <div className="w-14 h-14 rounded-full bg-white/60 flex items-center justify-center shadow-sm">
                      {ZONE_ICONS[zone.icon] || <Zap className="w-8 h-8" />}
                    </div>
                    <span className="text-sm font-semibold text-center leading-tight">{zone.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 4: Device Selection ── */}
          {step === 'DEVICE_SELECT' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('ZONE_SELECT')} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180 text-slate-600" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Select Device</h2>
                  <p className="text-slate-500 text-sm mt-0.5">{selectedZone?.name}</p>
                </div>
              </div>
              <div className="space-y-2">
                {devices.map(device => (
                  <button
                    key={device.id}
                    onClick={() => handleDeviceSelect(device)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ZONE_COLORS[selectedZone?.icon] || 'bg-slate-100'}`}>
                        {ZONE_ICONS[selectedZone?.icon] ? React.cloneElement(ZONE_ICONS[selectedZone.icon] as React.ReactElement<{ className: string }>, { className: 'w-5 h-5' }) : <Zap className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-800">{device.name}</p>
                        {device.device_code && <p className="text-xs text-slate-400 font-mono">{device.device_code}</p>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 5: Form ── */}
          {step === 'FORM' && (
            <form onSubmit={handleFormSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b pb-4 mb-4">
                <h2 className="text-xl font-bold text-slate-800">{selectedZone?.form_templates?.name || siteData?.form_templates?.name || 'Data Entry Form'}</h2>
                {selectedDevice && (
                  <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-sm font-semibold ${ZONE_COLORS[selectedZone?.icon] || 'bg-slate-100 text-slate-600'}`}>
                    {ZONE_ICONS[selectedZone?.icon] ? React.cloneElement(ZONE_ICONS[selectedZone.icon] as React.ReactElement<{ className: string }>, { className: 'w-4 h-4' }) : null}
                    {selectedDevice.name}
                  </div>
                )}
                <p className="text-slate-500 text-sm mt-2">Please fill out all required fields.</p>
              </div>
              <DynamicFormRender fields={formFields} values={formValues}
                onChange={(id, val) => setFormValues(prev => ({ ...prev, [id]: val }))} errors={formErrors} />
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>Submit Readings</Button>
            </form>
          )}

          {/* ── STEP 6: Site Confirm OTP ── */}
          {step === 'SITE_CONFIRM' && (
            <form onSubmit={handleSiteConfirmSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Final Verification</h2>
                <p className="text-slate-500 mt-2">Look at the screen at the site and enter the 4-digit code displayed there.</p>
              </div>
              {devSiteOtp && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Site Screen OTP (Demo)</p>
                    <p className="text-3xl font-mono font-bold text-blue-600 tracking-widest mt-0.5">{devSiteOtp}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl">🖥️</div>
                </div>
              )}
              <OtpInput value={siteConfirmOtp} onChange={setSiteConfirmOtp} length={4} />
              <Button type="submit" className="w-full mt-8" size="lg" isLoading={isLoading}>Confirm Submission</Button>
            </form>
          )}

          {/* ── STEP 7: Success ── */}
          {step === 'SUCCESS' && (
            <div className="text-center py-8 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Success!</h2>
              {selectedDevice && <p className="text-amber-600 font-semibold mb-2">{selectedZone?.name} → {selectedDevice.name}</p>}
              <p className="text-slate-500 mb-8 max-w-sm mx-auto">Your readings have been successfully recorded and verified at the site.</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">Submit Another Entry</Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
