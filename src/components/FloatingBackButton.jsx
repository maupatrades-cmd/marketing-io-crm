import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// Paths where a back arrow makes no sense — root dashboards, auth flows,
// and public/payment-confirmation screens.
const HIDE_ON_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/verify-otp",
  "/forgot-password",
  "/reset-password",
  "/staff",
  "/client-portal",
  "/onboarding-form",
  "/build-summary",
  "/payment-success",
  "/payment-cancelled",
  "/unsubscribe",
]);

const HIDE_ON_PREFIXES = [
  "/contract-sign",
  "/client-onboarding",
  "/onboarding-form",
];

/**
 * FloatingBackButton — single source of truth for the back arrow across the
 * whole CRM. Mounted once in App.jsx so every authenticated route inherits
 * it; AppLayout's old in-header back arrow has been removed in favour of
 * this so we don't render two of them on layout pages.
 *
 * Position:
 *   • mobile: top-3 left-3
 *   • lg+:    top-3 left-[244px] — clears the 224px AppLayout sidebar.
 *
 * Hides on:
 *   • root paths and auth/public flows (HIDE_ON_PATHS)
 *   • known public path prefixes (HIDE_ON_PREFIXES)
 *   • when there's no browser history to go back to and the user isn't
 *     signed in (e.g. they bookmarked a deep page on a public flow)
 */
export default function FloatingBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // No back button before the user is authenticated.
  if (!user) return null;

  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (HIDE_ON_PATHS.has(path)) return null;
  if (HIDE_ON_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;

  const canGoBack = typeof window === "undefined" || window.history.length > 1;

  const onClick = () => {
    if (canGoBack) {
      navigate(-1);
    } else {
      // Fallback: send the user to the most natural home for their role.
      const role = user?.role;
      if (role === "client") navigate("/client-portal");
      else if (role === "owner") navigate("/");
      else navigate("/staff");
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title="Go back"
      aria-label="Go back"
      className="fixed top-3 left-3 lg:left-[244px] z-50 inline-flex items-center justify-center w-9 h-9 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
      style={{
        background: "rgba(10,10,20,0.65)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
