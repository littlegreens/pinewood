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

export async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    console.warn("[mail] SMTP non configurato: email non inviata", { to, subject });
    return false;
  }
  try {
    await tx.sendMail({
      from: env.smtpFrom || env.smtpUser,
      to,
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
    });
    return false;
  }
}
