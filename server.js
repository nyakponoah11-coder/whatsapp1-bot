const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ENV
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;

// PACKAGES (FIXED)
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

// SESSION
let users = {};

// =========================
// VERIFY WEBHOOK
// =========================
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// =========================
// SUCCESS PAGE (FIX FORBIDDEN)
// =========================
app.get("/success", (req, res) => {
  res.send("Payment successful ✅ Data will be delivered shortly.");
});

// =========================
// WHATSAPP BOT
// =========================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();

  console.log("Incoming:", text);

  if (!users[from]) users[from] = {};

  let reply = "";

  // STEP 0 (FIXED)
  if (!users[from].step) {
    users[from].step = 1;

    reply = `Welcome to NestyDatagh 💙

1 - MTN Data
2 - Telecel Data`;
  }

  // STEP 1
  else if (users[from].step === 1) {
    if (text === "1") {
      users[from].network = "MTN";
      reply = `MTN Bundles:

1 - 1GB ₵6
2 - 2GB ₵12
3 - 5GB ₵27`;
      users[from].step = 2;
    } else if (text === "2") {
      users[from].network = "TELECEL";
      reply = `Telecel Bundles:

1 - 5GB ₵25
2 - 10GB ₵38`;
      users[from].step = 2;
    } else {
      reply = "Reply with 1 or 2";
    }
  }

  // STEP 2
  else if (users[from].step === 2) {
    users[from].bundle = text;
    users[from].step = 3;
    reply = "Enter your phone number:";
  }

  // STEP 3
  else if (users[from].step === 3) {
    users[from].number = text;

    const selected = PACKAGES[users[from].network][users[from].bundle];

    if (!selected) {
      reply = "Invalid choice. Start again.";
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
          reference: reference,
          callback_url: "https://whatsapp1-bot.onrender.com/success"
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`
          }
        }
      );

      reply = `Pay here:

${paystack.data.data.authorization_url}

After payment, data will be sent automatically ✅`;

      users[from].step = 0;
    }
  }

  // SEND MESSAGE
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
// PAYSTACK WEBHOOK
// =========================
app.post("/paystack-webhook", async (req, res) => {
  try {
    const event = req.body;

    console.log("EVENT:", event.event);
    console.log("ALL USERS:", users);

    if (event.event === "charge.success") {
      const reference = event.data.reference;
      console.log("REFERENCE:", reference);

      const user = Object.values(users).find(
        u => u.reference === reference
      );

      if (!user) {
        console.log("❌ USER NOT FOUND");
        return res.sendStatus(200);
      }

      console.log("📦 Sending:", user.number, user.size);

      const response = await axios.post(
        "https://datamartgh.shop/api/send",
        {
          number: user.number,
          data: user.size
        },
        {
          headers: {
            Authorization: `Bearer ${DATA_API_KEY}`
          }
        }
      );

      console.log("✅ DATA RESPONSE:", response.data);
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("❌ ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Bot running on port", PORT));
