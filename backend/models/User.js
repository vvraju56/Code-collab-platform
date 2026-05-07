const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: ""
  },
  cursorColor: {
    type: String,
    default: () => {
      const colors = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#85C1E9"];
      return colors[Math.floor(Math.random() * colors.length)];
    }
  },
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
  ,
  openai: {
    encryptedApiKey: { type: String, default: "" },
    keyVersion: { type: Number, default: 1 },
    last4: { type: String, default: "" },
    createdAt: { type: Date }
  },
  aiKeys: [{
    keyType: { type: String, default: "openai" },
    encryptedApiKey: { type: String },
    last4: { type: String },
    label: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  github: {
    encryptedAccessToken: { type: String, default: "" },
    keyVersion: { type: Number, default: 1 },
    username: { type: String, default: "" },
    createdAt: { type: Date }
  },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String,
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    createdAt: { type: Date, default: Date.now }
  }],
  sentFriendRequests: [{
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
