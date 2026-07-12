import mongoose from "mongoose";

const OTPVerificationSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  purpose: {
    type: String,
    enum: ["login", "audio_upload", "language_change"],
    required: true,
  },
  target: { type: String, default: "" },
  channel: { type: String, enum: ["email", "sms"], required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  verifiedAt: { type: Date },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("OTPVerification", OTPVerificationSchema);
