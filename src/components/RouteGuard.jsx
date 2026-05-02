import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function RouteGuard({ children, allowedRoles, fallbackPath }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/sign-in" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackPath || "/"} replace />;
  }

  return children;
}