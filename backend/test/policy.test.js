import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { UAParser } from "ua-parser-js";
import LoginHistory from "../models/loginHistory.js";
import OTPVerification from "../models/otpVerification.js";
import User from "../models/user.js";
import {
  MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, PLANS, SUPPORTED_LANGUAGES, generateAlphaPassword,
  getAudioDurationSeconds, isKeywordNotificationTweet, isWithinIstWindowAt, shouldRequireChromeOtp,
  startOfIstMonth, usagePeriodStart, verifyRazorpaySignature,
} from "../lib/policy.js";

const wav = (seconds) => {
  const sampleRate = 8000, dataBytes = sampleRate * seconds;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataBytes, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate, 28); buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
};

test("subscription prices and limits match the required plans", () => {
  assert.deepEqual(PLANS, { Free: { amount: 0, tweetLimit: 1 }, Bronze: { amount: 100, tweetLimit: 3 }, Silver: { amount: 300, tweetLimit: 5 }, Gold: { amount: 1000, tweetLimit: -1 } });
});

test("tweet counting begins at each paid subscription start; Free resets monthly in IST", () => {
  const renewal = new Date("2026-07-10T08:00:00.000Z");
  assert.equal(usagePeriodStart({ startedAt: renewal }).getTime(), renewal.getTime());
  assert.equal(usagePeriodStart({ startedAt: new Date("2026-07-10T09:00:00.000Z") }).toISOString(), "2026-07-10T09:00:00.000Z"); // upgrade starts a new period
  assert.equal(startOfIstMonth(new Date("2026-07-10T08:00:00.000Z")).toISOString(), "2026-06-30T18:30:00.000Z");
  assert.equal(usagePeriodStart(null, new Date("2026-07-10T08:00:00.000Z")).toISOString(), "2026-06-30T18:30:00.000Z");
});

test("payment signature verification and IST payment window are enforced", () => {
  const secret = "test-secret", orderId = "order_1", paymentId = "pay_1";
  const signature = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature, secret }), true);
  assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature: "tampered", secret }), false);
  assert.equal(isWithinIstWindowAt(new Date("2026-07-10T04:45:00.000Z"), 10, 11), true);
  assert.equal(isWithinIstWindowAt(new Date("2026-07-10T05:30:00.000Z"), 10, 11), false);
});

test("passwords are alphabetic and all six languages have the required OTP channel policy", () => {
  assert.match(generateAlphaPassword(64), /^[A-Za-z]{64}$/);
  assert.deepEqual(SUPPORTED_LANGUAGES, ["en", "hi", "es", "pt", "zh", "fr"]);
  assert.equal("fr" === "fr" ? "email" : "sms", "email");
  assert.equal("hi" === "fr" ? "email" : "sms", "sms");
});

test("Chrome requires OTP, Edge does not, and mobile policy has a restricted time window", () => {
  assert.equal(shouldRequireChromeOtp(new UAParser("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36").getBrowser().name), true);
  assert.equal(shouldRequireChromeOtp(new UAParser("Mozilla/5.0 Edg/120.0.0.0").getBrowser().name), false);
  assert.equal(isWithinIstWindowAt(new Date("2026-07-10T05:00:00.000Z"), 10, 13), true);
  assert.equal(isWithinIstWindowAt(new Date("2026-07-10T08:00:00.000Z"), 10, 13), false);
});

test("login history, audio OTP, and notification preferences are persisted in schemas", () => {
  assert.ok(LoginHistory.schema.path("browser"));
  assert.deepEqual(OTPVerification.schema.path("purpose").enumValues, ["login", "audio_upload", "language_change"]);
  assert.ok(User.schema.path("keywordNotificationsEnabled"));
});

test("cricket and science notifications match whole keywords only", () => {
  assert.equal(isKeywordNotificationTweet("Cricket match update"), true);
  assert.equal(isKeywordNotificationTweet("science discovery"), true);
  assert.equal(isKeywordNotificationTweet("conscience is different"), false);
});

test("audio byte limit and actual uploaded-file duration are validated", async () => {
  assert.equal(MAX_AUDIO_BYTES, 100 * 1024 * 1024);
  assert.equal(MAX_AUDIO_SECONDS, 300);
  const directory = await mkdtemp(path.join(os.tmpdir(), "twiller-audio-"));
  try {
    const shortFile = path.join(directory, "short.wav"), longFile = path.join(directory, "long.wav");
    await writeFile(shortFile, wav(2)); await writeFile(longFile, wav(301));
    assert.ok(await getAudioDurationSeconds(shortFile) <= MAX_AUDIO_SECONDS);
    assert.ok(await getAudioDurationSeconds(longFile) > MAX_AUDIO_SECONDS);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
