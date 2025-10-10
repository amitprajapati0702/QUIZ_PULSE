const User = require('../models/user');
const { createAccessToken, createRefreshToken, verifyRefreshToken, REFRESH_EXPIRES } = require('../utils/tokens');

function parseCookieMaxAge(str) {
  if (!str) return 30*24*60*60*1000;
  if (str.endsWith('d')) return parseInt(str,10)*24*60*60*1000;
  if (str.endsWith('s')) return parseInt(str,10)*1000;
  return 30*24*60*60*1000;
}

const cookieOptions = {
  httpOnly: true,
  secure: (process.env.COOKIE_SECURE === 'true') || (process.env.NODE_ENV === 'production'),
  sameSite: 'lax',
  path: '/api/auth/refresh',
  maxAge: parseCookieMaxAge(REFRESH_EXPIRES)
};

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email & password required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });
    const user = await User.createFromPassword(email, password, name);
    res.status(201).json({ id: user._id, email: user.email, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email & password required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const accessToken = createAccessToken({ userId: user._id.toString(), email: user.email });
    const { token: refreshToken } = createRefreshToken({ userId: user._id.toString() });
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.json({ accessToken, expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '300s' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token' });
    let payload;
    try { payload = verifyRefreshToken(token); } catch (e) { return res.status(401).json({ message: 'Invalid refresh token' }); }
    const accessToken = createAccessToken({ userId: payload.userId });
    const { token: newRefreshToken } = createRefreshToken({ userId: payload.userId });
    res.cookie('refreshToken', newRefreshToken, cookieOptions);
    res.json({ accessToken, expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '300s' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  try {
    res.clearCookie('refreshToken', cookieOptions);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
