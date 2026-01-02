import React, { createContext, useContext, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { User, Role, AnalysisResult, Permission, Metrics } from './types';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewAnalysis } from './pages/NewAnalysis';
import { AnalysisDetail } from './pages/AnalysisDetail';
import { History } from './pages/History';
import { AdminSettings } from './pages/AdminSettings';
import { Layout } from './components/Layout';
import { hasPermission } from './auth/permissions';
import { AuthContext, useAuth } from './contexts/AuthContext';
import { submitAnalysis as submitAnalysisApi } from './services/analysisService';

// --- Data Context ---
interface GlobalDataContextType {
  history: AnalysisResult[];
  metrics: Metrics;
  isLoading: boolean;
  submitAnalysis: (base64Image: string, adName: string) => Promise<AnalysisResult>;
}
const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (!context) throw new Error('useGlobalData must be used within GlobalDataProvider');
  return context;
};

const computeMetrics = (items: AnalysisResult[]): Metrics => {
  const counts = items.reduce(
    (acc, item) => {
      acc[item.riskLevel] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  return {
    totalAnalyses: items.length,
    highRiskCount: counts.high,
    mediumRiskCount: counts.medium,
    lowRiskCount: counts.low,
    riskDistribution: [
      { name: 'High', value: counts.high, color: '#E53935' },
      { name: 'Medium', value: counts.medium, color: '#FB8C00' },
      { name: 'Low', value: counts.low, color: '#43A047' }
    ]
  };
};

// --- Protected Route Component ---
const ProtectedRoute = ({ children, requiredRole, requiredPerm }: { children?: React.ReactNode, requiredRole?: Role, requiredPerm?: Permission }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/dashboard" replace />;
  if (requiredPerm && !hasPermission(user, requiredPerm)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const BYPASS_LOGIN = true;
const DEFAULT_ROLE: Role = 'reviewer';

const createUserForRole = (role: Role): User => ({
  email: role === 'admin' ? 'admin@medai.com' : 'reviewer@medai.com',
  role,
  name: role === 'admin' ? 'Admin' : 'Reviewer'
});

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const storedUser = localStorage.getItem('medai_user');
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser) as User;
  } catch {
    return null;
  }
};

const getInitialUser = (): User | null => {
  const storedUser = getStoredUser();
  if (storedUser) return storedUser;
  if (!BYPASS_LOGIN) return null;
  const defaultUser = createUserForRole(DEFAULT_ROLE);
  if (typeof window !== 'undefined') {
    localStorage.setItem('medai_user', JSON.stringify(defaultUser));
  }
  return defaultUser;
};

// --- App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(getInitialUser);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(() => computeMetrics([]));
  const isLoading = false;

  const login = (role: Role) => {
    const newUser = createUserForRole(role);
    setUser(newUser);
    localStorage.setItem('medai_user', JSON.stringify(newUser));
  };

  const logout = () => {
    if (BYPASS_LOGIN) {
      const newUser = createUserForRole(DEFAULT_ROLE);
      setUser(newUser);
      localStorage.setItem('medai_user', JSON.stringify(newUser));
      return;
    }
    setUser(null);
    localStorage.removeItem('medai_user');
  };

  const submitAnalysis = async (base64Image: string, adName: string) => {
    const result = await submitAnalysisApi(base64Image, adName);
    const withImage = { ...result, imageUrl: base64Image };
    setHistory((prev) => {
      const next = [withImage, ...prev];
      setMetrics(computeMetrics(next));
      return next;
    });
    return withImage;
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      <GlobalDataContext.Provider value={{ history, metrics, isLoading, submitAnalysis }}>
        <HashRouter>
          <Routes>
            <Route path="/login" element={BYPASS_LOGIN ? <Navigate to="/dashboard" replace /> : <Login />} />
            
            {/* Protected Routes wrapped in Layout */}
            <Route element={
              <ProtectedRoute>
                <Layout>
                  <Outlet />
                </Layout>
              </ProtectedRoute>
            }>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={
                <ProtectedRoute requiredPerm="analysis.history.read">
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/analysis/new" element={
                <ProtectedRoute requiredPerm="analysis.create">
                  <NewAnalysis />
                </ProtectedRoute>
              } />
              <Route path="/analysis/history" element={
                <ProtectedRoute requiredPerm="analysis.history.read">
                  <History />
                </ProtectedRoute>
              } />
              <Route path="/analysis/:id" element={
                <ProtectedRoute requiredPerm="analysis.read">
                  <AnalysisDetail />
                </ProtectedRoute>
              } />
              
              <Route path="/admin" element={
                <ProtectedRoute requiredPerm="admin.settings.manage">
                  <AdminSettings />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to={BYPASS_LOGIN ? "/dashboard" : "/login"} replace />} />
          </Routes>
        </HashRouter>
      </GlobalDataContext.Provider>
    </AuthContext.Provider>
  );
}
