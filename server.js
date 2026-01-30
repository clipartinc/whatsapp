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
