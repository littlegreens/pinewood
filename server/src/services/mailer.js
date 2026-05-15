import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtpUser || !env.smtpPass) return null;
  const normalizedPass = String(env.smtpPass).replace(/\s+/g, "");
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: normalizedPass,
    },
  });
  return transporter;
}

export function isSmtpConfigured() {
  return Boolean(env.smtpUser && env.smtpPass);
}

export async function sendMail({ to, subject, text, html, replyTo }) {
  const tx = getTransporter();
  if (!tx) {
    console.warn("[mail] SMTP non configurato (SMTP_USER/SMTP_PASS mancanti)", { to, subject });
    return false;
  }
  try {
    await tx.sendMail({
      from: env.smtpFrom || env.smtpUser,
      to,
      replyTo: replyTo || undefined,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("[mail] Invio fallito", {
      to,
      subject,
      message: error?.message || "errore sconosciuto",
      code: error?.code,
    });
    return false;
  }
}
