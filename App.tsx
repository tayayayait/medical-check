import React, { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { User, Role, AnalysisResult, Permission, Metrics, AnalysisStatus } from './types';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewAnalysis } from './pages/NewAnalysis';
import { AnalysisDetail } from './pages/AnalysisDetail';
import { History } from './pages/History';
import { AdminSettings } from './pages/AdminSettings';
import { Layout } from './components/Layout';
import { hasPermission } from './auth/permissions';
import { AuthContext, useAuth } from './contexts/AuthContext';
import { getMetrics, getAnalysisJob, listHistory, submitAnalysis } from './services/analysisService';

// --- Data Context ---
interface GlobalDataContextType {
  history: AnalysisResult[];
  metrics: Metrics;
  isLoading: boolean;
  addAnalysisResult: (result: AnalysisResult) => Promise<void>;
  submitAnalysis: (base64Image: string, adName: string) => Promise<{ jobId: string }>;
  pollAnalysisJob: (jobId: string) => Promise<{ status: AnalysisStatus; result?: AnalysisResult; error?: string }>;
  refreshHistory: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
}
const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (!context) throw new Error("useGlobalData must be used within GlobalDataProvider");
  return context;
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
  const [metrics, setMetrics] = useState<Metrics>({
    totalAnalyses: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    riskDistribution: [
      { name: '고위험', value: 0, color: '#E53935' },
      { name: '중위험', value: 0, color: '#FB8C00' },
      { name: '저위험', value: 0, color: '#43A047' },
    ]
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const [historyData, metricsData] = await Promise.all([listHistory(), getMetrics()]);
        setHistory(historyData);
        setMetrics(metricsData);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    void initData();
  }, []);

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

  const refreshHistory = async () => {
    const historyData = await listHistory();
    setHistory(historyData);
  };

  const refreshMetrics = async () => {
    const metricsData = await getMetrics();
    setMetrics(metricsData);
  };

  const addAnalysisResult = async (result: AnalysisResult) => {
    setHistory(prev => [result, ...prev]);
    await refreshMetrics();
  };

  const submitAnalysisWithStore = async (base64Image: string, adName: string) => {
    return submitAnalysis(base64Image, adName);
  };

  const pollAnalysisJob = async (jobId: string) => {
    const job = await getAnalysisJob(jobId);
    if (!job) {
      return { status: 'failed' as AnalysisStatus, error: '분석 작업을 찾을 수 없습니다.' };
    }
    if (job.status === 'done' && job.result) {
      setHistory(prev => (prev.some((item) => item.id === job.result?.id) ? prev : [job.result, ...prev]));
      await refreshMetrics();
    }
    return { status: job.status, result: job.result, error: job.error };
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      <GlobalDataContext.Provider value={{ history, metrics, isLoading, addAnalysisResult, submitAnalysis: submitAnalysisWithStore, pollAnalysisJob, refreshHistory, refreshMetrics }}>
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
