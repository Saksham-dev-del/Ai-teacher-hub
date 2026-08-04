const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'teacher' },
  tokenVersion: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null },
  lastLoginIpHash: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  primaryDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  departmentTags: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));
  this.passwordChangedAt = new Date();
  this.tokenVersion = Number(this.tokenVersion || 0) + 1;
};

userSchema.methods.checkPassword = async function checkPassword(password) {
  return bcrypt.compare(String(password || ''), this.passwordHash);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    primaryDepartment: this.primaryDepartment
  };
};

module.exports = mongoose.model('User', userSchema);
