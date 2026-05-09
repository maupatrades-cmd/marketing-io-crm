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
import ClientProjectStatus from './pages/ClientProjectStatus';
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
import SignIn from './pages/SignIn';
import Register from './pages/Register';
import VerifyOTP from './pages/VerifyOTP';
import ClientOnboardingFormFull from './pages/ClientOnboardingFormFull';
import ClientOnboardingWizard from './pages/ClientOnboardingWizard';
import StaffImageGenerator from './pages/StaffImageGenerator';
import ClientInvoices from './pages/ClientInvoices';
import ClientDeliverables from './pages/ClientDeliverables';
import ClientReports from './pages/ClientReports';
import ClientContracts from './pages/ClientContracts';
import ClientUploads from './pages/ClientUploads';
import ClientMessages from './pages/ClientMessages';
import OwnerInbox from './pages/OwnerInbox';
import ClientProfile from './pages/ClientProfile';
import OwnerClientDetail from './pages/OwnerClientDetail';
import OwnerFinancials from './pages/OwnerFinancials';
import OwnerReports from './pages/OwnerReports';
import OwnerSettings from './pages/OwnerSettings';
import CommissionDashboard from './pages/owner/CommissionDashboard';
import LeadInbox from './pages/owner/LeadInbox';
import ClientLayout from './components/ClientLayout';
import ClientProducts from './pages/ClientProducts';
import ClientSettings from './pages/ClientSettings';
import ClientActivity from './pages/ClientActivity';
import InvoiceDetail from './pages/InvoiceDetail';
import ClientThreadDetail from './pages/ClientThreadDetail';
import ClientOrderAddOns from './pages/ClientOrderAddOns';
import ClientOrderDomain from './pages/ClientOrderDomain';
import ClientOrderEmail from './pages/ClientOrderEmail';
import ClientOrders from './pages/ClientOrders';
import ClientSubscription from './pages/ClientSubscription';
import ClientBillingUpdate from './pages/ClientBillingUpdate';
import AdminServiceOrders from './pages/AdminServiceOrders';
import AdminInvoices from './pages/AdminInvoices';
import StaffProductivity from './pages/StaffProductivity';
import DeliverableQuality from './pages/DeliverableQuality';
import LeadScoring from './pages/LeadScoring';
import OwnerCampaigns from './pages/OwnerCampaigns';
import OwnerUsers from './pages/OwnerUsers';
import Unsubscribe from './pages/Unsubscribe';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancelled from './pages/PaymentCancelled';
import PayfastTest from './pages/PayfastTest';
import Checkout from './pages/Checkout';
import PortalCheckout from './pages/PortalCheckout';



