import { Router } from "express";
import { isSmtpConfigured, sendMail } from "../services/mailer.js";

const router = Router();
const CONTACT_TO = "pinewood.keeptheway@gmail.com";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

router.post("/", async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Email non valida" });
  }
  if (!isSmtpConfigured()) {
    console.error("[contact] SMTP non configurato sul server");
    return res.status(503).json({ error: "Servizio email non configurato" });
  }

  const senderName = name.trim();
  const senderEmail = email.trim();
  const body = message.trim();

  const sent = await sendMail({
    to: CONTACT_TO,
    replyTo: `${senderName} <${senderEmail}>`,
    subject: `[Pinewood] Messaggio da ${senderName}`,
    text: `Nome: ${senderName}\nEmail: ${senderEmail}\n\nMessaggio:\n${body}`,
    html: `
      <p><strong>Nome:</strong> ${senderName}</p>
      <p><strong>Email:</strong> ${senderEmail}</p>
      <hr />
      <p>${body.replace(/\n/g, "<br />")}</p>
    `,
  });

  if (!sent) {
    return res.status(500).json({ error: "Invio email fallito" });
  }

  return res.json({ ok: true });
});

export default router;