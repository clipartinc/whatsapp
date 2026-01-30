import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || "";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";

// Quick “is it live?” route
app.get("/", (_req, res) => res.status(200).send("ok"));

// Meta verify handshake
app.get("/meta/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

async function sendWhatsAppText({ to, body }) {
  if (!META_PHONE_NUMBER_ID) throw new Error("Missing META_PHONE_NUMBER_ID");
  if (!META_ACCESS_TOKEN) throw new Error("Missing META_ACCESS_TOKEN");

  const url = `https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${META_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to, // digits only with country code
      type: "text",
      text: { body },
    }),
  });

  const text = await resp.text();
  console.log("META SEND status:", resp.status, "body:", text);

  if (!resp.ok) {
    throw new Error(`Meta send failed: ${resp.status} ${text}`);
  }
}

// Meta events (validate X-Hub-Signature-256)
app.post("/meta/whatsapp", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const sig = req.get("X-Hub-Signature-256") || "";

    // Verify signature (recommended for production)
    if (META_APP_SECRET) {
      const expected =
        "sha256=" +
        crypto
          .createHmac("sha256", META_APP_SECRET)
          .update(req.body)
          .digest("hex");

      if (sig !== expected) {
        console.log("Invalid signature. Got:", sig, "Expected:", expected);
        return res.status(403).send("Invalid signature");
      }
    }

    const payloadText = req.body.toString("utf8");
    console.log("Meta webhook payload:", payloadText.slice(0, 5000));

    const payload = JSON.parse(payloadText);

    // Extract inbound message (if present)
    const change = payload?.entry?.[0]?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    const waId =
      change?.contacts?.[0]?.wa_id || // preferred
      msg?.from; // fallback

    // Ignore non-message events
    if (!msg || !waId) {
      return res.sendStatus(200);
    }

    // Avoid replying to your own outbound messages (rare, but safe)
    // Meta inbound messages include `from` = user wa_id, so this is usually fine.
    const textBody = msg?.text?.body || "";
    const msgId = msg?.id || "";
    console.log("Inbound message:", { waId, textBody, msgId });

    // ✅ Temporary: always reply so you can confirm outbound works
    await sendWhatsAppText({
      to: waId,
      body: `✅ Got it: "${textBody}"`,
    });

    return res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    // Respond 200 so Meta doesn't aggressively retry while you're debugging
    return res.sendStatus(200);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`whatsapp-webhook listening on ${PORT}`);
});
