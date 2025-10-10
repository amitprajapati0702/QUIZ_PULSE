// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  isAdmin: { type: Boolean, default: false },
  avatarUrl: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.statics.createFromPassword = async function (email, plainPassword, name) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);
  return this.create({ email, passwordHash: hash, name });
};

module.exports = mongoose.model("User", UserSchema);
