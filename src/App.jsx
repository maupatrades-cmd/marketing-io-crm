import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// Add page imports here
import DesignPreview from './pages/DesignPreview';
import OwnerDashboard from './pages/OwnerDashboard';
import ClientPortal from './pages/ClientPortal';
import Clients from './pages/Clients';
import Deals from './pages/Deals';
import Leads from './pages/Leads';
import Commissions from './pages/Commissions';
import Invoices from './pages/Invoices';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/" element={<OwnerDashboard />} />
      <Route path="/design-preview" element={<DesignPreview />} />
      <Route path="/client-portal" element={<ClientPortal />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/deals" element={<Deals />} />
      <Route path="/leads" element={<Leads />} />
      <Route path="/commissions" element={<Commissions />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App