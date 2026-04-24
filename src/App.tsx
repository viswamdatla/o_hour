import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';

// Lazy loaded components
const CollectData = React.lazy(() => import('@/pages/worker/CollectData'));
const SiteScreen = React.lazy(() => import('@/pages/site-screen/SiteScreen'));
const Login = React.lazy(() => import('@/pages/admin/Login'));
const Dashboard = React.lazy(() => import('@/pages/admin/Dashboard'));
const Sites = React.lazy(() => import('@/pages/admin/Sites'));
const Workers = React.lazy(() => import('@/pages/admin/Workers'));
const Forms = React.lazy(() => import('@/pages/admin/Forms'));
const Entries = React.lazy(() => import('@/pages/admin/Entries'));

const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Worker Flow */}
          <Route path="/collect" element={<CollectData />} />
          
          {/* Site Screen Display */}
          <Route path="/site-screen" element={<SiteScreen />} />
          
          {/* Admin Portal - Login */}
          <Route path="/admin" element={<Login />} />
          
          {/* Admin Portal - Authenticated Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sites" element={<Sites />} />
            <Route path="workers" element={<Workers />} />
            <Route path="forms" element={<Forms />} />
            <Route path="entries" element={<Entries />} />
          </Route>
          
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
