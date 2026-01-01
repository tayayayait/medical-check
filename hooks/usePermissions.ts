import { useMemo } from 'react';
import { Permission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_PERMISSIONS } from '../auth/permissions';

export const usePermissions = () => {
  const { user } = useAuth();

  const perms = useMemo(() => {
    if (!user) return [];
    return ROLE_PERMISSIONS[user.role] ?? [];
  }, [user]);

  const can = (perm: Permission) => perms.includes(perm);
  const canAny = (list: Permission[]) => list.some((perm) => perms.includes(perm));
  const canAll = (list: Permission[]) => list.every((perm) => perms.includes(perm));

  return { user, perms, can, canAny, canAll };
};
