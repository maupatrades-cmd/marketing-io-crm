import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
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
import MonthlyReports from './pages/MonthlyReports';
import ContractSigningPublic from './pages/ContractSigningPublic';
import ContractView from './pages/ContractView';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import EmailTemplates from './pages/EmailTemplates';
import Deliverables from './pages/Deliverables';
import MyKPIs from './pages/MyKPIs';
import TeamKPIs from './pages/TeamKPIs';
import Playbooks from './pages/Playbooks';
import StaffMyDay from './pages/StaffMyDay';
import StaffMyPipeline from './pages/StaffMyPipeline';
import StaffMyClients from './pages/StaffMyClients';
import StaffVerifyLeads from './pages/StaffVerifyLeads';
import StaffCommunications from './pages/StaffCommunications';
import RouteGuard from './components/RouteGuard';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

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

  // Smart landing redirect based on role
  const LandingRedirect = () => {
    if (!user) return <Navigate to="/sign-in" replace />;
    if (user.role === "owner") return <Navigate to="/" replace />;
    if (user.role === "client") return <Navigate to="/client-portal" replace />;
    // All staff roles land on /staff
    return <Navigate to="/staff" replace />;
  };

  // Render the main app
  return (
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/onboarding-form" element={<StaffOnboardingForm />} />
      <Route path="/build-summary" element={<BuildSummary />} />
      {/* Add your page Route elements here */}
      <Route path="/" element={user?.role === "owner" ? <OwnerDashboard /> : <LandingRedirect />} />
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
      <Route path="/monthly-reports" element={<MonthlyReports />} />
      <Route path="/sign-contract" element={<ContractSigningPublic />} />
      <Route path="/contracts/:id" element={<ContractView />} />
      <Route path="/email-templates" element={<EmailTemplates />} />
      <Route path="/deliverables" element={<Deliverables />} />
      <Route path="/my-kpis" element={<MyKPIs />} />
      <Route path="/team-kpis" element={<TeamKPIs />} />
      <Route path="/playbooks" element={<Playbooks />} />
      
      {/* Staff Portal Routes */}
      <Route path="/staff" element={<StaffMyDay />} />
      <Route path="/staff/pipeline" element={<RouteGuard allowedRoles={["field_agent", "cpc"]} fallbackPath="/staff"><StaffMyPipeline /></RouteGuard>} />
      <Route path="/staff/clients" element={<RouteGuard allowedRoles={["field_agent", "cpc", "head_of_tech"]} fallbackPath="/staff"><StaffMyClients /></RouteGuard>} />
      <Route path="/staff/verify-leads" element={<RouteGuard allowedRoles={["admin", "owner"]} fallbackPath="/staff"><StaffVerifyLeads /></RouteGuard>} />
      <Route path="/staff/communications" element={<StaffCommunications />} />
      
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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