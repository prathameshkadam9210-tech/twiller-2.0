import mongoose from "mongoose";

const LoginHistorySchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  method: { type: String, default: "password" },
  browser: { type: String, default: "" },
  operatingSystem: { type: String, default: "" },
  deviceType: { type: String, default: "" },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("LoginHistory", LoginHistorySchema);
