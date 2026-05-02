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
import Receipts from './pages/Receipts';
import ActivityLog from './pages/ActivityLog';
import CalendarPage from './pages/CalendarPage';
import PayrollReport from './pages/PayrollReport';
import StaffProfile from './pages/StaffProfile';
import InternalMail from './pages/InternalMail';
import StaffHR from './pages/StaffHR';
import Products from './pages/Products';
import StaffOnboardingForm from './pages/StaffOnboardingForm';
import BuildSummary from './pages/BuildSummary';
import LogSale from './pages/LogSale';
import ClientOnboarding from './pages/ClientOnboarding';
import Tasks from './pages/Tasks';
import TeamOversight from './pages/TeamOversight';
import Contracts from './pages/Contracts';
import ClientOnboardingFormPublic from './pages/ClientOnboardingFormPublic';
import ClientOnboardingReview from './pages/ClientOnboardingReview';

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
      {/* Public routes — no auth required */}
      <Route path="/onboarding-form" element={<StaffOnboardingForm />} />
      <Route path="/build-summary" element={<BuildSummary />} />
      {/* Add your page Route elements here */}
      <Route path="/" element={<OwnerDashboard />} />
      <Route path="/design-preview" element={<DesignPreview />} />
      <Route path="/client-portal" element={<ClientPortal />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/deals" element={<Deals />} />
      <Route path="/leads" element={<Leads />} />
      <Route path="/commissions" element={<Commissions />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/receipts" element={<Receipts />} />
      <Route path="/activity" element={<ActivityLog />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/payroll" element={<PayrollReport />} />
      <Route path="/profile" element={<StaffProfile />} />
      <Route path="/mail" element={<InternalMail />} />
      <Route path="/staff" element={<StaffHR />} />
      <Route path="/products" element={<Products />} />
      <Route path="/log-sale" element={<LogSale />} />
      <Route path="/onboarding" element={<ClientOnboarding />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/team-oversight" element={<TeamOversight />} />
      <Route path="/contracts" element={<Contracts />} />
      <Route path="/onboarding-submissions" element={<ClientOnboardingReview />} />
      <Route path="/client-onboarding/:token" element={<ClientOnboardingFormPublic />} />
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