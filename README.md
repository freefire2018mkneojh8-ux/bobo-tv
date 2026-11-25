# Bobo TV

Random video chat with AI translation. Node.js server + installable web app (PWA).

## Run locally
    npm install
    npm start
Open http://localhost:3000 (dev mode: no Google login needed when GOOGLE_CLIENT_ID is empty).
Camera only works on https or localhost.

## Deploy (so it works on your phone and for the world)
1. Put all these files (flat, no folders) in a GitHub repo.
2. Create a Web Service on Render, Railway or Fly.io. Build: `npm install`. Start: `npm start`. You get an https URL.
3. Set environment variables:
   - GOOGLE_CLIENT_ID: Google Cloud Console > APIs & Services > Credentials > OAuth client ID (Web). Add your https URL under Authorized JavaScript origins.
   - ANTHROPIC_API_KEY: for AI translation (kept on the server only).
   - ICE_SERVERS: JSON list with a TURN server so calls work on every network, e.g.
     [{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:YOUR_TURN_HOST:443","username":"USER","credential":"PASS"}]
     (get one from Metered, Twilio or Cloudflare).
4. Open the URL on your phone.
   - Android Chrome: menu > Install app.
   - iPhone Safari: Share > Add to Home Screen.

## Before public launch
Add real moderation (video scanning, a review team), a privacy policy and terms, and account deletion. Reports are only logged and auto-suspend after 3 reports. Counts are in memory; use a database for production.

## Store apps later
Wrap the same site with Capacitor (iOS/Android) or Bubblewrap/TWA (Android) and publish to the stores.
