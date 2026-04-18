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

// PACKAGES (FIXED PRICES)
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

let users = {};

// VERIFY
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// SUCCESS PAGE (FIX FOR FORBIDDEN)
app.get("/success", (req, res) => {
  res.send("Payment successful ✅ Data will be delivered shortly.");
});

// BOT
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();

  if (!users[from]) users[from] = { step: 0 };

  let reply = "";

  if (users[from].step === 0) {
    users[from].step = 1;
    reply = "1 - MTN\n2 - TELECEL";
  }

  else if (users[from].step === 1) {
    users[from].network = text === "1" ? "MTN" : "TELECEL";
    users[from].step = 2;
    reply = "1 - 1GB\n2 - 2GB\n3 - 5GB";
  }

  else if (users[from].step === 2) {
    users[from].bundle = text;
    users[from].step = 3;
    reply = "Enter phone number";
  }

  else if (users[from].step === 3) {
    users[from].number = text;

    const selected = PACKAGES[users[from].network][users[from].bundle];
    const reference = `stony_${from}_${Date.now()}`;

    users[from].reference = reference;
    users[from].size = selected.size;

    const paystack = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: "customer@email.com",
        amount: selected.price * 100,
        reference: reference,
        callback_url: "https://whatsapp1-bot.onrender.com/success" // FIX
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`
        }
      }
    );

    reply = paystack.data.data.authorization_url;
    users[from].step = 0;
  }

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

// PAYSTACK WEBHOOK (FIXED DEBUG)
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
            Authorization: `Bearer ${DATA_API_KEY}` // FIX
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

app.listen(3000, () => console.log("Bot running"));
