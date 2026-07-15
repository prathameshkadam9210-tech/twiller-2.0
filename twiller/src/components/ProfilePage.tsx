"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  MoreHorizontal,
  Camera,
  Bell,
  Languages,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import TweetCard from "./TweetCard";
import { Card, CardContent } from "./ui/card";
import Editprofile from "./Editprofile";
import axiosInstance from "@/lib/axiosInstance";
import { Language, translate } from "@/lib/i18n";

interface Tweet {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    verified?: boolean;
  };
  content: string;
  timestamp: string;
  likes: number;
  retweets: number;
  comments: number;
  liked?: boolean;
  retweeted?: boolean;
  image?: string;
}
const tweets: Tweet[] = [
  {
    id: "1",
    author: {
      id: "1",
      username: "elonmusk",
      displayName: "Elon Musk",
      avatar:
        "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: true,
    },
    content:
      "Just had an amazing conversation about the future of AI. The possibilities are endless!",
    timestamp: "2h",
    likes: 1247,
    retweets: 324,
    comments: 89,
    liked: false,
    retweeted: false,
  },
  {
    id: "2",
    author: {
      id: "1",
      username: "sarahtech",
      displayName: "Sarah Johnson",
      avatar:
        "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: false,
    },
    content:
      "Working on some exciting new features for our app. Can't wait to share what we've been building! 🚀",
    timestamp: "4h",
    likes: 89,
    retweets: 23,
    comments: 12,
    liked: true,
    retweeted: false,
  },
  {
    id: "3",
    author: {
      id: "4",
      username: "designguru",
      displayName: "Alex Chen",
      avatar:
        "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: true,
    },
    content:
      "The new design system is finally complete! It took 6 months but the results are incredible. Clean, consistent, and accessible.",
    timestamp: "6h",
    likes: 456,
    retweets: 78,
    comments: 34,
    liked: false,
    retweeted: true,
    image:
      "https://images.pexels.com/photos/196645/pexels-photo-196645.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];
export default function ProfilePage() {
  const { user, refreshUser, requestLanguageOtp, setLanguage, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("posts");
  const [showEditModal, setShowEditModal] = useState(false);
  const [tweets, setTweets] = useState<any>([]);
  const [loading, setloading] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(user?.language || "en");
  const [languageOtp, setLanguageOtp] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const fetchTweets = async () => {
    try {
      setloading(true);
      const res = await axiosInstance.get("/post");
      setTweets(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setloading(false);
    }
  };
  useEffect(() => {
    fetchTweets();
  }, []);
  useEffect(() => {
    setSelectedLanguage(user?.language || "en");
  }, [user?.language]);

  if (!user) return null;
  const lang: Language = (user.language as Language) || "en";

  const updateNotificationPreference = async (enabled: boolean) => {
    await axiosInstance.patch("/notification-settings", { email: user.email, enabled });
    await refreshUser();
    setSettingsMessage(enabled ? translate(lang, "enableNotifications") : translate(lang, "disableNotifications"));
  };

  const sendLanguageOtp = async () => {
    try {
      const response = await requestLanguageOtp(selectedLanguage);
      setSettingsMessage(response?.data?.channel === "sms" ? "OTP sent to registered mobile number." : "OTP sent to registered email.");
    } catch (error: any) {
      setSettingsMessage(error.response?.data?.error || "Unable to send language OTP.");
    }
  };

  const verifyLanguageOtp = async () => {
    try {
      await setLanguage(selectedLanguage, languageOtp);
      setLanguageOtp("");
      setSettingsMessage(translate(lang, "language"));
    } catch (error: any) {
      setSettingsMessage(error.response?.data?.error || "Language OTP verification failed.");
    }
  };
  const uploadAndSaveProfileImage = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "avatar" | "coverPhoto"
  ) => {
    if (!event.target.files?.length || !user) return;
    const image = event.target.files[0];
    const formData = new FormData();
    formData.set("image", image);
    setPhotoSaving(true);
    setSettingsMessage("");
    try {
      const res = await axiosInstance.post("/upload/image", formData);
      const url = res.data?.imageUrl;
      if (!url) throw new Error("Image upload failed.");
      await updateProfile({
        displayName: user.displayName,
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        phone: user.phone || "",
        avatar: field === "avatar" ? url : user.avatar,
        coverPhoto: field === "coverPhoto" ? url : user.coverPhoto || "",
      });
      setSettingsMessage(field === "avatar" ? "Profile photo saved." : "Cover photo saved.");
    } catch (error: any) {
      setSettingsMessage(error.response?.data?.error || error.message || "Photo upload failed.");
    } finally {
      setPhotoSaving(false);
      event.target.value = "";
    }
  };
  // Filter tweets by current user
  const userTweets = tweets.filter((tweet: any) => tweet.author._id === user._id);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="flex items-center px-4 py-3 space-x-8">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{user.displayName}</h1>
            <p className="text-sm text-gray-400">{translate(lang, "postsCount", { count: userTweets.length })}</p>
          </div>
        </div>
      </div>

      {/* Cover Photo */}
      <div className="relative">
        <div
          className="h-48 relative"
          style={
            user.coverPhoto
              ? {
                  backgroundImage: `url(${user.coverPhoto})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!user.coverPhoto && (
            <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600" />
          )}
          <input
            type="file"
            accept="image/*"
            id="profileCoverUpload"
            className="hidden"
            onChange={(event) => uploadAndSaveProfileImage(event, "coverPhoto")}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70"
            disabled={photoSaving}
            onClick={() => document.getElementById("profileCoverUpload")?.click()}
          >
            <Camera className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Profile Picture */}
        <div className="absolute -bottom-16 left-4">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-black">
              <AvatarImage src={user.avatar} alt={user.displayName} />
              <AvatarFallback className="text-2xl">
                {user.displayName[0]}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              accept="image/*"
              id="profileAvatarUpload"
              className="hidden"
              onChange={(event) => uploadAndSaveProfileImage(event, "avatar")}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 p-2 rounded-full bg-black/70 hover:bg-black/90"
              disabled={photoSaving}
              onClick={() => document.getElementById("profileAvatarUpload")?.click()}
            >
              <Camera className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>

        {/* Edit Profile Button */}
        <div className="flex justify-end p-4">
          <Button
            variant="outline"
            className="border-gray-600 text-white bg-gray-950 font-semibold rounded-full px-6"
            onClick={() => setShowEditModal(true)}
          >
            {translate(lang, "editProfile")}
          </Button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 mt-12">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user.displayName}
            </h1>
            <p className="text-gray-400">@{user.username}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-400" />
          </Button>
        </div>

        {user.bio && (
          <p className="text-white mb-3 leading-relaxed">{user.bio}</p>
        )}

        <div className="flex items-center space-x-4 text-gray-400 text-sm mb-3">
          <div className="flex items-center space-x-1">
            <MapPin className="h-4 w-4" />
            <span>{user.location ? user.location : "Earth"}</span>
          </div>
          <div className="flex items-center space-x-1">
            <LinkIcon className="h-4 w-4" />
            <span className="text-blue-400">
              {user.website ? user.website : "example.com"}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>
              Joined{" "}
              {user.joinedDate &&
                new Date(user.joinedDate).toLocaleDateString("en-us", {
                  month: "long",
                  year: "numeric",
                })}
            </span>
          </div>
        </div>

        <Card className="bg-gray-950 border-gray-800 mt-4">
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Bell className="h-4 w-4 text-blue-400" />
                {translate(lang, "keywordNotifications")}
              </div>
              <Button
                size="sm"
                className="bg-blue-500 hover:bg-blue-600"
                onClick={() => updateNotificationPreference(!(user.keywordNotificationsEnabled !== false))}
              >
                {user.keywordNotificationsEnabled !== false ? translate(lang, "disableNotifications") : translate(lang, "enableNotifications")}
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Languages className="h-4 w-4 text-blue-400" />
                {translate(lang, "language")}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="h-10 min-w-0 w-full rounded-md border border-gray-700 bg-black px-3 text-white"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
                <option value="zh">Chinese</option>
                <option value="fr">French</option>
              </select>
              <Button type="button" size="sm" variant="outline" className="w-full border-gray-600 bg-black text-white" onClick={sendLanguageOtp}>
                {translate(lang, "requestOtp")}
              </Button>
              <input
                value={languageOtp}
                onChange={(e) => setLanguageOtp(e.target.value)}
                placeholder={translate(lang, "otp")}
                className="h-10 min-w-0 w-full rounded-md border border-gray-700 bg-black px-3 text-white"
              />
              <Button type="button" size="sm" className="w-full bg-blue-500 hover:bg-blue-600" onClick={verifyLanguageOtp} disabled={!languageOtp}>
                {translate(lang, "verifyOtp")}
              </Button>
              </div>
            </div>
            {settingsMessage && <p className="text-sm text-gray-300">{settingsMessage}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-transparent border-b border-gray-800 rounded-none h-auto">
          <TabsTrigger
            value="posts"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {translate(lang, "posts")}
          </TabsTrigger>
          <TabsTrigger
            value="replies"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {translate(lang, "replies")}
          </TabsTrigger>
          <TabsTrigger
            value="highlights"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {translate(lang, "highlights")}
          </TabsTrigger>
          <TabsTrigger
            value="articles"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {translate(lang, "articles")}
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
          >
            {translate(lang, "media")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          <div className="divide-y divide-gray-800">
            { loading ? (
              <Card className="bg-black border-none">
                <CardContent className="py-12 text-center">
                  <div className="text-gray-400">
                    <h3 className="text-2xl font-bold mb-2">
                      {translate(lang, "noPosts")}
                    </h3>
                    <p>{translate(lang, "postsAppearHere")}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              userTweets.map((tweet:any) => (
                <TweetCard key={tweet._id} tweet={tweet} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  {translate(lang, "noReplies")}
                </h3>
                <p>{translate(lang, "repliesAppearHere")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highlights" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  {translate(lang, "mediaEmptyTitle")}
                </h3>
                <p>{translate(lang, "mediaAppearHere")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  {translate(lang, "noArticles")}
                </h3>
                <p>{translate(lang, "articlesAppearHere")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  {translate(lang, "mediaEmptyTitle")}
                </h3>
                <p>{translate(lang, "mediaAppearHere")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Editprofile
        isopen={showEditModal}
        onclose={() => setShowEditModal(false)}
      />
    </div>
  );
}
