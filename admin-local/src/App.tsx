import React, { useState } from 'react';
import { logout as apiLogout } from './api';
import AdminShell, { type AdminTab } from './components/AdminShell';
import { useAdminAuth } from './hooks/useAdminAuth';
import { useAdminTenants } from './hooks/useAdminTenants';
import Login from './pages/Login';
import Matches from './pages/Matches';
import Tournament from './pages/Tournament';

const App: React.FC = () => {
  const { authReady, isAuthenticated, login, logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('matches');
  const tenant = useAdminTenants(isAuthenticated);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onSuccess={login} />;
  }

  const activeLabel = tenant.isAllTenants
    ? 'All apps'
    : tenant.activeTenant?.label;

  return (
    <AdminShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tenants={tenant.tenants}
      selectedTenantId={tenant.selectedTenantId}
      onTenantChange={(id) => {
        tenant.handleTenantChange(id);
        tenant.setError('');
      }}
      tenantsLoading={tenant.tenantsLoading}
      supportsAllTenants={tenant.supportsAllTenants}
      onLogout={() => {
        void apiLogout().finally(logout);
      }}
    >
      {tenant.error && (
        <div className="mx-auto max-w-lg px-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {tenant.error}
        </div>
      )}

      {activeTab === 'matches' ? (
        <Matches
          selectedTenantId={tenant.selectedTenantId}
          isAllTenants={tenant.isAllTenants}
          activeTenant={tenant.activeTenant}
          tenants={tenant.tenants}
          tenantsLoading={tenant.tenantsLoading}
          onError={tenant.setError}
        />
      ) : (
        <Tournament
          selectedTenantId={tenant.selectedTenantId}
          isAllTenants={tenant.isAllTenants}
          activeTenantLabel={activeLabel}
        />
      )}
    </AdminShell>
  );
};

export default App;
