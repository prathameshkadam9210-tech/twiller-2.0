export const sendResendEmail = async ({
  apiKey,
  from,
  to,
  subject,
  text,
  attachments = [],
  fetchImpl = fetch,
}) => {
  if (!apiKey || !from) {
    throw new Error("Resend email requires RESEND_API_KEY and MAIL_FROM.");
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      ...(attachments.length
        ? {
            attachments: attachments.map((attachment) => ({
              filename: attachment.filename,
              content: Buffer.from(attachment.content).toString("base64"),
              content_type: attachment.contentType,
            })),
          }
        : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend email delivery failed (${response.status}): ${detail}`);
  }

  return response.json();
};