const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, user } = useAuth();

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
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/onboarding-form" element={<StaffOnboardingForm />} />
      <Route path="/build-summary" element={<BuildSummary />} />
      {/* Add your page Route elements here */}
      <Route path="/" element={
        isLoadingAuth ? null :
        !user ? <Navigate to="/login" replace /> :
        user.role === "owner" ? <OwnerDashboard /> :
        user.role === "client" ? <Navigate to="/client-portal" replace /> :
        <Navigate to="/staff" replace />
      } />
      <Route path="/design-preview" element={<DesignPreview />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/clients/:id" element={<RouteGuard allowedRoles={["owner", "admin"]} fallbackPath="/"><OwnerClientDetail /></RouteGuard>} />
      <Route path="/inbox" element={<RouteGuard allowedRoles={["owner", "admin"]} fallbackPath="/"><OwnerInbox /></RouteGuard>} />
      <Route path="/deals" element={<Deals />} />
      <Route path="/leads" element={<RouteGuard allowedRoles={["admin", "owner", "cpc", "field_agent"]} fallbackPath="/"><Leads /></RouteGuard>} />
      <Route path="/commissions" element={<Commissions />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/receipts" element={<Receipts />} />
      <Route path="/activity" element={<ActivityLog />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/payroll" element={<PayrollReport />} />
      <Route path="/profile" element={<StaffProfile />} />
      <Route path="/mail" element={<InternalMail />} />
      <Route path="/owner/staff-hr" element={<RouteGuard allowedRoles={["owner"]} fallbackPath="/"><StaffHR /></RouteGuard>} />
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
      <Route path="/admin/invoices" element={<RouteGuard allowedRoles={["admin", "owner"]} fallbackPath="/"><AdminInvoices /></RouteGuard>} />
      <Route path="/staff-productivity" element={<RouteGuard allowedRoles={["owner"]} fallbackPath="/"><StaffProductivity /></RouteGuard>} />
      <Route path="/deliverable-quality" element={<RouteGuard allowedRoles={["owner"]} fallbackPath="/"><DeliverableQuality /></RouteGuard>} />
      <Route path="/lead-scoring" element={<RouteGuard allowedRoles={["owner", "admin", "field_agent", "cpc"]} fallbackPath="/"><LeadScoring /></RouteGuard>} />
      <Route path="/owner/campaigns" element={<RouteGuard allowedRoles={["owner"]} fallbackPath="/"><OwnerCampaigns /></RouteGuard>} />
      <Route path="/owner/users" element={<RouteGuard allowedRoles={["owner"]} fallbackPath="/"><OwnerUsers /></RouteGuard>} />
      <Route path="/owner/commissions" element={<CommissionDashboard />} />
      <Route path="/owner/leads" element={<LeadInbox />} />
      <Route path="/owner/leads/:leadId" element={<LeadInbox />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />

      {/* Staff Portal Routes */}
      <Route path="/staff" element={<RouteGuard allowedRoles={["admin", "owner", "field_agent", "cpc", "head_of_tech", "driver"]} fallbackPath="/"><StaffMyDay /></RouteGuard>} />
      <Route path="/staff/pipeline" element={<RouteGuard allowedRoles={["field_agent", "cpc"]} fallbackPath="/staff"><StaffMyPipeline /></RouteGuard>} />
      <Route path="/staff/clients" element={<RouteGuard allowedRoles={["field_agent", "cpc", "head_of_tech"]} fallbackPath="/staff"><StaffMyClients /></RouteGuard>} />
      <Route path="/staff/verify-leads" element={<RouteGuard allowedRoles={["admin", "owner"]} fallbackPath="/staff"><StaffVerifyLeads /></RouteGuard>} />
      <Route path="/staff/communications" element={<StaffCommunications />} />
      <Route path="/staff/image-generator" element={<RouteGuard allowedRoles={["admin", "owner", "head_of_tech"]} fallbackPath="/staff"><StaffImageGenerator /></RouteGuard>} />
      
      {/* Client Portal Routes — require client role. All wrapped in ClientLayout
          which provides the persistent sidebar + Outlet. */}
      <Route element={<RouteGuard allowedRoles={["client"]} fallbackPath="/"><ClientLayout /></RouteGuard>}>
        <Route path="/client-portal" element={<ClientPortal />} />
        <Route path="/client/products" element={<ClientProducts />} />
        <Route path="/client/invoices" element={<ClientInvoices />} />
        <Route path="/client/invoices/:invoiceId" element={<InvoiceDetail />} />
        <Route path="/client/contracts" element={<ClientContracts />} />
        <Route path="/client/messages" element={<ClientMessages />} />
        <Route path="/client/messages/:threadId" element={<ClientThreadDetail />} />
        <Route path="/client/deliverables" element={<ClientDeliverables />} />
        <Route path="/client/activity" element={<ClientActivity />} />
        <Route path="/client/settings" element={<ClientSettings />} />
        {/* Existing client routes — kept inside ClientLayout so they share the sidebar. */}
        <Route path="/client-onboarding" element={<ClientOnboardingWizard />} />
        <Route path="/client/onboarding-form" element={<ClientOnboardingFormFull />} />
        <Route path="/client/reports" element={<ClientReports />} />
        <Route path="/client/uploads" element={<ClientUploads />} />
        <Route path="/client/profile" element={<ClientProfile />} />
        <Route path="/client/project-status" element={<ClientProjectStatus />} />
        <Route path="/client/order-addons" element={<ClientOrderAddOns />} />
        <Route path="/client/order-domain" element={<ClientOrderDomain />} />
        <Route path="/client/order-email" element={<ClientOrderEmail />} />
        <Route path="/client/orders" element={<ClientOrders />} />
        <Route path="/client/subscription" element={<ClientSubscription />} />
        <Route path="/client/billing-update" element={<ClientBillingUpdate />} />
      </Route>
      
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-cancelled" element={<PaymentCancelled />} />
      <Route path="/payfast-test" element={<PayfastTest />} />
      <Route path="/checkout/:packageId" element={<Checkout />} />
      <Route path="/portal/checkout/:packageId" element={<PortalCheckout />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Auth routes */}
      <Route path="/login" element={<SignIn />} />
      <Route path="/sign-in" element={<Navigate to="/login" replace />} />
      <Route path="/signin" element={<Navigate to="/login" replace />} />
      <Route path="/Login" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />
      <Route path="/sign-up" element={<Navigate to="/register" replace />} />
      <Route path="/verify-otp" element={<VerifyOTP />} />
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