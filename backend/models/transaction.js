import mongoose from "mongoose";

const TransactionSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
  plan: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  provider: { type: String, default: "razorpay" },
  providerOrderId: { type: String, default: "" },
  providerPaymentId: { type: String, default: "" },
  providerSignature: { type: String, default: "" },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  invoice: {
    number: { type: String, default: "" },
    purchaseDate: { type: Date },
    expiryDate: { type: Date },
    emailedAt: { type: Date },
  },
  raw: { type: Object, default: {} },
}, { timestamps: true });

export default mongoose.model("Transaction", TransactionSchema);
