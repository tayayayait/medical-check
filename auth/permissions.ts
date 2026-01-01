import { Permission, Role, User } from '../types';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  reviewer: [
    'analysis.create',
    'analysis.read',
    'analysis.feedback.write',
    'analysis.history.read'
  ],
  admin: [
    'analysis.create',
    'analysis.read',
    'analysis.feedback.write',
    'analysis.history.read',
    'admin.users.manage',
    'admin.regulations.manage',
    'admin.settings.manage'
  ]
};

export const hasPermission = (user: User | null, perm: Permission): boolean => {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(perm) ?? false;
};
