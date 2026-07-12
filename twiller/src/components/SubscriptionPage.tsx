"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { CreditCard, Sparkles } from "lucide-react";
import { Language, translate } from "@/lib/i18n";

const plans = [
  { id: "Free", price: "Rs. 0 / month", limit: 1 },
  { id: "Bronze", price: "Rs. 100 / month", limit: 3 },
  { id: "Silver", price: "Rs. 300 / month", limit: 5 },
  { id: "Gold", price: "Rs. 1000 / month", limit: -1 },
];

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function SubscriptionPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const currentPlan = user?.subscription;
  const lang: Language = (user?.language as Language) || "en";

  useEffect(() => {
    if (document.getElementById("razorpay-checkout")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const verifyPayment = async (payload: any) => {
    await axiosInstance.post("/subscription/verify-payment", payload);
    await refreshUser();
    setMessage(translate(lang, "subscriptionSuccess"));
  };

  const subscribe = async (plan: string) => {
    if (!user?.email) return;
    setLoading(true);
    setMessage("");
    try {
      const orderRes = await axiosInstance.post("/subscription/purchase", { email: user.email, plan });
      if (plan === "Free") {
        await refreshUser();
        setMessage(translate(lang, "freePlanActivated"));
        return;
      }
      const order = orderRes.data;
      if (!window.Razorpay || !order.key) {
        throw new Error("Razorpay checkout is not ready. Please try again shortly.");
      }
      const checkout = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "Twiller",
        description: `${plan} monthly subscription`,
        order_id: order.orderId,
        handler: (response: any) =>
          verifyPayment({
            email: user.email,
            plan,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        prefill: { email: user.email, name: user.displayName },
      });
      checkout.open();
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Subscription failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{translate(lang, "subscription")}</h1>
          <p className="text-gray-400">{translate(lang, "paymentsWindow")}</p>
        </div>
        <Sparkles className="h-7 w-7 text-blue-400" />
      </div>

      {message && (
        <Card className="bg-gray-900 border-gray-800 mb-4">
          <CardContent className="text-gray-200">{message}</CardContent>
        </Card>
      )}

      <Card className="bg-gray-900 border-gray-800 mb-6">
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <CreditCard className="h-6 w-6 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">{translate(lang, "currentSubscription")}</h2>
              <p className="text-gray-400">{currentPlan?.plan || translate(lang, "freePlan")}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-300">
            <p><span className="font-semibold text-white">{translate(lang, "status")}:</span> {currentPlan?.status || translate(lang, "inactive")}</p>
            <p><span className="font-semibold text-white">{translate(lang, "expires")}:</span> {currentPlan?.expiresAt ? new Date(currentPlan.expiresAt).toLocaleDateString() : translate(lang, "notAvailable")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} className="bg-gray-900 border-gray-800">
            <CardContent>
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-white">{plan.id === "Free" ? translate(lang, "freePlan") : plan.id}</h3>
                <p className="text-gray-400 text-sm">{plan.price}</p>
              </div>
              <p className="text-gray-300 mb-6">{plan.limit === -1 ? translate(lang, "unlimitedTweets") : translate(lang, "tweetLimit", { count: plan.limit })}</p>
              <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" disabled={loading || plan.id === currentPlan?.plan} onClick={() => subscribe(plan.id)}>
                {plan.id === currentPlan?.plan ? translate(lang, "currentPlan") : translate(lang, "choosePlan")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
