"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { auth } from "./firebase";
import axiosInstance from "../lib/axiosInstance";

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  coverPhoto?: string;
  bio?: string;
  joinedDate: string;
  email: string;
  website: string;
  location: string;
  language?: string;
  phone?: string;
  keywordNotificationsEnabled?: boolean;
  subscription?: {
    plan: string;
    status: string;
    startedAt?: string;
    expiresAt?: string;
  };
  loginHistory?: Array<{
    method: string;
    ip: string;
      userAgent: string;
      browser?: string;
      operatingSystem?: string;
      deviceType?: string;
      timestamp: string;
  }>;
  notifications?: Array<{ title: string; message: string; read: boolean; createdAt: string }>;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  verifyLoginOtp: (email: string, otp: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => Promise<void>;
  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
    coverPhoto?: string;
    language?: string;
    phone?: string;
  }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setLanguage: (language: string, otp?: string) => Promise<any>;
  requestLanguageOtp: (language: string) => Promise<any>;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  googlesignin: () => Promise<void>;
  applesignin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const suppressFirebaseSession = useRef(false);

  const saveUserSession = (userData: User) => {
    setUser(userData);
    localStorage.setItem("twitter-user", JSON.stringify(userData));
  };

  const clearUserSession = () => {
    setUser(null);
    localStorage.removeItem("twitter-user");
  };

  const getCachedUser = () => {
    try {
      const cached = localStorage.getItem("twitter-user");
      return cached ? (JSON.parse(cached) as User) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    // Check for existing session
    const unsubcribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (suppressFirebaseSession.current) return;
      if (firebaseUser?.email) {
        try {
          const res = await axiosInstance.get("/loggedinuser", {
            params: { email: firebaseUser.email },
          });

          if (res.data) saveUserSession(res.data);
        } catch (err) {
          console.log("Failed to fetch user:", err);
          const cachedUser = getCachedUser();
          if (cachedUser) setUser(cachedUser);
        }
      } else {
        const cachedUser = getCachedUser();
        if (cachedUser) setUser(cachedUser);
        else clearUserSession();
      }
      setIsLoading(false);
    });
    return () => unsubcribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase auth is not initialized");
    }
    setIsLoading(true);
    try {
      const prelogin = await axiosInstance.post("/auth/prelogin", { email, password });
      if (prelogin.data?.requiresOtp) {
        throw new Error("EMAIL_OTP_REQUIRED");
      }
      if (prelogin.data?.backendPasswordAccepted && prelogin.data?.user) {
        saveUserSession(prelogin.data.user);
        await axiosInstance.post("/login-event", { email, method: "password" });
        return;
      }
      const usercred = await signInWithEmailAndPassword(auth, email, password);
      const firebaseuser = usercred.user;
      const res = await axiosInstance.get("/loggedinuser", {
        params: { email: firebaseuser.email },
      });
      if (res.data) saveUserSession(res.data);
      await axiosInstance.post("/login-event", {
        email: firebaseuser.email,
        method: "password",
      });
    } catch (error: any) {
      if (error.message === "EMAIL_OTP_REQUIRED") throw error;
      try {
        const backendRes = await axiosInstance.post("/auth/password-login", { email, password });
        if (backendRes.data) {
          saveUserSession(backendRes.data);
          await axiosInstance.post("/login-event", { email, method: "password" });
          return;
        }
      } catch {
        // Preserve the original Firebase error when backend fallback is not valid.
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyLoginOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.post("/auth/verify-login-otp", { email, otp });
      if (res.data?.user) {
        saveUserSession(res.data.user);
        await axiosInstance.post("/login-event", { email, method: "email-otp" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    setIsLoading(true);
    try {
      const newuser: any = {
        username,
        displayName,
        avatar: "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
        coverPhoto: "",
        email,
        password,
      };
      const res = await axiosInstance.post("/register", newuser);
      if (res.data) saveUserSession(res.data);
      await axiosInstance.post("/login-event", {
        email,
        method: "signup",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    clearUserSession();
    if (auth) {
      await signOut(auth);
    }
  };

  const updateProfile = async (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
    coverPhoto?: string;
    language?: string;
    phone?: string;
  }) => {
    if (!user) return;

    setIsLoading(true);

    const updatedUser: User = {
      ...user,
      ...profileData,
    };

    try {
      const res = await axiosInstance.patch(
        `/userupdate/${encodeURIComponent(user.email)}`,
        profileData
      );

      const serverUser = res?.data;
      if (serverUser) {
        const mergedUser = {
          ...user,
          ...serverUser,
        };
        saveUserSession(mergedUser);
      } else {
        saveUserSession(updatedUser);
      }
    } catch (err) {
      saveUserSession(updatedUser);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get("/loggedinuser", {
        params: { email: user.email },
      });
      if (res.data) {
        saveUserSession(res.data);
      }
    } catch (err) {
      console.error("Failed to refresh user", err);
    }
  };

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    try {
      await axiosInstance.post("/forgot-password", { identifier: email });
    } finally {
      setIsLoading(false);
    }
  };

  const requestLanguageOtp = async (language: string) => {
    if (!user) return;
    return axiosInstance.post("/language/request-otp", { email: user.email, language });
  };

  const setLanguage = async (language: string, otp?: string) => {
    if (!user) return;
    if (!otp) return requestLanguageOtp(language);
    const res = await axiosInstance.post("/language/verify", { email: user.email, language, otp });
    if (res.data) {
      window.localStorage.setItem("twillerLanguage", language);
      saveUserSession(res.data);
    }
    return res;
  };

  const socialsignin = async (providerName: "google" | "apple") => {
    if (!auth) {
      throw new Error("Firebase auth is not initialized");
    }
    setIsLoading(true);
    suppressFirebaseSession.current = true;

    try {
      const provider = providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider("apple.com");
      const result = await signInWithPopup(auth, provider);
      const firebaseuser = result.user;

      if (!firebaseuser?.email) {
        throw new Error("No email found in Google account");
      }

      let userData;

      try {
        const res = await axiosInstance.get("/loggedinuser", {
          params: { email: firebaseuser.email },
        });
        userData = res.data;
      } catch (err: any) {
        console.warn("No existing user found, registering new user:", err);
      }

      if (!userData) {
        const newuser: any = {
          username: firebaseuser.email.split("@")[0],
          displayName: firebaseuser.displayName || "User",
          avatar:
            firebaseuser.photoURL ||
            "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
          email: firebaseuser.email,
        };

        const registerRes = await axiosInstance.post("/register", newuser);
        userData = registerRes.data || newuser;
      }

      const prelogin = await axiosInstance.post("/auth/prelogin", { email: firebaseuser.email });
      if (prelogin.data?.requiresOtp) {
        await signOut(auth);
        const otpError: any = new Error("EMAIL_OTP_REQUIRED");
        otpError.otpEmail = firebaseuser.email;
        throw otpError;
      }
      if (!userData) throw new Error("Login/Register failed: No user data returned");
      saveUserSession(userData);
      await axiosInstance.post("/login-event", { email: userData.email, method: providerName });
    } catch (error: any) {
      if (error.code === "auth/user-cancelled" || error.code === "auth/cancelled-popup-request") {
        console.info(`${providerName} Sign-In was canceled by the user.`);
      } else {
        if (error.message === "EMAIL_OTP_REQUIRED") throw error;
        console.error(`${providerName} Sign-In Error:`, error);
        throw error;
      }
    } finally {
      suppressFirebaseSession.current = false;
      setIsLoading(false);
    }
  };

  const googlesignin = () => socialsignin("google");
  const applesignin = () => socialsignin("apple");

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        verifyLoginOtp,
        signup,
        updateProfile,
        resetPassword,
        setLanguage,
        requestLanguageOtp,
        refreshUser,
        logout,
        isLoading,
        googlesignin,
        applesignin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
