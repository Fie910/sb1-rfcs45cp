import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const VAPID_KEYS_JSON = Deno.env.get("WEB_PUSH_VAPID_KEYS") || "";
const VAPID_SUBJECT = "mailto:admin@sekolah.sch.id";

// Tipe notifikasi yang TIDAK dikirim sebagai push.
// Harus SINKRON dengan NON_PUSH_TIPE di src/lib/notification.ts
const NON_PUSH_TIPE = new Set(["pengumuman", "kegiatan", "buku_tamu"]);

let appServerPromise: Promise<webpush.ApplicationServer> | null = null;

async function getAppServer(): Promise<webpush.ApplicationServer> {
  if (appServerPromise) return appServerPromise;

  appServerPromise = (async () => {
    const exportedVapidKeys = JSON.parse(VAPID_KEYS_JSON);
    const vapidKeys = await webpush.importVapidKeys(exportedVapidKeys, {
      extractable: false,
    });
    return await webpush.ApplicationServer.new({
      contactInformation: VAPID_SUBJECT,
      vapidKeys,
    });
  })();

  return appServerPromise;
}

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record || !record.guru_id) {
      return new Response(JSON.stringify({ error: "Payload tidak valid" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Filter: skip tipe yang tidak perlu push
    if (record.tipe && NON_PUSH_TIPE.has(record.tipe)) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          reason: "non_push_tipe",
          tipe: record.tipe,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const res = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?guru_id=eq.${record.guru_id}&select=endpoint,p256dh,auth`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    const subscriptions = await res.json();

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "no_subscription" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const appServer = await getAppServer();

    const payload = JSON.stringify({
      title: record.judul,
      body: record.pesan,
      url: record.tautan || "/",
    });

    let sent = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        const subscriber = appServer.subscribe({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        });

        await subscriber.pushTextMessage(payload, {});
        sent++;
      } catch (err) {
        const msg = (err as Error).message || "unknown error";
        errors.push(`${sub.endpoint.slice(0, 50)}...: ${msg}`);

        if (msg.includes("410") || msg.includes("404")) {
          await fetch(
            `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(
              sub.endpoint
            )}`,
            {
              method: "DELETE",
              headers: {
                apikey: supabaseServiceKey,
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
            }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, total: subscriptions.length, errors }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});