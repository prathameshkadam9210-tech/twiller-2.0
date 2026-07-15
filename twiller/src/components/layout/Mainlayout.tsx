"use client";
import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import LoadingSpinner from "../loading-spinner";
import Sidebar from "./Sidebar";
import RightSidebar from "./Rightsidebar";
import ProfilePage from "../ProfilePage";
import NotificationsPage from "../NotificationsPage";
import LoginHistoryPage from "../LoginHistoryPage";
import SubscriptionPage from "../SubscriptionPage";

const Mainlayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState("home");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-4xl font-bold mb-4">X</div>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // If user is not logged in → show children (like login/signup pages)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen justify-center bg-black text-white">
      <aside className="sticky top-0 h-screen w-20 shrink-0 self-start sm:w-24 md:w-64">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      </aside>
      <main className="min-w-0 max-w-2xl flex-1 border-x border-gray-800">
        {currentPage === "profile" ? (
          <ProfilePage />
        ) : currentPage === "notifications" ? (
          <NotificationsPage />
        ) : currentPage === "subscription" ? (
          <SubscriptionPage />
        ) : currentPage === "loginHistory" ? (
          <LoginHistoryPage />
        ) : (
          children
        )}
      </main>
      <aside className="sticky top-0 hidden h-screen w-80 shrink-0 self-start overflow-y-auto lg:block">
        <RightSidebar />
      </aside>
    </div>
  );
};

export default Mainlayout;
