import assert from "node:assert/strict";
import test from "node:test";
import { sendResendEmail } from "../lib/email.js";

test("Resend sends email over HTTPS and encodes attachments", async () => {
  let request;
  const result = await sendResendEmail({
    apiKey: "test-api-key",
    from: "Twiller <no-reply@example.com>",
    to: "user@example.com",
    subject: "Your Twiller OTP",
    text: "Your code is 123456",
    attachments: [{ filename: "invoice.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" }],
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ id: "email-id" }) };
    },
  });

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.Authorization, "Bearer test-api-key");
  assert.deepEqual(JSON.parse(request.options.body), {
    from: "Twiller <no-reply@example.com>",
    to: ["user@example.com"],
    subject: "Your Twiller OTP",
    text: "Your code is 123456",
    attachments: [{ filename: "invoice.pdf", content: Buffer.from("pdf").toString("base64"), content_type: "application/pdf" }],
  });
  assert.deepEqual(result, { id: "email-id" });
});

test("Resend delivery errors are surfaced", async () => {
  await assert.rejects(
    sendResendEmail({
      apiKey: "test-api-key",
      from: "Twiller <no-reply@example.com>",
      to: "user@example.com",
      subject: "Your Twiller OTP",
      text: "Your code is 123456",
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        text: async () => "Sender domain is not verified",
      }),
    }),
    /Resend email delivery failed \(403\): Sender domain is not verified/
  );
});
