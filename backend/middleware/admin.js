const User = require('../models/user');

async function adminMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.userId) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = adminMiddleware;
