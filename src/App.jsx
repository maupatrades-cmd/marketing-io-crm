import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { appParams } from '@/lib/app-params';
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
import ClientOnboardingFormFull from './pages/ClientOnboardingFormFull';
import ClientInvoices from './pages/ClientInvoices';
import ClientDeliverables from './pages/ClientDeliverables';
import ClientReports from './pages/ClientReports';
import ClientContracts from './pages/ClientContracts';
import ClientUploads from './pages/ClientUploads';
import ClientMessages from './pages/ClientMessages';
import ClientProfile from './pages/ClientProfile';
import OwnerClientDetail from './pages/OwnerClientDetail';
import OwnerFinancials from './pages/OwnerFinancials';
import OwnerReports from './pages/OwnerReports';
import OwnerSettings from './pages/OwnerSettings';
import ClientOrderAddOns from './pages/ClientOrderAddOns';
import ClientOrderDomain from './pages/ClientOrderDomain';
import ClientOrderEmail from './pages/ClientOrderEmail';
import ClientOrders from './pages/ClientOrders';
import AdminServiceOrders from './pages/AdminServiceOrders';
import StaffProductivity from './pages/StaffProductivity';
import DeliverableQuality from './pages/DeliverableQuality';

const AuthRedirect = () => {
  const { navigateToLogin } = useAuth();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900 text-white p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Marketing iO
        </h1>
        <p className="text-lg text-slate-200">Sign in to continue to your CRM</p>

        <button
          onClick={() => navigateToLogin()}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold hover:opacity-90 transition"
        >
          Sign In
        </button>

        <details className="text-sm text-slate-400 mt-8">
          <summary className="cursor-pointer hover:text-slate-200">Having trouble signing in?</summary>
          <div className="mt-3 space-y-2 text-left bg-slate-800 p-4 rounded-lg">
            <p>If the Sign In button keeps looping, sign in directly through Base44:</p>
            <a
              href={`https://app.base44.com/login?app_id=${appParams.appId || ''}`}
              className="block px-4 py-2 bg-slate-700 rounded text-center hover:bg-slate-600"
            >
              Sign in via app.base44.com
            </a>
            <p className="text-xs text-slate-500 pt-2">
              For support: support@marketingio.co.za
            </p>
          </div>
        </details>
      </div>
    </div>
  );
};

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
    if (!user) return <AuthRedirect />;
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
      <Route path="/clients/:id" element={<RouteGuard allowedRoles={["owner", "admin"]} fallbackPath="/"><OwnerClientDetail /></RouteGuard>} />
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
      <Route path="/owner/financials" element={<OwnerFinancials />} />
      <Route path="/owner/reports" element={<OwnerReports />} />
      <Route path="/owner/settings" element={<OwnerSettings />} />
      <Route path="/owner/financials" element={<OwnerFinancials />} />
      <Route path="/owner/reports" element={<OwnerReports />} />
      <Route path="/admin/service-orders" element={<RouteGuard allowedRoles={["admin", "owner"]} fallbackPath="/"><AdminServiceOrders /></RouteGuard>} />
      <Route path="/staff-productivity" element={<RouteGuard allowedRoles={["owner"]} fallbackPath="/"><StaffProductivity /></RouteGuard>} />
      <Route path="/deliverable-quality" element={<RouteGuard allowedRoles={["owner"]} fallbackPath="/"><DeliverableQuality /></RouteGuard>} />

      {/* Staff Portal Routes */}
      <Route path="/staff" element={<StaffMyDay />} />
      <Route path="/staff/pipeline" element={<RouteGuard allowedRoles={["field_agent", "cpc"]} fallbackPath="/staff"><StaffMyPipeline /></RouteGuard>} />
      <Route path="/staff/clients" element={<RouteGuard allowedRoles={["field_agent", "cpc", "head_of_tech"]} fallbackPath="/staff"><StaffMyClients /></RouteGuard>} />
      <Route path="/staff/verify-leads" element={<RouteGuard allowedRoles={["admin", "owner"]} fallbackPath="/staff"><StaffVerifyLeads /></RouteGuard>} />
      <Route path="/staff/communications" element={<StaffCommunications />} />
      
      {/* Client Portal Routes — require client role */}
      <Route path="/client/onboarding-form" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientOnboardingFormFull /></RouteGuard>} />
      <Route path="/client/invoices" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientInvoices /></RouteGuard>} />
      <Route path="/client/deliverables" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientDeliverables /></RouteGuard>} />
      <Route path="/client/reports" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientReports /></RouteGuard>} />
      <Route path="/client/contracts" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientContracts /></RouteGuard>} />
      <Route path="/client/uploads" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientUploads /></RouteGuard>} />
      <Route path="/client/messages" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientMessages /></RouteGuard>} />
      <Route path="/client/profile" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientProfile /></RouteGuard>} />
      <Route path="/client/order-addons" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientOrderAddOns /></RouteGuard>} />
      <Route path="/client/order-domain" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientOrderDomain /></RouteGuard>} />
      <Route path="/client/order-email" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientOrderEmail /></RouteGuard>} />
      <Route path="/client/orders" element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientOrders /></RouteGuard>} />
      
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Auth route aliases */}
      <Route path="/sign-in" element={<AuthRedirect />} />
      <Route path="/signin" element={<AuthRedirect />} />
      <Route path="/login" element={<AuthRedirect />} />
      <Route path="/sign-up" element={<AuthRedirect />} />
      <Route path="/signup" element={<AuthRedirect />} />
      <Route path="/Login" element={<AuthRedirect />} />
      <Route path="/forgot" element={<Navigate to="/forgot-password" replace />} />
      <Route path="/reset" element={<Navigate to="/forgot-password" replace />} />

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