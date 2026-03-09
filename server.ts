import express from "express";
import { createServer as createViteServer } from "vite";
import webPush from "web-push";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// In-memory storage for subscriptions (In a real app, use a database)
const subscriptions: any[] = [];

app.post("/api/notifications/subscribe", (req, res) => {
  const subscription = req.body;
  
  // Check if subscription already exists
  const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
  }
  
  res.status(201).json({ message: "Subscription added successfully." });
});

app.post("/api/notifications/send", (req, res) => {
  const { title, body, url } = req.body;
  const payload = JSON.stringify({ title, body, url });

  const promises = subscriptions.map(subscription => 
    webPush.sendNotification(subscription, payload).catch(err => {
      console.error("Error sending notification:", err);
      // Remove failed subscription if it's no longer valid
      if (err.statusCode === 410 || err.statusCode === 404) {
        const index = subscriptions.indexOf(subscription);
        if (index > -1) subscriptions.splice(index, 1);
      }
    })
  );

  Promise.all(promises)
    .then(() => res.status(200).json({ message: "Notifications sent." }))
    .catch(err => res.status(500).json({ error: err.message }));
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
