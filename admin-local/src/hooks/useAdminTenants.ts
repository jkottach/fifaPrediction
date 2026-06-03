import { useCallback, useEffect, useState } from 'react';
import { getTenants, restoreTenantFromStorage, setActiveTenantId } from '../api';
import { ALL_TENANT_ID } from '../types';
import type { Tenant } from '../types';

export function useAdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [supportsAllTenants, setSupportsAllTenants] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setTenantsLoading(true);
      try {
        const { tenants: list, defaultTenantId, supportsAllTenants: multi } = await getTenants();
        setTenants(list);
        setSupportsAllTenants(multi);
        const stored = restoreTenantFromStorage();
        const initial =
          stored === ALL_TENANT_ID || (stored && list.some((t) => t.id === stored))
            ? (stored ?? defaultTenantId)
            : defaultTenantId;
        setSelectedTenantId(initial);
        setActiveTenantId(initial);
        if (initial === ALL_TENANT_ID) {
          setActiveTenant({ id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' });
        } else {
          setActiveTenant(list.find((t) => t.id === initial) ?? null);
        }
      } catch {
        setError('Failed to load app list. Is the admin API running on port 5002?');
      } finally {
        setTenantsLoading(false);
      }
    })();
  }, []);

  const handleTenantChange = useCallback(
    (tenantId: string) => {
      setSelectedTenantId(tenantId);
      setActiveTenantId(tenantId);
      setActiveTenant(
        tenantId === ALL_TENANT_ID
          ? { id: ALL_TENANT_ID, label: 'All', dbName: 'all databases' }
          : tenants.find((t) => t.id === tenantId) ?? null
      );
    },
    [tenants]
  );

  return {
    tenants,
    selectedTenantId,
    activeTenant,
    tenantsLoading,
    supportsAllTenants,
    error,
    setError,
    handleTenantChange,
    isAllTenants: selectedTenantId === ALL_TENANT_ID,
  };
}
