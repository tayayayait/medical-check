import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, History, Settings, LogOut, Menu, UserCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types';
import { cn } from './UIComponents';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { can, canAny } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors mb-1",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-text-secondary hover:bg-gray-100 hover:text-text-primary"
    );

  const getPageTitle = (path: string) => {
    if (path.includes('dashboard')) return '대시보드';
    if (path.includes('analysis/new')) return '새 분석';
    if (path.includes('analysis/history')) return '분석 이력';
    if (path.includes('admin')) return '관리자 설정';
    if (path.includes('analysis/')) return '분석 상세';
    return '대시보드';
  };

  const adminPerms: Permission[] = [
    'admin.settings.manage',
    'admin.regulations.manage',
    'admin.users.manage'
  ];

  const coreItems: Array<{ to: string; label: string; icon: React.FC<{ size?: number }>; perm: Permission }> = [
    { to: '/dashboard', label: '대시보드', icon: LayoutDashboard, perm: 'analysis.history.read' },
    { to: '/analysis/new', label: '새 분석', icon: UploadCloud, perm: 'analysis.create' },
    { to: '/analysis/history', label: '분석 이력', icon: History, perm: 'analysis.history.read' }
  ];

  return (
    <div className="flex h-screen w-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-border flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <div className="w-6 h-6 bg-primary rounded mr-2" />
          <span className="font-bold text-lg text-text-primary tracking-tight">의료 광고 심의 AI</span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3">
          <div className="mb-2 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">핵심 기능</div>
          <nav>
            {coreItems.filter((item) => can(item.perm)).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} className={navItemClass}>
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {canAny(adminPerms) && (
            <>
              <div className="mt-8 mb-2 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">관리자</div>
              <nav>
                {can('admin.settings.manage') && (
                  <NavLink to="/admin" className={navItemClass}>
                    <Settings size={18} />
                    설정
                  </NavLink>
                )}
              </nav>
            </>
          )}
        </div>

        <div className="p-4 border-t border-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-risk-high hover:bg-risk-high/10 w-full transition-colors">
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 flex-shrink-0">
          <h1 className="text-xl font-semibold text-text-primary capitalize">
            {getPageTitle(location.pathname)}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <UserCircle className="text-text-secondary" size={20} />
              <div className="flex flex-col text-right">
                <span className="text-sm font-medium text-text-primary">{user?.name}</span>
                <span className="text-xs text-text-secondary capitalize">
                  {user?.role === 'admin' ? '관리자' : '검토자'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-[1360px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
