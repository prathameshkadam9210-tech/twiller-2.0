"use client";

import React, { useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await axiosInstance.post("/forgot-password", { identifier });
      setMessage(res.data?.message || "New password sent to your registered contact.");
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black border-gray-800">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email or phone number</Label>
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="bg-transparent border-gray-700 text-white" />
            </div>
            {message && <p className="text-sm text-gray-300">{message}</p>}
            <Button className="w-full bg-blue-500 hover:bg-blue-600" disabled={loading || !identifier}>
              Send generated password
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
