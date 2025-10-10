require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quizpulse');
  const email = process.env.DEV_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.DEV_ADMIN_PW || 'AdminPass123!';
  let user = await User.findOne({ email });
  if (user) {
    user.isAdmin = true;
    await user.save();
    console.log('Updated existing user to admin:', email);
    process.exit(0);
  }
  user = await User.createFromPassword(email, password, 'Admin');
  user.isAdmin = true;
  await user.save();
  console.log('Created admin user:', email, 'password:', password);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
