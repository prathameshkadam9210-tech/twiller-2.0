import mongoose from "mongoose";

const SubscriptionSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  plan: { type: String, enum: ["Free", "Bronze", "Silver", "Gold"], required: true },
  tweetLimit: { type: Number, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
});

export default mongoose.model("Subscription", SubscriptionSchema);
