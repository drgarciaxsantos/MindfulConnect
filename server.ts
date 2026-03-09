import express from "express";
import { createServer as createViteServer } from "vite";
import webPush from "web-push";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Supabase client for backend
const supabaseUrl = process.env.SUPABASE_URL || 'https://ozolagmwrjesamwfmmoj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2xhZ213cmplc2Ftd2ZtbW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDExNDMsImV4cCI6MjA4MDQxNzE0M30.tg0NlDo8JCydXXphgNmYnnV7-4I1b6fPYcDhvIUA_ao';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(bodyParser.json());

// VAPID keys should be in .env
// If they are missing, we log them so the user can add them to .env
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  const vapidKeys = webPush.generateVAPIDKeys();
  console.log("========================================");
  console.log("VAPID Keys missing! Please add these to your .env file:");
  console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
  console.log("========================================");
  
  // For the sake of the demo, we'll use these generated keys if not provided
  webPush.setVapidDetails(
    "mailto:example@yourdomain.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} else {
  webPush.setVapidDetails(
    "mailto:example@yourdomain.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Routes for push notifications
app.post("/api/notifications/subscribe", async (req, res) => {
  const { subscription, userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ 
        user_id: userId, 
        subscription: subscription 
      }, { onConflict: 'user_id, subscription' });

    if (error) throw error;
    
    res.status(201).json({ message: "Subscription added successfully." });
  } catch (error: any) {
    console.error("Error saving subscription:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/notifications/send", async (req, res) => {
  const { title, body, url, userId } = req.body;
  const payload = JSON.stringify({ title, body, url });

  try {
    let query = supabase.from('push_subscriptions').select('subscription');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: dbSubscriptions, error } = await query;

    if (error) throw error;

    if (!dbSubscriptions || dbSubscriptions.length === 0) {
      return res.status(200).json({ message: "No subscriptions found." });
    }

    const promises = dbSubscriptions.map(sub => {
      const subscription = sub.subscription as any;
      return webPush.sendNotification(subscription, payload).catch(async err => {
        console.error("Error sending notification:", err);
        // Remove failed subscription if it's no longer valid
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .match({ subscription: subscription });
        }
      });
    });

    await Promise.all(promises);
    res.status(200).json({ message: "Notifications sent." });
  } catch (error: any) {
    console.error("Error sending notifications:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get public key for frontend
app.get("/api/notifications/public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || webPush.generateVAPIDKeys().publicKey });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
