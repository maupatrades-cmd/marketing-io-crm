import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function RouteGuard({ children, allowedRoles, fallbackPath }) {
  // Auth bypass: always render children regardless of role
  return children;
}