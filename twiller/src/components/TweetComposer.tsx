import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Image as ImageIcon, Smile, Calendar, MapPin, BarChart3, Globe, Mic } from "lucide-react";
import { Separator } from "./ui/separator";
import axiosInstance from "@/lib/axiosInstance";
import { Language, translate } from "@/lib/i18n";
const TweetComposer = ({ onTweetPosted }: any) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageurl, setimageurl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioName, setAudioName] = useState("");
  const [audioOtp, setAudioOtp] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const maxLength = 200;
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if(!user || (!content.trim() && !audioUrl))return
    setIsLoading(true)
    setStatusMessage("")
    try {
      const tweetdata={
        author:user?._id,
        content,
        image:imageurl,
        audio:audioUrl,
      }
      const res=await axiosInstance.post('/post',tweetdata)
      onTweetPosted(res.data)
      setContent("")
      setimageurl("")
      setAudioUrl("")
      setAudioName("")
      setAudioFile(null)
      setAudioOtp("")
    } catch (error: any) {
      setStatusMessage(error.response?.data?.error || error.message || "Tweet could not be posted.")
    }finally{
      setIsLoading(false)
    }
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;
  if (!user) return null;
  const lang: Language = (user.language as Language) || "en";
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsLoading(true);
    const image = e.target.files[0];
    const formdataimg = new FormData();
    formdataimg.set("image", image);
    try {
      const res = await axiosInstance.post("/upload/image", formdataimg);
      const url = res.data?.imageUrl;
      if (url) {
        setimageurl(url);
      }
    } catch (error: any) {
      setStatusMessage(error.response?.data?.error || error.message || translate(lang, "imageUploadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    setStatusMessage("");
    if (selected.size > 100 * 1024 * 1024) {
      setStatusMessage(translate(lang, "audioSizeLimit"));
      return;
    }
    const objectUrl = URL.createObjectURL(selected);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = async () => {
      URL.revokeObjectURL(objectUrl);
      if (audio.duration > 300) {
        setStatusMessage(translate(lang, "audioDurationLimit"));
        return;
      }
      try {
        setIsLoading(true);
        await axiosInstance.post("/audio/request-otp", { email: user?.email });
        setAudioFile(selected);
        setAudioName(selected.name);
        setStatusMessage(translate(lang, "audioOtpSent"));
      } catch (error: any) {
        setStatusMessage(error.response?.data?.error || translate(lang, "audioOtpFailed"));
      } finally {
        setIsLoading(false);
      }
    };
    audio.src = objectUrl;
  };

  const verifyAndUploadAudio = async () => {
    if (!audioFile || !audioOtp || !user?.email) return;
    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("email", user.email);
    formData.append("otp", audioOtp);
    try {
      setIsLoading(true);
      const res = await axiosInstance.post("/audio/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAudioUrl(res.data.audioUrl);
      setStatusMessage(translate(lang, "audioAttached"));
    } catch (error: any) {
      setStatusMessage(error.response?.data?.error || translate(lang, "audioUploadFailed"));
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Card className="bg-black border-gray-800 border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        <div className="flex space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar} alt={user.displayName} />
            <AvatarFallback>{user.displayName[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <form onSubmit={handleSubmit}>
              <Textarea
                placeholder={translate(lang, "whatsHappening")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="bg-transparent border-none text-xl text-white placeholder-gray-500 resize-none min-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {statusMessage && (
                <div className="mb-3 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200">
                  {statusMessage}
                </div>
              )}
              {audioFile && !audioUrl && (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    value={audioOtp}
                    onChange={(e) => setAudioOtp(e.target.value)}
                    placeholder={translate(lang, "audioOtp")}
                    className="h-10 flex-1 rounded-md border border-gray-700 bg-transparent px-3 text-white"
                  />
                  <Button type="button" onClick={verifyAndUploadAudio} disabled={isLoading || !audioOtp}>
                    {translate(lang, "verify")}
                  </Button>
                </div>
              )}
              {audioName && (
                <p className="mb-3 text-sm text-gray-400">{audioUrl ? translate(lang, "attached") : translate(lang, "selected")}: {audioName}</p>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-4 text-blue-400">
                  <label
                    htmlFor="tweetImage"
                    className="p-2 rounded-full hover:bg-blue-900/20 cursor-pointer"
                  >
                    <ImageIcon className="h-5 w-5" />
                    <input
                      type="file"
                      accept="image/*"
                      id="tweetImage"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isLoading}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <label
                    htmlFor="audioUpload"
                    className="p-2 rounded-full hover:bg-blue-900/20 cursor-pointer"
                  >
                    <Mic className="h-5 w-5" />
                    <input
                      type="file"
                      accept="audio/*"
                      id="audioUpload"
                      className="hidden"
                      onChange={handleAudioUpload}
                      disabled={isLoading}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                  >
                    <Calendar className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20"
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-400 font-semibold">
                      {translate(lang, "everyoneCanReply")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {characterCount > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="relative w-8 h-8">
                          <svg className="w-8 h-8 transform -rotate-90">
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              className="text-gray-700"
                            />
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 14}`}
                              strokeDashoffset={`${
                                2 *
                                Math.PI *
                                14 *
                                (1 - characterCount / maxLength)
                              }`}
                              className={
                                isOverLimit
                                  ? "text-red-500"
                                  : isNearLimit
                                  ? "text-yellow-500"
                                  : "text-blue-500"
                              }
                            />
                          </svg>
                        </div>
                        {isNearLimit && (
                          <span
                            className={`text-sm ${
                              isOverLimit ? "text-red-500" : "text-yellow-500"
                            }`}
                          >
                            {maxLength - characterCount}
                          </span>
                        )}
                      </div>
                    )}
                    <Separator
                      orientation="vertical"
                      className="h-6 bg-gray-700"
                    />

                    <Button
                      type="submit"
                      disabled={(!content.trim() && !audioUrl) || isOverLimit|| isLoading}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-full px-6"
                    >
                      {translate(lang, "post")}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TweetComposer;
