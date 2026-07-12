import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import nodemailer from "nodemailer";
import Razorpay from "razorpay";
import rateLimit from "express-rate-limit";
import { UAParser } from "ua-parser-js";
import dns from "node:dns";
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, PLANS, SUPPORTED_LANGUAGES, generateAlphaPassword, getAudioDurationSeconds, isKeywordNotificationTweet, shouldRequireChromeOtp, usagePeriodStart, verifyRazorpaySignature } from "./lib/policy.js";

import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import Subscription from "./models/subscription.js";
import Transaction from "./models/transaction.js";
import LoginHistory from "./models/loginHistory.js";
import PasswordResetRequest from "./models/passwordResetRequest.js";
import OTPVerification from "./models/otpVerification.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const uploadDir = path.join(__dirname, "uploads", "audio");
const imageUploadDir = path.join(__dirname, "uploads", "images");
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(imageUploadDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const port = process.env.PORT || 5000;
const url = process.env.MONGODB_URL;
let isDbConnected = false;


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".mp3");
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("audio/")) {
      return cb(new Error("Only audio files are allowed"));
    }
    return cb(null, true);
  },
});

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, imageUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".jpg");
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    return cb(null, true);
  },
});

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

const mailer =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

const getIstParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const isWithinIstWindow = (startHour, endHour) => {
  const { minutes } = getIstParts();
  return minutes >= startHour * 60 && minutes < endHour * 60;
};

const getClientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
  req.socket?.remoteAddress ||
  req.ip ||
  "";

const parseUserAgent = (userAgent = "") => {
  const parsed = new UAParser(userAgent).getResult();
  return {
    browser: parsed.browser?.name || "Unknown",
    operatingSystem: parsed.os?.name || "Unknown",
    deviceType: parsed.device?.type || "desktop",
  };
};

const generateOtp = () => String(crypto.randomInt(100000, 999999));

const removeUploadedFile = async (file) => {
  if (!file?.path) return;
  await fs.promises.unlink(file.path).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
};

const sendEmail = async ({ to, subject, text, attachments = [] }) => {
  if (!mailer) {
    throw new Error("Email delivery is not configured.");
  }
  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    attachments,
  });
  return true;
};

const pdfText = (value) => String(value ?? "").replace(/[^\x20-\x7E]/g, "").replace(/[\\()]/g, "\\$&");

const createInvoicePdf = ({ user, transaction, purchaseDate, expiryDate }) => {
  const formatDate = (date) => date?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) || "N/A";
  const lines = [
    ["Twiller", 24], ["TAX INVOICE", 16], ["", 12],
    [`Invoice number: ${transaction.invoice.number}`, 11],
    [`Invoice date: ${formatDate(purchaseDate)}`, 11],
    [`Billed to: ${user.displayName} (${user.email})`, 11], ["", 12],
    ["Subscription details", 14],
    [`Plan: ${transaction.plan}`, 11],
    [`Amount paid: INR ${transaction.amount.toFixed(2)}`, 11],
    [`Payment reference: ${transaction.providerPaymentId || transaction.providerOrderId}`, 9],
    [`Subscription valid until: ${formatDate(expiryDate)}`, 11], ["", 12],
    ["Thank you for subscribing to Twiller.", 10],
  ];
  let y = 780;
  const content = lines.map(([line, size]) => {
    const command = `BT /F1 ${size} Tf 50 ${y} Td (${pdfText(line)}) Tj ET`;
    y -= Number(size) + 9;
    return command;
  }).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "ascii")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
};

const sendSms = async ({ to, text }) => {
  // An SMS integration must be configured before SMS-dependent flows can claim delivery.
  throw new Error("SMS provider is not configured.");
};

