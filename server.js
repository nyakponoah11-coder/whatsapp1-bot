const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ENV VARIABLES
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY; // 🔥 DATA API KEY HERE

// SESSION STORAGE
let users = {};

// ===============================
// ✅ WHATSAPP WEBHOOK VERIFY
// ===============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ===============================
// 📩 WHATSAPP MESSAGES
// ===============================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();

  if (!users[from]) users[from] = {};

  let reply = "";

  // STEP 0
  if (!users[from].step) {
    users[from].step = 1;

    reply = `Welcome to stoNyservice 💙\n\n1 - MTN Data\n2 - Telecel Data`;
  }

  // STEP 1 - network
  else if (users[from].step === 1) {
    users[from].network = text;
    users[from].step = 2;

    reply = `Choose bundle:\n1 - 1GB ₵6\n2 - 2GB ₵12\n3 - 5GB ₵27`;
  }

  // STEP 2 - bundle
  else if (users[from].step === 2) {
    users[from].bundle = text;
    users[from].step = 3;

    reply = "Enter phone number:";
  }

  // STEP 3 - payment link
  else if (users[from].step === 3) {
    users[from].number = text;

    const reference = `stony_${from}_${Date.now()}`;
    users[from].reference = reference;

    let amount = 600;
    if (users[from].bundle === "2") amount = 1200;
    if (users[from].bundle === "3") amount = 2700;

    const paystack = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: "customer@email.com",
        amount: amount * 100,
        reference: reference
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
        },
      }
    );

    const link = paystack.data.data.authorization_url;

    reply = `Click to pay:\n${link}\n\nAfter payment, your data will be sent automatically ✅`;

    users[from].step = 0;
  }

  // SEND WHATSAPP MESSAGE
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: from,
      text: { body: reply },
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    }
  );

  res.sendStatus(200);
});

// ===============================
// 🔥 PAYSTACK WEBHOOK (IMPORTANT)
// ===============================
app.post("/paystack-webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.event === "charge.success") {

      const reference = event.data.reference;

      // Find user from reference
      const user = Object.values(users).find(
        (u) => u.reference === reference
      );

      if (!user) return res.sendStatus(200);

      console.log("💰 Payment successful for:", user.number);

      // ======================================
      // 🔥🔥🔥 DATA API LOCATION (IMPORTANT)
      // ======================================
      await axios.post(
        "https://datamartgh.shop/api/send", // 👈 YOUR DATA API URL
        {
          number: user.number,
          bundle: user.bundle
        },
        {
          headers: {
            Authorization: DATA_API_KEY // 👈 YOUR DATA API KEY HERE
          }
        }
      );
      // ======================================

      console.log("📦 Data sent successfully!");
    }

    res.sendStatus(200);

  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Bot running on port", PORT));
