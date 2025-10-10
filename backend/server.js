// backend/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");

const User = require("./models/user");
const Quiz = require("./models/quiz");
const QuizAttempt = require("./models/QuizAttempt");
const auth = require("./middleware/auth");
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  REFRESH_EXPIRES
} = require("./utils/tokens");

const app = express();

// Global error handlers to surface crashes during development
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION', err && err.stack ? err.stack : err);
  // don't exit immediately so we can see logs in this environment
});
process.on('unhandledRejection', (reason, p) => {
  console.error('UNHANDLED REJECTION at', p, 'reason:', reason);
  // don't exit immediately so we can see logs in this environment
});

// --- Middleware ---
app.use(express.json());
app.use(cookieParser());
app.use(helmet());


// Serve uploaded files
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer setup - only allow common image types
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  }
});

function imageFileFilter(req, file, cb) {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp)'), false);
}

const upload = multer({ storage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(cors({
  origin: FRONTEND,
  credentials: true
}));

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/quizpulse", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => { console.error(err); process.exit(1); });

// --- Cookie Helper ---
function parseCookieMaxAge(str) {
  if (!str) return 30*24*60*60*1000;
  if (str.endsWith("d")) return parseInt(str,10)*24*60*60*1000;
  if (str.endsWith("s")) return parseInt(str,10)*1000;
  return 30*24*60*60*1000;
}

const cookieOptions = {
  httpOnly: true,
  secure: (process.env.COOKIE_SECURE === "true") || (process.env.NODE_ENV === "production"),
  sameSite: "lax",
  path: "/api/auth/refresh",
  maxAge: parseCookieMaxAge(REFRESH_EXPIRES)
};

// Mount routers
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const quizzesRoutes = require('./routes/quizzesRoutes');
const attemptsRoutes = require('./routes/attemptsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const admin = require('./middleware/admin');

app.use('/api/auth', authRoutes);
// mount profile routes with upload middleware for avatar
app.use('/api/profile', auth, (req, res, next) => next());
app.use('/api/profile/avatar', auth, upload.single('avatar'));
app.use('/api/profile', profileRoutes);

app.use('/api/quizzes', auth, quizzesRoutes);
app.use('/api/attempts', auth, attemptsRoutes);
// Admin routes: requires auth + admin flag
app.use('/api/admin', auth, admin, adminRoutes);

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
