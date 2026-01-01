const ROLE_PERMISSIONS = {
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

export const getUserFromRequest = (req) => {
  const role = req.header('x-user-role');
  const email = req.header('x-user-email');
  if (!role || !email) return null;
  return { role, email };
};

export const requireAuth = (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
};

export const requirePermission = (permission) => (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const allowed = ROLE_PERMISSIONS[user.role]?.includes(permission);
  if (!allowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.user = user;
  next();
};