const createOtp = async ({ user, purpose, channel, target, deliveryTarget }) => {
  const otp = generateOtp();
  await OTPVerification.create({
    user: user._id,
    purpose,
    channel,
    target,
    otpHash: await bcrypt.hash(otp, 10),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  const text = `Your Twiller OTP is ${otp}. It expires in 10 minutes.`;
  const deliverTo = deliveryTarget || target;
  if (channel === "email") {
    await sendEmail({ to: deliverTo, subject: "Twiller OTP verification", text });
  } else {
    await sendSms({ to: deliverTo, text });
  }
  return { channel, target };
};

const verifyOtpRecord = async ({ userId, purpose, otp, target }) => {
  const record = await OTPVerification.findOne({
    user: userId,
    purpose,
    ...(target ? { target } : {}),
    verifiedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) return null;
  record.attempts += 1;
  const valid = await bcrypt.compare(String(otp || ""), record.otpHash);
  if (!valid) {
    await record.save();
    return null;
  }
  record.verifiedAt = new Date();
  await record.save();
  return record;
};

const sendInvoiceEmail = async ({ user, transaction }) => {
  const purchaseDate = transaction.invoice.purchaseDate || new Date();
  const expiryDate = transaction.invoice.expiryDate;
  const text = [
    "Twiller subscription invoice",
    `Invoice number: ${transaction.invoice.number}`,
    `Plan: ${transaction.plan}`,
    `Amount: Rs. ${transaction.amount}`,
    `Purchase date: ${purchaseDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
    `Expiry date: ${expiryDate?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) || "N/A"}`,
  ].join("\n");
  const pdf = createInvoicePdf({ user, transaction, purchaseDate, expiryDate });
  await sendEmail({
    to: user.email,
    subject: `Invoice ${transaction.invoice.number}`,
    text: `${text}\n\nYour PDF invoice is attached to this email.`,
    attachments: [{ filename: `${transaction.invoice.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  transaction.invoice.emailedAt = new Date();
  await transaction.save();
};

const activateSubscription = async ({ user, plan, providerOrderId, providerPaymentId = "", providerSignature = "" }) => {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  const planConfig = PLANS[plan];
  const subscription = await Subscription.create({
    user: user._id,
    plan,
    tweetLimit: planConfig.tweetLimit,
    amount: planConfig.amount,
    startedAt: now,
    expiresAt,
  });
  await Subscription.updateMany(
    { user: user._id, _id: { $ne: subscription._id }, status: "active" },
    { $set: { status: "expired" } }
  );

  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const transaction = await Transaction.findOneAndUpdate(
    { user: user._id, providerOrderId },
    {
      $set: {
        subscription: subscription._id,
        plan,
        amount: planConfig.amount,
        providerOrderId,
        providerPaymentId,
        providerSignature,
        status: "paid",
        invoice: { number: invoiceNumber, purchaseDate: now, expiryDate: expiresAt },
      },
    },
    { new: true, upsert: true }
  );

  user.subscription = { plan, status: "active", startedAt: now, expiresAt };
  user.notifications.push({
    title: "Subscription activated",
    message: `You have subscribed to the ${plan} plan.`,
    read: false,
    createdAt: new Date(),
  });
  await user.save();
  await sendInvoiceEmail({ user, transaction });
  return { subscription, transaction };
};

const expireUserSubscriptions = async (userId) => {
  const now = new Date();
  await Subscription.updateMany(
    { user: userId, status: "active", expiresAt: { $lte: now } },
    { $set: { status: "expired" } }
  );
  const user = await User.findById(userId);
  if (user?.subscription?.status === "active" && user.subscription.expiresAt && user.subscription.expiresAt <= now) {
    user.subscription.status = "expired";
    await user.save();
  }
};

const getActivePlan = async (userId) => {
  await expireUserSubscriptions(userId);
  const subscription = await Subscription.findOne({
    user: userId,
    status: "active",
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
  }).sort({ createdAt: -1 });
  return subscription || { plan: "Free", tweetLimit: PLANS.Free.tweetLimit };
};

const canUserPostTweet = async (userId) => {
  const plan = await getActivePlan(userId);
  if (plan.tweetLimit === -1) return { allowed: true, plan };
  // Limits apply to the current subscription period, never the user's lifetime tweets.
  const used = await Tweet.countDocuments({ author: userId, timestamp: { $gte: usagePeriodStart(plan) } });
  return {
    allowed: used < plan.tweetLimit,
    plan,
    used,
  };
};

app.get("/", (_req, res) => {
  res.send("Twiller backend is running successfully");
});

app.get("/health", (_req, res) => {
  res.status(isDbConnected ? 200 : 503).send({
    status: "ok",
    database: isDbConnected ? "connected" : "disconnected",
  });
});

// Register
app.post("/register", async (req, res) => {
  try {
    if (!isDbConnected) {
      return res.status(503).send({ error: "Database is not connected yet. Please check backend/.env MONGODB_URL." });
    }
    const { email, password, username, displayName, avatar, phone } = req.body;
    if (!email || !username || !displayName || !avatar) {
      return res.status(400).send({ error: "Email, username, display name, and avatar are required" });
    }
    const existinguser = await User.findOne({ email });
    if (existinguser) {
      return res.status(409).send({ error: "An account with this email already exists." });
    }
    const newUser = new User({
      ...req.body,
      passwordHash: password ? await bcrypt.hash(password, 10) : "",
      phone: phone || "",
    });
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.get("/loggedinuser", async (req, res) => {
  try {
    if (!isDbConnected) {
      return res.status(503).send({ error: "Database is not connected yet. Please check backend/.env MONGODB_URL." });
    }
    const { email } = req.query;
    if (!email) return res.status(400).send({ error: "Email required" });
    const user = await User.findOne({ email });
    if (user) await expireUserSubscriptions(user._id);
    const freshUser = user ? await User.findById(user._id) : null;
    return res.status(200).send(freshUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.patch("/userupdate/:email", async (req, res) => {
  try {
    if (!isDbConnected) {
      return res.status(503).send({ error: "Database is not connected yet. Please check backend/.env MONGODB_URL." });
    }
    const { email } = req.params;
    const allowed = ["displayName", "bio", "location", "website", "avatar", "coverPhoto", "phone"];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const updated = await User.findOneAndUpdate({ email }, { $set: update }, { new: true, upsert: false });
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/upload/image", imageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send({ error: "Image file is required" });
    const baseUrl = process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    return res.status(201).send({ imageUrl: `${baseUrl}/uploads/images/${req.file.filename}` });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.use((req, res, next) => {
  if (!isDbConnected) {
    return res.status(503).send({
      error: "Database is not connected yet. Please check backend/.env MONGODB_URL and wait for MongoDB to connect.",
    });
  }
  next();
});

app.post("/auth/prelogin", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).send({ error: "Email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });

    const metadata = parseUserAgent(req.headers["user-agent"]);
    if (metadata.deviceType === "mobile" && !isWithinIstWindow(10, 13)) {
      return res.status(403).send({ error: "Mobile login is allowed only between 10:00 AM and 1:00 PM IST." });
    }

    if (password && user.passwordHash) {
      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) return res.status(401).send({ error: "Invalid email or password." });
    }

    const lowerBrowser = metadata.browser.toLowerCase();
    if (shouldRequireChromeOtp(lowerBrowser)) {
      await createOtp({ user, purpose: "login", channel: "email", target: user.email });
      return res.status(202).send({ requiresOtp: true, channel: "email", message: "OTP sent to registered email." });
    }

    if (password && user.passwordHash) {
      return res.status(200).send({ user, backendPasswordAccepted: true });
    }
    return res.status(200).send({ requiresOtp: false });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/auth/verify-login-otp", authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).send({ error: "Email and OTP are required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const record = await verifyOtpRecord({ userId: user._id, purpose: "login", otp, target: user.email });
    if (!record) return res.status(400).send({ error: "Invalid or expired OTP" });
    return res.status(200).send({ user });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/auth/password-login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
      return res.status(401).send({ error: "Invalid credentials" });
    }
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/login-event", async (req, res) => {
  try {
    const { email, method = "password", userAgent } = req.body;
    if (!email) return res.status(400).send({ error: "Email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const ua = userAgent || req.headers["user-agent"] || "";
    const parsed = parseUserAgent(ua);
    const entry = {
      user: user._id,
      method,
      ip: getClientIp(req),
      userAgent: ua,
      browser: parsed.browser,
      operatingSystem: parsed.operatingSystem,
      deviceType: parsed.deviceType,
      timestamp: new Date(),
    };
    await LoginHistory.create(entry);
    const updated = await User.findByIdAndUpdate(
      user._id,
      { $push: { loginHistory: entry } },
      { new: true }
    );
    return res.status(200).send(updated?.loginHistory || []);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.get("/login-history", async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const history = await LoginHistory.find({ user: user._id }).sort({ timestamp: -1 }).limit(100);
    return res.status(200).send(history);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/forgot-password", authLimiter, async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).send({ error: "Registered email or phone number is required" });
    const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    if (!user) return res.status(404).send({ error: "User not found" });

    const { dateKey } = getIstParts();
    const existing = await PasswordResetRequest.findOne({ user: user._id, requestedOn: dateKey });
    if (existing) {
      return res.status(429).send({ error: "You can use this option only one time per day." });
    }

    const generatedPassword = generateAlphaPassword();
    const generatedPasswordHash = await bcrypt.hash(generatedPassword, 10);
    const channel = identifier.includes("@") ? "email" : "sms";
    await PasswordResetRequest.create({
      user: user._id,
      identifier,
      channel,
      requestedOn: dateKey,
      generatedPasswordHash,
      delivered: true,
    });
    user.passwordHash = generatedPasswordHash;
    await user.save();

    const text = `Your new Twiller password is ${generatedPassword}`;
    if (channel === "email") await sendEmail({ to: user.email, subject: "Your Twiller password reset", text });
    else await sendSms({ to: user.phone, text });

    return res.status(200).send({ message: "New password sent to your registered contact." });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(429).send({ error: "You can use this option only one time per day." });
    }
    return res.status(400).send({ error: error.message });
  }
});

app.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !/^[A-Za-z]+$/.test(password || "")) {
      return res.status(400).send({ error: "Email and alphabetic password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    return res.status(200).send({ message: "Password updated." });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.get("/notifications", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).send({ error: "Email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    return res.status(200).send(user.notifications || []);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.patch("/notifications/read", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send({ error: "Email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });

    user.notifications.forEach((notification) => {
      notification.read = true;
    });
    await user.save();
    return res.status(200).send({ unreadCount: 0 });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

const toPublicUser = (person, actor) => {
  const has = (items, id) => (items || []).some((item) => item.equals(id));
  return {
    _id: person._id, username: person.username, displayName: person.displayName, avatar: person.avatar,
    email: person.email,
    followStatus: has(actor.following, person._id) ? "following" : has(person.followRequests, actor._id) ? "requested" : has(actor.followRequests, person._id) ? "received" : "none",
    followsYou: has(person.following, actor._id),
  };
};

app.get("/users/search", async (req, res) => {
  try {
    const { email, q = "" } = req.query;
    if (!email || !q.trim()) return res.status(200).send([]);
    const actor = await User.findOne({ email });
    if (!actor) return res.status(404).send({ error: "User not found" });
    const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const people = await User.find({ _id: { $ne: actor._id }, $or: [{ username: { $regex: escapedQuery, $options: "i" } }, { email: { $regex: escapedQuery, $options: "i" } }] }).limit(10);
    return res.status(200).send(people.map((person) => toPublicUser(person, actor)));
  } catch (error) { return res.status(400).send({ error: error.message }); }
});

app.get("/follow-requests", async (req, res) => {
  try {
    const actor = await User.findOne({ email: req.query.email });
    if (!actor) return res.status(404).send({ error: "User not found" });
    const people = await User.find({ _id: { $in: actor.followRequests || [] } });
    return res.status(200).send(people.map((person) => toPublicUser(person, actor)));
  } catch (error) { return res.status(400).send({ error: error.message }); }
});

app.post("/follow-request", async (req, res) => {
  try {
    const { email, targetId } = req.body;
    const [requester, target] = await Promise.all([User.findOne({ email }), User.findById(targetId)]);
    if (!requester || !target) return res.status(404).send({ error: "User not found" });
    if (requester._id.equals(target._id)) return res.status(400).send({ error: "You cannot follow yourself" });
    if (requester.following.some((id) => id.equals(target._id))) return res.status(200).send({ status: "following" });
    if (!target.followRequests.some((id) => id.equals(requester._id))) {
      target.followRequests.push(requester._id);
      target.notifications.push({ title: "Follow request", message: `@${requester.username} wants to follow you.`, read: false, createdAt: new Date() });
      await target.save();
    }
    return res.status(200).send({ status: "requested" });
  } catch (error) { return res.status(400).send({ error: error.message }); }
});

app.patch("/follow-request", async (req, res) => {
  try {
    const { email, requesterId, action } = req.body;
    if (!['accept', 'reject'].includes(action)) return res.status(400).send({ error: "Invalid action" });
    const [target, requester] = await Promise.all([User.findOne({ email }), User.findById(requesterId)]);
    if (!target || !requester) return res.status(404).send({ error: "User not found" });
    if (!target.followRequests.some((id) => id.equals(requester._id))) return res.status(400).send({ error: "Follow request not found" });
    target.followRequests = target.followRequests.filter((id) => !id.equals(requester._id));
    if (action === 'accept') {
      if (!target.followers.some((id) => id.equals(requester._id))) target.followers.push(requester._id);
      if (!requester.following.some((id) => id.equals(target._id))) requester.following.push(target._id);
      requester.notifications.push({ title: "Follow request accepted", message: `@${target.username} accepted your follow request.`, read: false, createdAt: new Date() });
      await requester.save();
    }
    await target.save();
    return res.status(200).send({ status: action });
  } catch (error) { return res.status(400).send({ error: error.message }); }
});

app.patch("/notification-settings", async (req, res) => {
  try {
    const { email, enabled } = req.body;
    if (!email || typeof enabled !== "boolean") {
      return res.status(400).send({ error: "Email and enabled boolean are required" });
    }
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { keywordNotificationsEnabled: enabled } },
      { new: true }
    );
    if (!user) return res.status(404).send({ error: "User not found" });
    return res.status(200).send({ keywordNotificationsEnabled: user.keywordNotificationsEnabled });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/language/request-otp", authLimiter, async (req, res) => {
  try {
    const { email, language } = req.body;
    if (!email || !SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).send({ error: "Valid email and language are required" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const channel = language === "fr" ? "email" : "sms";
    const target = channel === "email" ? user.email : user.phone;
    if (!target) return res.status(400).send({ error: `Registered ${channel === "email" ? "email" : "mobile number"} is required` });
    const otp = await createOtp({
      user,
      purpose: "language_change",
      channel,
      target: `${language}:${target}`,
      deliveryTarget: target,
    });
    return res.status(200).send({ ...otp, target: channel === "email" ? user.email : user.phone });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/language/verify", authLimiter, async (req, res) => {
  try {
    const { email, language, otp } = req.body;
    if (!email || !SUPPORTED_LANGUAGES.includes(language) || !otp) {
      return res.status(400).send({ error: "Email, language, and OTP are required" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const channel = language === "fr" ? "email" : "sms";
    const target = channel === "email" ? user.email : user.phone;
    const record = await verifyOtpRecord({
      userId: user._id,
      purpose: "language_change",
      otp,
      target: `${language}:${target}`,
    });
    if (!record) return res.status(400).send({ error: "Invalid or expired OTP" });
    user.language = language;
    await user.save();
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.get("/subscription/plans", (_req, res) => {
  res.status(200).send(PLANS);
});

app.post("/subscription/purchase", authLimiter, async (req, res) => {
  try {
    const { email, plan } = req.body;
    if (!email || !PLANS[plan]) return res.status(400).send({ error: "Valid email and plan are required" });
    if (plan !== "Free" && !isWithinIstWindow(10, 11)) {
      return res.status(403).send({ error: "Payments are allowed only between 10:00 AM and 11:00 AM IST." });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const planConfig = PLANS[plan];
    const amountInPaise = planConfig.amount * 100;
    const receipt = `twiller_${Date.now()}`;
    const order = plan === "Free"
      ? { id: `free_${receipt}`, amount: 0, currency: "INR", receipt }
      : razorpay
        ? await razorpay.orders.create({ amount: amountInPaise, currency: "INR", receipt })
        : { id: `dev_${receipt}`, amount: amountInPaise, currency: "INR", receipt };

    await Transaction.create({
      user: user._id,
      plan,
      amount: planConfig.amount,
      providerOrderId: order.id,
      status: plan === "Free" ? "paid" : "created",
      raw: order,
    });

    if (plan === "Free") {
      const activated = await activateSubscription({
        user,
        plan,
        providerOrderId: order.id,
        providerPaymentId: order.id,
        providerSignature: "free",
      });
      return res.status(200).send(activated);
    }

    return res.status(200).send({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID || "",
      plan,
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/subscription/verify-payment", authLimiter, async (req, res) => {
  try {
    const { email, plan, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!email || !PLANS[plan] || !razorpay_order_id) {
      return res.status(400).send({ error: "Payment verification details are required" });
    }
    if (plan !== "Free" && !isWithinIstWindow(10, 11)) {
      return res.status(403).send({ error: "Payment verification is allowed only between 10:00 AM and 11:00 AM IST." });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });

    if (plan !== "Free") {
      if (!verifyRazorpaySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        secret: process.env.RAZORPAY_KEY_SECRET,
      })) return res.status(400).send({ error: "Invalid Razorpay signature" });
    }

    const activated = await activateSubscription({
      user,
      plan,
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id || "",
      providerSignature: razorpay_signature || "",
    });
    return res.status(200).send(activated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Backward-compatible old subscription endpoint.
app.post("/subscribe", async (req, res) => {
  try {
    const { email, plan } = req.body;
    if (!email || !PLANS[plan]) return res.status(400).send({ error: "Valid email and plan are required" });
    if (plan !== "Free" && !isWithinIstWindow(10, 11)) {
      return res.status(403).send({ error: "Paid subscriptions are allowed only between 10:00 AM and 11:00 AM IST." });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const providerOrderId = `legacy_${Date.now()}`;
    const activated = await activateSubscription({
      user,
      plan,
      providerOrderId,
      providerPaymentId: providerOrderId,
      providerSignature: "legacy",
    });
    return res.status(200).send(activated.subscription);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/audio/request-otp", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send({ error: "Email required" });
    if (!isWithinIstWindow(14, 19)) {
      return res.status(403).send({ error: "Audio uploads are allowed only between 2:00 PM and 7:00 PM IST." });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    await createOtp({ user, purpose: "audio_upload", channel: "email", target: user.email });
    return res.status(200).send({ message: "OTP sent to registered email." });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/audio/verify-otp", authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const record = await verifyOtpRecord({ userId: user._id, purpose: "audio_upload", otp, target: user.email });
    if (!record) return res.status(400).send({ error: "Invalid or expired OTP" });
    return res.status(200).send({ message: "Audio OTP verified." });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/audio/upload", audioUpload.single("audio"), async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp || !req.file) return res.status(400).send({ error: "Email, OTP, and audio file are required" });
    if (!isWithinIstWindow(14, 19)) {
      await removeUploadedFile(req.file);
      return res.status(403).send({ error: "Audio uploads are allowed only between 2:00 PM and 7:00 PM IST." });
    }
    const actualDuration = await getAudioDurationSeconds(req.file.path);
    if (actualDuration > MAX_AUDIO_SECONDS) {
      await removeUploadedFile(req.file);
      return res.status(400).send({ error: "Audio duration must be 5 minutes or less." });
    }
    const user = await User.findOne({ email });
    if (!user) {
      await removeUploadedFile(req.file);
      return res.status(404).send({ error: "User not found" });
    }
    const record = await verifyOtpRecord({ userId: user._id, purpose: "audio_upload", otp, target: user.email });
    if (!record) {
      await removeUploadedFile(req.file);
      return res.status(400).send({ error: "Invalid or expired OTP" });
    }
    const baseUrl = process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    return res.status(201).send({ audioUrl: `${baseUrl}/uploads/audio/${req.file.filename}` });
  } catch (error) {
    await removeUploadedFile(req.file);
    return res.status(400).send({ error: error.message });
  }
});

app.post("/otp/verify", authLimiter, async (req, res) => {
  try {
    const { email, purpose, otp, target } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ error: "User not found" });
    const record = await verifyOtpRecord({ userId: user._id, purpose, otp, target });
    if (!record) return res.status(400).send({ error: "Invalid or expired OTP" });
    return res.status(200).send({ verified: true });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Tweet API
app.post("/post", async (req, res) => {
  try {
    const { author, content, image, audio } = req.body;
    if (!author || (!content?.trim() && !audio)) {
      return res.status(400).send({ error: "Author and content or audio are required" });
    }
    const limit = await canUserPostTweet(author);
    if (!limit.allowed) {
      return res.status(403).send({
        error: `Tweet limit reached for ${limit.plan.plan || "Free"} plan.`,
        used: limit.used,
        limit: limit.plan.tweetLimit,
      });
    }
    const tweet = new Tweet({ author, content: content?.trim() || "Audio tweet", image, audio });
    await tweet.save();
    await tweet.populate("author");
    if (isKeywordNotificationTweet(tweet.content)) {
      const authorUser = await User.findById(author);
      if (authorUser?.keywordNotificationsEnabled) {
        authorUser.notifications.push({
          title: "Keyword tweet posted",
          message: tweet.content,
          read: false,
          createdAt: new Date(),
        });
        await authorUser.save();
      }
    }
    return res.status(201).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.get("/post", async (_req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid).populate("author");
    if (!tweet) return res.status(404).send({ error: "Tweet not found" });
    if (!tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
      const liker = await User.findById(userId);
      if (tweet.author && tweet.author._id.toString() !== userId) {
        await User.findByIdAndUpdate(tweet.author._id, {
          $push: {
            notifications: {
              title: "New like",
              message: `${liker?.username || "Someone"} liked your tweet.`,
              read: false,
              createdAt: new Date(),
            },
          },
        });
      }
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid).populate("author");
    if (!tweet) return res.status(404).send({ error: "Tweet not found" });
    if (!tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
      const retweeter = await User.findById(userId);
      if (tweet.author && tweet.author._id.toString() !== userId) {
        await User.findByIdAndUpdate(tweet.author._id, {
          $push: {
            notifications: {
              title: "New retweet",
              message: `${retweeter?.username || "Someone"} retweeted your post.`,
              read: false,
              createdAt: new Date(),
            },
          },
        });
      }
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Multer can reject a multipart request before the route body runs. Remove any
// partially written file so type and size failures cannot leave uploads behind.
app.use(async (error, req, res, _next) => {
  await removeUploadedFile(req.file).catch(() => undefined);
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).send({ error: "Audio file must be 100 MB or less." });
  }
  return res.status(400).send({ error: error.message || "Upload failed" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

if (!url) {
  console.error("MongoDB connection error: MONGODB_URL is not set. Create backend/.env with MONGODB_URL=<your connection string>");
} else {
  mongoose
    .connect(url)
    .then(() => {
      isDbConnected = true;
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      isDbConnected = false;
      console.error("MongoDB connection error:", err.message);
    });
}
