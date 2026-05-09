import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function RouteGuard({ children, allowedRoles, fallbackPath }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackPath || "/"} replace />;
  }

  return children;
}