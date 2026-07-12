"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail, User, X } from "lucide-react";
import LoadingSpinner from "./loading-spinner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { useAuth } from "@/context/AuthContext";
import TwitterLogo from "./Twitterlogo";
import { getSavedLanguage, translate } from "@/lib/i18n";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "signup" | "otp";
  initialEmail?: string;
}

export default function AuthModal({ isOpen, onClose, initialMode = "login", initialEmail = "" }: AuthModalProps) {
  const { login, signup, resetPassword, verifyLoginOtp, isLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "otp">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", username: "", displayName: "", otp: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const lang = getSavedLanguage();

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setErrors({});
    setSuccessMessage("");
    setFormData({ email: initialEmail, password: "", username: "", displayName: "", otp: "" });
  }, [initialEmail, initialMode, isOpen]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = mode === "forgot" ? translate(lang, "emailOrPhone") : translate(lang, "emailRequired");
    else if (mode !== "forgot" && !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = translate(lang, "invalidEmail");
    if (mode === "otp" && !formData.otp.trim()) newErrors.otp = translate(lang, "otpRequired");
    if (mode !== "forgot" && mode !== "otp") {
      if (!formData.password.trim()) newErrors.password = translate(lang, "passwordRequired");
      else if (formData.password.length < 6) newErrors.password = translate(lang, "passwordLength");
    }
    if (mode === "signup") {
      if (!formData.username.trim()) newErrors.username = translate(lang, "usernameRequired");
      else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) newErrors.username = translate(lang, "usernameRule");
      if (!formData.displayName.trim()) newErrors.displayName = translate(lang, "displayNameRequired");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isLoading) return;
    try {
      if (mode === "forgot") {
        await resetPassword(formData.email);
        setSuccessMessage(translate(lang, "sendPassword"));
        setErrors({});
        return;
      }
      if (mode === "otp") {
        await verifyLoginOtp(formData.email, formData.otp);
        window.sessionStorage.removeItem("twillerPendingLoginOtp");
        onClose();
        return;
      }
      if (mode === "login") await login(formData.email, formData.password);
      else await signup(formData.email, formData.password, formData.username, formData.displayName);
      setSuccessMessage(mode === "signup" ? translate(lang, "accountCreated") : translate(lang, "signedIn"));
      setErrors({});
      window.setTimeout(() => {
        onClose();
        setFormData({ email: "", password: "", username: "", displayName: "", otp: "" });
        setSuccessMessage("");
      }, 800);
    } catch (error: any) {
      if (error.message === "EMAIL_OTP_REQUIRED") {
        window.sessionStorage.setItem("twillerPendingLoginOtp", formData.email);
        setMode("otp");
        setSuccessMessage(translate(lang, "emailOtp"));
      } else {
        setErrors({ general: error.response?.data?.error || error.message || "Authentication failed. Please try again." });
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setErrors({});
    setSuccessMessage("");
    setFormData({ email: "", password: "", username: "", displayName: "", otp: "" });
  };

  const title = mode === "login" ? translate(lang, "signInToX") : mode === "signup" ? translate(lang, "createAccount") : mode === "otp" ? translate(lang, "emailOtp") : translate(lang, "forgotPassword");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-black border-gray-800 text-white">
        <CardHeader className="relative pb-6">
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 text-white hover:bg-gray-900" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <TwitterLogo size="xl" className="text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {errors.general && <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">{errors.general}</div>}
          {successMessage && <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-green-300 text-sm">{successMessage}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="displayName">{translate(lang, "displayName")}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input id="displayName" value={formData.displayName} onChange={(e) => handleInputChange("displayName", e.target.value)} className="pl-10 bg-transparent border-gray-600 text-white" />
                  </div>
                  {errors.displayName && <p className="text-red-400 text-sm">{errors.displayName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{translate(lang, "username")}</Label>
                  <Input id="username" value={formData.username} onChange={(e) => handleInputChange("username", e.target.value)} className="bg-transparent border-gray-600 text-white" />
                  {errors.username && <p className="text-red-400 text-sm">{errors.username}</p>}
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{mode === "forgot" ? translate(lang, "emailOrPhone") : translate(lang, "email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input id="email" type={mode === "forgot" ? "text" : "email"} value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className="pl-10 bg-transparent border-gray-600 text-white" disabled={mode === "otp"} />
              </div>
              {errors.email && <p className="text-red-400 text-sm">{errors.email}</p>}
            </div>
            {mode === "otp" ? (
              <div className="space-y-2">
                <Label htmlFor="otp">{translate(lang, "emailOtp")}</Label>
                <Input id="otp" value={formData.otp} onChange={(e) => handleInputChange("otp", e.target.value)} className="bg-transparent border-gray-600 text-white" />
                {errors.otp && <p className="text-red-400 text-sm">{errors.otp}</p>}
              </div>
            ) : mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">{translate(lang, "password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input id="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => handleInputChange("password", e.target.value)} className="pl-10 pr-10 bg-transparent border-gray-600 text-white" />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-red-400 text-sm">{errors.password}</p>}
              </div>
            )}
            <Button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full" disabled={isLoading}>
              {isLoading ? <LoadingSpinner size="sm" /> : mode === "otp" ? translate(lang, "verifyOtp") : mode === "forgot" ? translate(lang, "sendPassword") : mode === "login" ? translate(lang, "signIn") : translate(lang, "createAccount")}
            </Button>
          </form>
          <Separator className="bg-gray-700" />
          <div className="text-center text-gray-400">
            {mode === "forgot" || mode === "otp" ? (
              <Button variant="link" className="text-blue-400" onClick={() => { window.sessionStorage.removeItem("twillerPendingLoginOtp"); setMode("login"); }}>{translate(lang, "backToSignIn")}</Button>
            ) : (
              <>
                {mode === "login" ? translate(lang, "noAccount") : translate(lang, "alreadyAccount")}
                <Button variant="link" className="text-blue-400" onClick={switchMode}>{mode === "login" ? translate(lang, "signUp") : translate(lang, "signIn")}</Button>
              </>
            )}
          </div>
          {mode === "login" && <div className="text-center"><Button type="button" variant="link" className="text-blue-400" onClick={() => setMode("forgot")}>{translate(lang, "forgotPassword")}</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
