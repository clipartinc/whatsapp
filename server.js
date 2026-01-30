import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || "";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const MOLTBOT_INTERNAL_URL =
  process.env.MOLTBOT_INTERNAL_URL || "http://moltbot.railway.internal:8080";

function parseAdminList() {
  return (process.env.ADMIN_WA_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAdmin(waId) {
  const admins = parseAdminList();
  // If not set, allow all (useful while debugging)
  if (admins.length === 0) return true;
  return admins.includes(String(waId));
}

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
      to,
      type: "text",
      text: { body },
    }),
  });

  const text = await resp.text();
  console.log("META SEND status:", resp.status, "body:", text);

  if (!resp.ok) throw new Error(`Meta send failed: ${resp.status} ${text}`);
}

// Quick “is it live?” route
app.get("/", (_req, res) => res.status(200).send("ok"));

// Privacy Policy for Meta App approval
app.get("/privacy", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
    h1 { color: #1a1a1a; }
    h2 { color: #444; margin-top: 30px; }
    p { margin: 15px 0; }
    .updated { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: January 2025</p>
  
  <h2>Introduction</h2>
  <p>This Privacy Policy describes how we collect, use, and handle your information when you use our WhatsApp integration service.</p>
  
  <h2>Information We Collect</h2>
  <p>When you interact with our service via WhatsApp, we may receive:</p>
  <ul>
    <li>Your WhatsApp phone number</li>
    <li>Your WhatsApp display name</li>
    <li>Message content you send to our service</li>
  </ul>
  
  <h2>How We Use Your Information</h2>
  <p>We use the information solely to:</p>
  <ul>
    <li>Process and respond to your messages</li>
    <li>Provide the requested service functionality</li>
  </ul>
  
  <h2>Data Storage and Security</h2>
  <p>We process messages in real-time and do not permanently store message content. We implement appropriate security measures to protect any data in transit.</p>
  
  <h2>Third-Party Services</h2>
  <p>Our service integrates with Meta's WhatsApp Business Platform. Your use is also subject to <a href="https://www.whatsapp.com/legal/privacy-policy">WhatsApp's Privacy Policy</a>.</p>
  
  <h2>Data Retention</h2>
  <p>We do not retain personal message data beyond the immediate processing required to respond to your request.</p>
  
  <h2>Your Rights</h2>
  <p>You may stop using our service at any time by ceasing to send messages. For questions about your data, contact us using the information below.</p>
  
  <h2>Contact Us</h2>
  <p>If you have questions about this Privacy Policy, please contact us at the email associated with this service.</p>
  
  <h2>Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. Continued use of the service after changes constitutes acceptance of the updated policy.</p>
</body>
</html>`);
});

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

// Meta events
app.post("/meta/whatsapp", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const sig = req.get("X-Hub-Signature-256") || "";

    // Verify signature (recommended)
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

    const change = payload?.entry?.[0]?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    const waId = change?.contacts?.[0]?.wa_id || msg?.from;

    // Ignore non-message events
    if (!msg || !waId) return res.sendStatus(200);

    const textBody = msg?.text?.body || "";
    const cmd = textBody.trim().toLowerCase();

    console.log("Inbound message:", { waId, textBody });

    // Lock down who can use it
    if (!isAdmin(waId)) {
      await sendWhatsAppText({ to: waId, body: "⛔ Not authorized." });
      return res.sendStatus(200);
    }

    if (cmd === "ping") {
      let moltbotOk = "unknown";
      try {
        const r = await fetch(`${MOLTBOT_INTERNAL_URL}/`, { method: "GET" });
        moltbotOk = r.ok ? "ok" : `http_${r.status}`;
      } catch {
        moltbotOk = "unreachable";
      }

      await sendWhatsAppText({
        to: waId,
        body: `🏓 Pong!\nWebhook: ok\nMoltbot: ${moltbotOk}`,
      });
      return res.sendStatus(200);
    }

    await sendWhatsAppText({
      to: waId,
      body: `✅ Received: "${textBody}"\nTry: ping`,
    });

    return res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    // Return 200 so Meta doesn't keep retrying while you debug
    return res.sendStatus(200);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`whatsapp-webhook listening on ${PORT}`);
});
