import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";

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

// Meta events (validate X-Hub-Signature-256)
app.post("/meta/whatsapp", express.raw({ type: "*/*" }), (req, res) => {
  const sig = req.get("X-Hub-Signature-256") || "";

  if (META_APP_SECRET) {
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", META_APP_SECRET).update(req.body).digest("hex");

    if (sig !== expected) return res.status(403).send("Invalid signature");
  }

  console.log("Meta webhook payload:", req.body.toString("utf8").slice(0, 2000));
  return res.sendStatus(200);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`whatsapp-webhook listening on ${PORT}`);
});
