import React from 'react';
import type { Tenant } from '../types';

interface TenantSelectorProps {
  tenants: Tenant[];
  selectedId: string;
  onChange: (tenantId: string) => void;
  disabled?: boolean;
}

const TenantSelector: React.FC<TenantSelectorProps> = ({
  tenants,
  selectedId,
  onChange,
  disabled,
}) => {
  if (tenants.length <= 1) return null;

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
        Prediction app / database
      </p>
      <div className="flex flex-wrap gap-2">
        {tenants.map((tenant) => {
          const active = tenant.id === selectedId;
          return (
            <button
              key={tenant.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tenant.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                active
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-white/10 text-slate-200 border border-white/20 hover:bg-white/15'
              }`}
              title={tenant.dbName}
            >
              {tenant.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Scoring updates only the selected database.
      </p>
    </div>
  );
};

export default TenantSelector;
