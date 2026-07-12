import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  coverPhoto: { type: String, default: "" },
  email: { type: String, required: true, unique: true },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  phone: { type: String, default: "" },
  passwordHash: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now() },
  language: { type: String, default: "en" },
  keywordNotificationsEnabled: { type: Boolean, default: true },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  subscription: {
    plan: { type: String, default: "Free" },
    status: { type: String, default: "inactive" },
    startedAt: { type: Date },
    expiresAt: { type: Date },
  },
  loginHistory: [
    {
      method: { type: String, default: "password" },
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      browser: { type: String, default: "" },
      operatingSystem: { type: String, default: "" },
      deviceType: { type: String, default: "" },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  notifications: [
    {
      title: { type: String, default: "" },
      message: { type: String, default: "" },
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

export default mongoose.model("User", UserSchema);
