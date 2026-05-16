/** Messaggi auth condivisi (PWA). */
export const AUTH_MSG = {
  registerOk:
    "Account creato. Ti abbiamo inviato un'email con un codice a 6 cifre e un link: inserisci il codice qui sotto per attivare l'account.",
  emailNotVerified:
    "Questa email non è ancora verificata. Inserisci il codice a 6 cifre che ti abbiamo inviato (controlla anche lo spam).",
  verifyOk: "Email verificata. Ora puoi accedere con email e password.",
  verifyLinkOk: "Email verificata. Accedi con email e password.",
  verifyAlready: "Email già verificata. Puoi accedere.",
  verifyFailed: "Codice non valido o scaduto. Richiedi una nuova email.",
  resendOk: "Ti abbiamo inviato una nuova email con codice e link.",
  resendFailed: "Non siamo riusciti a inviare l'email. Riprova tra qualche minuto.",
  forgotOk: "Ti abbiamo inviato un'email con il link per reimpostare la password.",
  forgotFailed: "Non siamo riusciti a inviare l'email. Verifica l'indirizzo e riprova.",
  resetOk: "Password aggiornata. Ora puoi accedere.",
  resetFailed: "Link non valido o scaduto. Richiedi un nuovo recupero password.",
  loginFailed: "Email o password non corretti.",
};

export function isEmailNotVerifiedResponse(data, status) {
  if (status !== 403) return false;
  if (data?.code === "EMAIL_NOT_VERIFIED" || data?.needsVerification) return true;
  return /non\s+verificat/i.test(String(data?.error || ""));
}

export function authMessageColor(tone) {
  if (tone === "error") return "error";
  if (tone === "success") return "success.main";
  return "text.secondary";
}
