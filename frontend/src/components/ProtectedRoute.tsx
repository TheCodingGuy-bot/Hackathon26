import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface Props {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export default function ProtectedRoute({ children, allowedRole }: Props) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    const redirect = user?.role === 'DEVELOPER' ? '/developer' : 
                     user?.role === 'JUDGE' ? '/judge' : '/client';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}
