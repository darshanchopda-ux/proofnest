import "server-only";

/**
 * Sends sign-in codes through Meta's WhatsApp Cloud API, using an approved "Authentication" template with a
 * copy-code button. Configure WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and optionally WHATSAPP_TEMPLATE
 * (default "proofnest_login"), WHATSAPP_TEMPLATE_LANG (default "en") and WHATSAPP_API_VERSION (default "v23.0").
 */
export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsAppCode(phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/^\+/, ""),
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE || "proofnest_login",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          // Authentication templates take the code twice: in the body and for the copy-code button.
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
    const c = body?.error?.code;
    console.error("WhatsApp send failed", res.status, c, body?.error?.message);
    if (c === 131030) return { ok: false, error: "This number isn't on the test list for ProofNest's WhatsApp yet. Ask the team to add it, or use email." };
    if (c === 131026) return { ok: false, error: "WhatsApp couldn't deliver to this number. Check it's the number you use on WhatsApp." };
    if (c === 131047 || c === 132000 || c === 132001) return { ok: false, error: "ProofNest's WhatsApp message isn't approved yet. Use email for now." };
    if (res.status === 401 || c === 190) return { ok: false, error: "ProofNest's WhatsApp connection needs renewing. Use email for now." };
    return { ok: false, error: "Couldn't send the code on WhatsApp. Try again in a minute." };
  } catch {
    return { ok: false, error: "Couldn't reach WhatsApp. Check your connection and try again." };
  }
}
