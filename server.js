const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// =========================
// ENV
// =========================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;

// =========================
// PACKAGES
// =========================
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 1 },
    "2": { size: "2GB", price: 1200 },
    "3": { size: "5GB", price: 2700 }
  },
  TELECEL: {
    "1": { size: "5GB", price: 2500 },
    "2": { size: "10GB", price: 3800 }
  }
};

// =========================
// TEMP STORAGE (IMPORTANT)
// =========================
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
// WHATSAPP BOT
// =========================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();

  if (!users[from]) users[from] = {};

  let reply = "";

  if (!users[from].step) {
    users[from].step = 1;
    reply = "1 - MTN\n2 - TELECEL";
  }

  else if (users[from].step === 1) {
    users[from].network = text === "1" ? "MTN" : "TELECEL";
    users[from].step = 2;

    reply = "Select bundle:\n1 - 1GB\n2 - 2GB\n3 - 5GB";
  }

  else if (users[from].step === 2) {
    users[from].bundle = text;
    users[from].step = 3;

    reply = "Send phone number";
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
        reference
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

// =========================
// PAYSTACK WEBHOOK
// =========================
app.post("/paystack-webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.event === "charge.success") {

      const reference = event.data.reference;

      // 🔥 FIND USER IN MEMORY
      const userKey = Object.keys(users).find(
        k => users[k].reference === reference
      );

      if (!userKey) return res.sendStatus(200);

      const user = users[userKey];

      // =========================
      // 🔥 DATA API (THIS IS THE ONLY IMPORTANT PART)
      // =========================
      await axios.post(
        "https://datamartgh.shop/api/send",
        {
          number: user.number,
          data: user.size
        },
        {
          headers: {
            Authorization: "Bearer c18a0bb13875dc81431aa545a8bb458b02d423a09c3f54e92a5b1e392c57daa7"
          }
        }
      );

      console.log("✅ DATA SENT:", user.number, user.size);

      // clear user after success
      delete users[userKey];
    }

    res.sendStatus(200);

  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
});

// =========================
// START SERVER
// =========================
app.listen(3000, () => console.log("Bot running"));
