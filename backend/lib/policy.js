import crypto from "node:crypto";
import { parseFile } from "music-metadata";

export const PLANS = Object.freeze({
  Free: { amount: 0, tweetLimit: 1 },
  Bronze: { amount: 100, tweetLimit: 3 },
  Silver: { amount: 300, tweetLimit: 5 },
  Gold: { amount: 1000, tweetLimit: -1 },
});

export const SUPPORTED_LANGUAGES = Object.freeze(["en", "hi", "es", "pt", "zh", "fr"]);
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 5 * 60;
export const isKeywordNotificationTweet = (content = "") => /\b(cricket|science)\b/i.test(content);
export const shouldRequireChromeOtp = (browser = "") => {
  const name = browser.toLowerCase();
  return name.includes("chrome") && !name.includes("edge");
};

export const generateAlphaPassword = (length = 12) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from({ length }, () => chars[crypto.randomInt(0, chars.length)]).join("");
};

export const verifyRazorpaySignature = ({ orderId, paymentId, signature, secret }) => {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const actual = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
};

// India has a fixed UTC+05:30 offset. Free-plan usage resets at the start of each IST calendar month.
export const startOfIstMonth = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, 1, 0, -330, 0));
};

export const usagePeriodStart = (subscription, now = new Date()) =>
  subscription?.startedAt ? new Date(subscription.startedAt) : startOfIstMonth(now);

export const isWithinIstWindowAt = (date, startHour, endHour) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= startHour * 60 && minutes < endHour * 60;
};

export const getAudioDurationSeconds = async (filePath) => {
  const metadata = await parseFile(filePath, { duration: true });
  const duration = metadata.format.duration;
  if (!Number.isFinite(duration) || duration < 0) throw new Error("Unable to determine audio duration.");
  return duration;
};
