const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// =========================
// 🔐 ENV
// =========================
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

// =========================
// 📡 CONNECT DATABASE
// =========================
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// =========================
// 📦 ORDER MODEL
// =========================
const orderSchema = new mongoose.Schema({
  from: String,
  number: String,
  network: String,
  bundle: String,
  size: String,
  reference: String,
  status: { type: String, default: "pending" }
});

const Order = mongoose.model("Order", orderSchema);

// =========================
// 📦 PACKAGES
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
// 🔍 VERIFY WEBHOOK
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
// 📩 WHATSAPP BOT
// =========================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body?.trim();

  let reply = "";

  // STEP 0
  if (text === "hi" || text === "menu") {
    reply = `Welcome 💙

1 - MTN Data
2 - Telecel Data`;
  }

  // STEP 1
  else if (text === "1") {
    reply = `MTN:

1 - 1GB ₵6
2 - 2GB ₵12
3 - 5GB ₵27`;
  }

  else if (text === "2") {
    reply = `Telecel:

1 - 5GB ₵25
2 - 10GB ₵38`;
  }

  // STEP 2 (bundle selection)
  else if (["1","2","3"].includes(text)) {
    await Order.create({
      from,
      bundle: text
    });

    reply = "Enter your phone number:";
  }

  // STEP 3 (phone number)
  else {
    const lastOrder = await Order.findOne({ from }).sort({ _id: -1 });

    if (lastOrder && !lastOrder.number) {
      const network = text.length > 10 ? "TELECEL" : "MTN";
      const selected = PACKAGES[network][lastOrder.bundle];

      const reference = `stony_${Date.now()}`;

      lastOrder.number = text;
      lastOrder.network = network;
      lastOrder.size = selected.size;
      lastOrder.reference = reference;

      await lastOrder.save();

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

      reply = `Pay here:\n${paystack.data.data.authorization_url}`;
    }
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
// 🔥 PAYSTACK WEBHOOK (DATA DELIVERY)
// =========================
app.post("/paystack-webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.event === "charge.success") {

      const reference = event.data.reference;

      const order = await Order.findOne({ reference });

      if (!order) return res.sendStatus(200);

      // =========================
      // 🔥 DATA API (HERE IS THE PLACE)
      // =========================
      await axios.post(
        "https://datamartgh.shop/api/send",
        {
          number: order.number,
          data: order.size
        },
        {
          headers: {
            Authorization: `Bearer c18a0bb13875dc81431aa545a8bb458b02d423a09c3f54e92a5b1e392c57daa7`
          }
        }
      );

      order.status = "completed";
      await order.save();

      console.log("✅ Data sent successfully");
    }

    res.sendStatus(200);

  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
});

// =========================
// 🚀 START
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Bot running"));
