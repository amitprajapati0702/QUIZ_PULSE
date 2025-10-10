const User = require('../models/user');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const u = user.toObject();
    if (u.avatarUrl && u.avatarUrl.startsWith('/')) {
      const base = `${req.protocol}://${req.get('host')}`;
      u.avatarUrl = `${base}${u.avatarUrl}`;
    }
  // include isAdmin explicitly (default false if missing)
  res.json({ ...u, isAdmin: !!u.isAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (typeof name === 'string') user.name = name.trim();
    await user.save();
    let avatar = user.avatarUrl;
    if (avatar && avatar.startsWith('/')) {
      const base = `${req.protocol}://${req.get('host')}`;
      avatar = `${base}${avatar}`;
    }
  res.json({ ok: true, user: { email: user.email, name: user.name, avatarUrl: avatar, isAdmin: !!user.isAdmin } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const rel = `/uploads/${req.file.filename}`;
    user.avatarUrl = rel;
    await user.save();
    const base = `${req.protocol}://${req.get('host')}`;
    res.json({ ok: true, avatarUrl: `${base}${rel}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
