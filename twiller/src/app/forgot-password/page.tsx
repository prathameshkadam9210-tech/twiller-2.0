"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSavedLanguage, Language, translate } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const [lang, setLang] = useState<Language>("en");
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLang(getSavedLanguage());
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await axiosInstance.post("/forgot-password", { identifier });
      setMessage(translate(lang, "newPasswordSent"));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error;
      setMessage(
        errorMessage?.includes("one time per day")
          ? translate(lang, "dailyResetLimit")
          : errorMessage || translate(lang, "passwordResetFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black border-gray-800">
        <CardHeader>
          <CardTitle>{translate(lang, "forgotPasswordTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>{translate(lang, "emailOrPhoneLabel")}</Label>
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="bg-transparent border-gray-700 text-white" />
            </div>
            {message && <p className="text-sm text-gray-300">{message}</p>}
            <Button className="w-full bg-blue-500 hover:bg-blue-600" disabled={loading || !identifier}>
              {loading ? translate(lang, "loading") : translate(lang, "sendGeneratedPassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
