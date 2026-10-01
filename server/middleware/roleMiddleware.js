export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        },
      });
    }

    const userRole = (req.user.role || 'driver').toUpperCase();
    const normalizedRoles = roles.map((r) => r.toUpperCase());

    // Only recognize 'DRIVER' and 'HOST' roles (no ADMIN, no BOTH)
    // A user can only have ONE role at a time
    const hasAccess = normalizedRoles.includes(userRole);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${roles.join(' or ')}`,
        },
      });
    }

    next();
  };
};
