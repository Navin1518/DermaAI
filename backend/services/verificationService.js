/*
 * Purpose: Deliver short-lived account verification codes by email or SMS.
 * Email uses SMTP (including Gmail App Passwords); phone messages use Twilio.
 */

const nodemailer = require("nodemailer");

// Send an email code through the SMTP server configured in the backend .env.
async function sendEmailCode(email, code) {
  const requiredSettings = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS"
  ];
  const missingSettings = requiredSettings.filter(
    (setting) =>
      !process.env[setting] ||
      process.env[setting].startsWith("your-") ||
      process.env[setting].includes("<")
  );

  if (missingSettings.length > 0) {
    throw new Error(
      `Email OTP is not configured. Add these settings to .env: ${missingSettings.join(", ")}.`
    );
  }

  const port = Number(process.env.SMTP_PORT);
  const mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE.toLowerCase() === "true"
      : port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Use a clear expiry in the message so users know how long the code is valid.
  await mailTransport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Your DermaCare AI verification code",
    text: `Your DermaCare AI verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `<p>Your DermaCare AI verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes. If you did not request this code, you can ignore this email.</p>`
  });
}

// Send a phone code using Twilio's standard Messages REST API.
async function sendPhoneCode(phone, code) {
  const requiredSettings = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER"
  ];
  const missingSettings = requiredSettings.filter(
    (setting) =>
      !process.env[setting] ||
      process.env[setting].startsWith("your-") ||
      process.env[setting].includes("<")
  );

  if (missingSettings.length > 0) {
    throw new Error(
      `Phone OTP is not configured. Add these settings to .env: ${missingSettings.join(", ")}.`
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authorization = Buffer.from(
    `${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");
  const messageBody = new URLSearchParams({
    From: process.env.TWILIO_PHONE_NUMBER,
    To: phone,
    Body: `Your DermaCare AI verification code is ${code}. It expires in 10 minutes.`
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: messageBody
    }
  );

  if (!response.ok) {
    console.error("Twilio could not send the verification message:", response.status);
    throw new Error("The SMS provider could not send the code. Check your Twilio settings.");
  }
}

// Choose the delivery method using the verified contact supplied at signup.
async function sendVerificationCode(contactType, contactValue, code) {
  if (contactType === "email") {
    return sendEmailCode(contactValue, code);
  }

  return sendPhoneCode(contactValue, code);
}

module.exports = sendVerificationCode;
