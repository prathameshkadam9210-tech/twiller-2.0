"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "./ui/card";
import { Clock } from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";
import { Language, translate } from "@/lib/i18n";

export default function LoginHistoryPage() {
  const { user } = useAuth();
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const lang: Language = (user?.language as Language) || "en";
  const localeByLanguage: Record<Language, string> = { en: "en-US", hi: "hi-IN", es: "es-ES", pt: "pt-BR", zh: "zh-CN", fr: "fr-FR" };

  useEffect(() => {
    if (!user?.email) return;
    axiosInstance
      .get("/login-history", { params: { email: user.email } })
      .then((res) => setLoginHistory(res.data || []))
      .catch(() => setLoginHistory(user.loginHistory || []));
  }, [user]);

  return (
    <div className="min-h-screen p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{translate(lang, "loginHistory")}</h1>
          <p className="text-gray-400">{translate(lang, "recentLogins")}</p>
        </div>
        <Clock className="h-7 w-7 text-blue-400" />
      </div>

      {loginHistory.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="text-gray-400">{translate(lang, "noLoginHistory")}</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {loginHistory
            .slice()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((entry, index) => (
              <Card key={`${entry.timestamp}-${index}`} className="bg-gray-900 border-gray-800">
                <CardContent>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-white font-semibold">{entry.method}</p>
                      <p className="text-gray-400 text-sm">
                        {entry.browser || translate(lang, "unknownBrowser")} {translate(lang, "on")} {entry.operatingSystem || translate(lang, "unknownOs")} ({entry.deviceType || translate(lang, "desktop")})
                      </p>
                      <p className="text-gray-500 text-xs">{entry.userAgent || translate(lang, "unknownDevice")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-300 text-sm">{entry.ip || translate(lang, "unknownIp")}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(entry.timestamp).toLocaleString(localeByLanguage[lang])}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
