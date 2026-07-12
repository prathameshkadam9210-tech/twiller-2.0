"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "./ui/card";
import { Bell } from "lucide-react";
import { Language, translate } from "@/lib/i18n";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const lang: Language = (user?.language as Language) || "en";

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/notifications", {
          params: { email: user.email },
        });
        setNotifications(res.data || []);
        if (res.data?.some((notification: any) => !notification.read)) {
          await axiosInstance.patch("/notifications/read", { email: user.email });
          setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
          window.dispatchEvent(new Event("notifications-read"));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [user]);

  return (
    <div className="min-h-screen p-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {translate(lang, "notifications")}
          </h1>
          <p className="text-gray-400">
            {translate(lang, "yourNotifications")}
          </p>
        </div>
        <Bell className="h-7 w-7 text-blue-400" />
      </div>

      {loading ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="text-gray-400">Loading...</CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="text-gray-400">
            {translate(lang, "noNotifications")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.createdAt} className="bg-gray-900 border-gray-800">
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">{notification.title === "New like" ? translate(lang, "newLike") : notification.title}</h3>
                  <span className="text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-300">{notification.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
