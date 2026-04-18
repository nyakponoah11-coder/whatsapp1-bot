const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// =========================
// 🔐 ENV VARIABLES
// =========================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;

// =========================
// 📦 PACKAGES (PRICE + SIZE)
// =========================
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 600 },
    "2": { size: "2GB", price: 1200 },
    "3": { size: "5GB", price: 2700 }
  },
  TELECEL: {
    "1": { size: "5GB", price: 2500 },
    "2": { size: "10GB", price: 3800 }
  }
};

// =========================
// 💾 SESSION STORAGE
// =========================
let users = {};

// =========================
// 🔍 WEBHOOK VERIFY
// =========================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =========================
// 📩 WHATSAPP BOT
// =========================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();

  if (!users[from]) users[from] = { step: 0 };

  let reply = "";

  // STEP 0
  if (users[from].step === 0) {
    users[from].step = 1;

    reply = `Welcome to NestyDatagh 💙

1 - MTN Data
2 - Telecel Data`;
  }

  // STEP 1
  else if (users[from].step === 1) {
    if (text === "1") {
      users[from].network = "MTN";
      users[from].step = 2;

      reply = `MTN Bundles:

1 - 1GB ₵6
2 - 2GB ₵12
3 - 5GB ₵27`;
    } 
    else if (text === "2") {
      users[from].network = "TELECEL";
      users[from].step = 2;

      reply = `Telecel Bundles:

1 - 5GB ₵25
2 - 10GB ₵38`;
    } 
    else {
      reply = "Please reply with 1 or 2";
    }
  }

  // STEP 2
  else if (users[from].step === 2) {
    users[from].bundle = text;
    users[from].step = 3;

    reply = "Enter your phone number:";
  }

  // STEP 3 (PAYMENT)
  else if (users[from].step === 3) {
    users[from].number = text;

    const network = users[from].network;
    const bundle = users[from].bundle;

    const selected = PACKAGES[network][bundle];

    if (!selected) {
      reply = "Invalid selection. Restart.";
      users[from].step = 0;
    } else {
      const reference = `stony_${from}_${Date.now()}`;

      users[from].reference = reference;
      users[from].size = selected.size;

      const paystack = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: "customer@email.com",
          amount: selected.price * 100,
          reference: reference
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`
          }
        }
      );

      const link = paystack.data.data.authorization_url;

      reply = `💰 Pay here:

${link}

📦 You selected: ${selected.size}`;

      users[from].step = 0;
    }
  }

  // SEND WHATSAPP MESSAGE
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: from,
      text: { body: reply }
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    }
  );

  res.sendStatus(200);
});

// =========================
// 🔥 PAYSTACK WEBHOOK
// =========================
app.post("/paystack-webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.event === "charge.success") {

      const reference = event.data.reference;

      const user = Object.values(users).find(
        u => u.reference === reference
      );

      if (!user) {
        console.log("❌ User not found");
        return res.sendStatus(200);
      }

      console.log("✅ Payment confirmed for:", user.number, user.size);

      // ======================================
      // 🔥🔥🔥 DATA API LOCATION (IMPORTANT)
      // ======================================
      const response = await axios.post(
        "https://datamartgh.shop/api/send",   // 👈 DATA API URL
        {
          number: user.number,  // 👈 USER PHONE
          data: user.size       // 👈 ONLY DATA SIZE (NO PRICE)
        },
        {
          headers: {
            Authorization: `Bearer c18a0bb13875dc81431aa545a8bb458b02d423a09c3f54e92a5b1e392c57daa7`  // 👈 API KEY HERE
          }
        }
      );
      // ======================================

      console.log("📦 Data API response:", response.data);
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("❌ Error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// =========================
// 🚀 START SERVER
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Bot running on port", PORT));
