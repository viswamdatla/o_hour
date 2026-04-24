import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OtpInput } from '@/components/worker/OtpInput';
import { DynamicFormRender } from '@/components/worker/DynamicFormRender';
import { Phone, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';

type Step = 'PHONE_INPUT' | 'WORKER_OTP' | 'FORM' | 'SITE_CONFIRM' | 'SUCCESS';

export default function CollectData() {
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get('site');

  const [step, setStep] = useState<Step>('PHONE_INPUT');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data State
  const [siteData, setSiteData] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [workerOtp, setWorkerOtp] = useState('');
  const [workerSessionId, setWorkerSessionId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [siteConfirmOtp, setSiteConfirmOtp] = useState('');
  const [entryId, setEntryId] = useState('');
  const [devOtp, setDevOtp] = useState(''); // Dev-mode OTP display (replace with SMS in production)
  const [devSiteOtp, setDevSiteOtp] = useState(''); // Dev-mode site OTP display
  const [unauthorized, setUnauthorized] = useState(false); // Phone not in workers list

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
        .select(`*, form_templates (id, name, form_fields (*))`)
        .eq('id', siteId)
        .single();
        
      if (error) throw error;
      setSiteData(data);
      
      if (data?.form_templates?.form_fields) {
        // Sort fields by sort_order
        const fields = [...data.form_templates.form_fields].sort((a, b) => a.sort_order - b.sort_order);
        setFormFields(fields);
      }
    } catch (err: any) {
      console.error(err);
      setError('Invalid or inactive site link.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1 -> 2: Request Worker OTP
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setError('');
    setIsLoading(true);
    
    try {
      // 1. Check if worker exists and is active
      const { data: worker, error: workerErr } = await supabase
        .from('workers')
        .select('*')
        .eq('phone', phone)
        .eq('active', true)
        .single();
        
      if (workerErr || !worker) {
        setUnauthorized(true);
        throw new Error('Number not authorized');
      }
      setUnauthorized(false);

      // 2. Generate a 4 digit OTP and create a session
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins
      
      const { data: session, error: sessionErr } = await supabase
        .from('otp_sessions')
        .insert({
          phone,
          otp_code: generatedOtp,
          type: 'worker',
          site_id: siteId,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // TODO: Replace with real SMS provider (Twilio, MSG91, etc.)
      // For now, display the OTP on screen for testing
      console.log(`[SMS MOCK] To: ${phone} - Your worker verification OTP is: ${generatedOtp}`);
      setDevOtp(generatedOtp);
      
      setWorkerSessionId(session.id);
      setWorkerName(worker.name);
      setStep('WORKER_OTP');
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 -> 3: Verify Worker OTP
  const handleWorkerOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workerOtp.length !== 4) {
      setError('Please enter a 4-digit code');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const { data: session, error: sessionErr } = await supabase
        .from('otp_sessions')
        .select('*')
        .eq('id', workerSessionId)
        .single();
        
      if (sessionErr || !session) throw new Error('Session not found');
      if (new Date() > new Date(session.expires_at)) throw new Error('OTP Expired');
      if (session.otp_code !== workerOtp) throw new Error('Invalid OTP');

      // Update session as verified
      await supabase.from('otp_sessions').update({ verified: true }).eq('id', workerSessionId);
      
      setStep('FORM');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3 -> 4: Submit Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    const newErrors: Record<string, string> = {};
    formFields.forEach(field => {
      if (field.required && !formValues[field.id]) {
        newErrors[field.id] = 'This field is required';
      }
    });
    
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create pending entry
      const { data: entry, error: entryErr } = await supabase
        .from('entries')
        .insert({
          site_id: siteId,
          worker_phone: phone,
          form_template_id: siteData.form_template_id,
          field_values: formValues,
          status: 'pending'
        })
        .select()
        .single();

      if (entryErr) throw entryErr;
      
      // Generate and insert site_confirm OTP
      const generatedSiteOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      
      const { error: sessionErr } = await supabase
        .from('otp_sessions')
        .insert({
          phone,
          otp_code: generatedSiteOtp,
          type: 'site_confirm',
          site_id: siteId,
          entry_id: entry.id,
          expires_at: expiresAt
        });

      if (sessionErr) throw sessionErr;

      // Broadcast to site screen
      const channel = supabase.channel(`site-confirm-${siteId}`);
      await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'otp_generated',
            payload: {
              otp: generatedSiteOtp,
              worker_name: workerName,
              entry_id: entry.id
            }
          });
        }
      });

      // DEV: store for on-screen display
      setDevSiteOtp(generatedSiteOtp);
      setEntryId(entry.id);
      setStep('SITE_CONFIRM');
    } catch (err: any) {
      setError(err.message || 'Failed to submit form');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4 -> 5: Site Screen Confirmation
  const handleSiteConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (siteConfirmOtp.length !== 4) {
      setError('Please enter a 4-digit code');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      // Check the latest OTP for this site that hasn't expired and is type 'site_confirm'
      const { data: sessions, error: sessionErr } = await supabase
        .from('otp_sessions')
        .select('*')
        .eq('site_id', siteId)
        .eq('type', 'site_confirm')
        .eq('verified', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionErr) throw sessionErr;
      if (!sessions || sessions.length === 0) throw new Error('No active confirmation session found. Please wait for the site screen to refresh.');
      
      const activeSession = sessions[0];
      
      if (activeSession.otp_code !== siteConfirmOtp) {
        throw new Error('Incorrect Code. Look at the Site Screen again.');
      }

      // Mark verified
      await supabase.from('otp_sessions').update({ verified: true, entry_id: entryId }).eq('id', activeSession.id);
      
      // Mark entry as confirmed
      await supabase.from('entries').update({ status: 'confirmed' }).eq('id', entryId);

      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!siteId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
            <p className="text-slate-500">Please scan a valid QR code at the site to collect data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 sm:p-6 md:p-8">
      {/* Amber header background */}
      <div className="fixed top-0 inset-x-0 h-52 bg-amber-500 rounded-b-[40px] shadow-lg" style={{ zIndex: 0 }}></div>

      <div className="relative max-w-xl w-full mx-auto mt-4 mb-8 text-white flex items-center justify-between" style={{ zIndex: 1 }}>
        <div>
          <h1 className="text-2xl font-bold drop-shadow">Data Collection</h1>
          {siteData && <p className="text-white/90 flex items-center mt-1"><Building2 className="w-4 h-4 mr-1" /> {siteData.name}</p>}
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
          <span className="font-bold text-lg">{step === 'PHONE_INPUT' ? '1' : step === 'WORKER_OTP' ? '2' : step === 'FORM' ? '3' : step === 'SITE_CONFIRM' ? '4' : '✓'}</span>
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

          {step === 'PHONE_INPUT' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  unauthorized ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  <Phone className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Identify Yourself</h2>
                <p className="text-slate-500 mt-2">Enter your registered mobile number to proceed.</p>
              </div>

              {/* Unauthorized number warning */}
              {unauthorized && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700">Number not authorized</p>
                    <p className="text-sm text-red-500 mt-0.5">This number is not registered in the system. Please contact your supervisor.</p>
                  </div>
                </div>
              )}
              
              <Input
                label="Phone Number"
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setUnauthorized(false); }}
                maxLength={10}
                required
              />
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading || !siteData}>
                Send OTP
              </Button>
            </form>
          )}

          {step === 'WORKER_OTP' && (
            <form onSubmit={handleWorkerOtpSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Verify Number</h2>
                <p className="text-slate-500 mt-2">Enter the 4-digit code sent to <br/><span className="font-semibold text-slate-700">{phone}</span></p>
              </div>

              {/* DEV MODE: Show OTP on screen (remove this block when SMS is integrated) */}
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
              
              <Button type="submit" className="w-full mt-8" size="lg" isLoading={isLoading}>
                Verify & Continue
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setStep('PHONE_INPUT')} className="text-sm text-amber-600 font-medium hover:underline">Change Number</button>
              </div>
            </form>
          )}

          {step === 'FORM' && (
            <form onSubmit={handleFormSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b pb-4 mb-4">
                <h2 className="text-xl font-bold text-slate-800">{siteData?.form_templates?.name || 'Data Entry Form'}</h2>
                <p className="text-slate-500 text-sm mt-1">Please fill out all required fields.</p>
              </div>
              
              <DynamicFormRender 
                fields={formFields} 
                values={formValues} 
                onChange={(id, val) => setFormValues(prev => ({...prev, [id]: val}))} 
                errors={formErrors}
              />
              
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Submit Readings
              </Button>
            </form>
          )}

          {step === 'SITE_CONFIRM' && (
            <form onSubmit={handleSiteConfirmSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Final Verification</h2>
                <p className="text-slate-500 mt-2">Look at the screen at the site and enter the 4-digit code displayed there.</p>
              </div>

              {/* DEV MODE: Show site OTP on screen (remove when using real Site Screen monitor) */}
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
              
              <Button type="submit" className="w-full mt-8" size="lg" isLoading={isLoading}>
                Confirm Submission
              </Button>
            </form>
          )}

          {step === 'SUCCESS' && (
            <div className="text-center py-8 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Success!</h2>
              <p className="text-slate-500 mb-8 max-w-sm mx-auto">Your readings have been successfully recorded and verified at the site.</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                Submit Another Entry
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
