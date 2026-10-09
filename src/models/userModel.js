const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['reporter', 'editor'], default: 'reporter', required: true },
}, { timestamps: true, versionKey: false });

userSchema.set('toJSON', {
  virtuals: true,
  transform(_document, value) {
    delete value._id;
    delete value.passwordHash;
    return value;
  },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const DEMO_ACCOUNTS = [
  { name: 'Dana Cohen', email: 'reporter1@example.com', role: 'reporter' },
  { name: 'Omer Levi', email: 'reporter2@example.com', role: 'reporter' },
  { name: 'Maya Barak', email: 'reporter3@example.com', role: 'reporter' },
  { name: 'Noam Shapira', email: 'reporter4@example.com', role: 'reporter' },
  { name: 'Editor Account', email: 'editor1@example.com', role: 'editor' },
];
const DEMO_PASSWORD = 'DemoPass123!';

async function seedDemoUsersIfEmpty() {
  if (await User.exists({})) return User.find({}).lean();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const created = await User.insertMany(
    DEMO_ACCOUNTS.map((account) => ({ ...account, passwordHash })),
  );
  return created;
}

module.exports = { User, seedDemoUsersIfEmpty, DEMO_ACCOUNTS, DEMO_PASSWORD };