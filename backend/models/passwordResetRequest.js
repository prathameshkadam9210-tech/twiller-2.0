import mongoose from "mongoose";

const PasswordResetRequestSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  identifier: { type: String, required: true },
  channel: { type: String, enum: ["email", "sms"], required: true },
  requestedOn: { type: String, required: true },
  generatedPasswordHash: { type: String, required: true },
  delivered: { type: Boolean, default: false },
}, { timestamps: true });

PasswordResetRequestSchema.index({ user: 1, requestedOn: 1 }, { unique: true });

export default mongoose.model("PasswordResetRequest", PasswordResetRequestSchema);
