import React from 'react';
import TenantSelector from './TenantSelector';
import type { Tenant } from '../types';
import { ALL_TENANT_ID } from '../types';

export type AdminTab = 'matches' | 'tournament';

interface AdminShellProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  tenants: Tenant[];
  selectedTenantId: string;
  onTenantChange: (tenantId: string) => void;
  tenantsLoading?: boolean;
  supportsAllTenants?: boolean;
  children: React.ReactNode;
}

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'matches', label: 'Match scores' },
  { id: 'tournament', label: 'Tournament' },
];

const AdminShell: React.FC<AdminShellProps> = ({
  activeTab,
  onTabChange,
  tenants,
  selectedTenantId,
  onTenantChange,
  tenantsLoading,
  supportsAllTenants,
  children,
}) => {
  const selectedTenant =
    selectedTenantId === ALL_TENANT_ID
      ? null
      : tenants.find((t) => t.id === selectedTenantId) ?? null;

  const appLinks = selectedTenantId === ALL_TENANT_ID
    ? tenants.filter((t) => Boolean(t.url))
    : selectedTenant?.url
      ? [selectedTenant]
      : [];

  return (
    <div className="min-h-screen bg-slate-100">
    <header
      className="px-5 py-6 text-white"
      style={{
        background: 'linear-gradient(180deg, #0b1220 0%, #111827 45%, #0f172a 100%)',
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">
        Local only · no auth
      </p>
      <h1 className="font-display text-2xl font-extrabold">World Cup admin</h1>
      <p className="mt-1 text-sm text-slate-300">
        Match scoring and tournament prediction scoring for each prediction app.
      </p>

      <div className="mt-4 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === tab.id
                ? 'bg-white text-slate-900'
                : 'bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tenantsLoading ? (
        <p className="mt-4 text-xs text-slate-400">Loading apps…</p>
      ) : (
        <>
          <TenantSelector
            tenants={tenants}
            selectedId={selectedTenantId}
            onChange={onTenantChange}
            showAllOption={supportsAllTenants}
          />
          {appLinks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Open app
              </span>
              {appLinks.map((t) => (
                <a
                  key={t.id}
                  href={t.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline decoration-white/20 hover:decoration-white/40 underline-offset-4"
                >
                  {selectedTenantId === ALL_TENANT_ID ? t.label : t.url}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </header>
    {children}
    </div>
  );
};

export default AdminShell;
