import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PACKAGES } from "@/lib/packages";

async function sendWhatsApp(to: string, body: string) {
  const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
  const PHONE_ID = process.env.PHONE_ID;
  if (!ACCESS_TOKEN || !PHONE_ID) return;

  await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body },
    }),
  }).catch((e) => console.error("WhatsApp notify failed:", e));
}

async function deliverData(
  phoneNumber: string,
  apiNetwork: string,
  capacity: string,
) {
  const DATA_API_KEY = process.env.DATA_API_KEY;
  if (!DATA_API_KEY) throw new Error("DATA_API_KEY not configured");

  const res = await fetch(
    "https://api.datamartgh.shop/api/developer/purchase",
    {
      method: "POST",
      headers: {
        "X-API-Key": DATA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber,
        network: apiNetwork,
        capacity,
        gateway: "wallet",
      }),
    },
  );

  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`Datamart API failed [${res.status}]: ${txt}`);
  }

  try {
    const json = JSON.parse(txt) as { status?: string; message?: string };
    if (json.status && json.status !== "success") {
      throw new Error(`Datamart rejected: ${json.message || txt}`);
    }
  } catch {
    // non-JSON response — treat 2xx as success
  }
  return txt;
}

export const Route = createFileRoute("/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
        if (!PAYSTACK_SECRET) {
          console.error("PAYSTACK_SECRET not configured");
          return new Response("Server misconfigured", { status: 500 });
        }

        // Verify Paystack signature
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature") || "";
        const expected = crypto
          .createHmac("sha512", PAYSTACK_SECRET)
          .update(rawBody)
          .digest("hex");

        if (signature !== expected) {
          console.error("Invalid Paystack signature");
          return new Response("Unauthorized", { status: 401 });
        }

        let event: { event?: string; data?: { reference?: string } };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        if (event.event !== "charge.success" || !event.data?.reference) {
          return new Response("ok", { status: 200 });
        }

        const reference = event.data.reference;

        // Look up the order
        const { data: order, error: lookupErr } = await supabaseAdmin
          .from("orders")
          .select("*")
          .eq("reference", reference)
          .maybeSingle();

        if (lookupErr || !order) {
          console.error("Order not found for reference:", reference);
          return new Response("ok", { status: 200 });
        }

        // Mark paid
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "paid" })
          .eq("reference", reference);

        // Deliver via Datamart
        try {
          const bundles = PACKAGES[order.network] || {};
          const bundle = Object.values(bundles).find(
            (b) => b.size === order.bundle_size,
          );

          if (!bundle) {
            throw new Error(
              `Unknown bundle: ${order.network} ${order.bundle_size}`,
            );
          }

          await deliverData(
            order.recipient_number,
            bundle.apiNetwork,
            bundle.capacity,
          );

          await supabaseAdmin
            .from("orders")
            .update({ delivery_status: "delivered" })
            .eq("reference", reference);

          await sendWhatsApp(
            order.whatsapp_from,
            `✅ Payment received!\n\n${order.bundle_size} (${order.network}) is on the way to ${order.recipient_number}.\n\nThank you for choosing NestyDatagh 💙`,
          );

          console.log("✅ Delivered:", order.recipient_number, order.bundle_size);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("Delivery failed:", msg);

          await supabaseAdmin
            .from("orders")
            .update({
              delivery_status: "failed",
              delivery_error: msg.slice(0, 500),
            })
            .eq("reference", reference);

          await sendWhatsApp(
            order.whatsapp_from,
            `⚠️ Payment received, but delivery is delayed for ${order.bundle_size}.\n\nOur team has been notified and will deliver shortly. Reference: ${reference}`,
          );
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
