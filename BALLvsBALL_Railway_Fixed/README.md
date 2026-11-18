# BALL vs BALL — Railway build fix

This package fixes the deprecated `NIXPACKS` builder in `railway.json` by using `RAILPACK`.

## Important: GitHub folder location

Put `index.html`, `server.js`, `package.json`, and `railway.json` together in the **repository root** (not inside an extra ZIP or nested folder), OR set Railway service **Settings → Source → Root Directory** to the folder containing `package.json` (e.g. `/BALLvsBALL_Railway_Ready`).

## Deploy

1. Connect the GitHub repo to Railway.
2. Set service **Settings → Build → Builder: Railpack**.
3. Set **Start Command** to `node server.js` if Railway doesn't detect it automatically.
4. Add environment variables `DEV_CODE` and `DEV_SIGNING_SECRET` (use private values; do not publish them).
5. Deploy and create a public domain under **Settings → Networking**.
6. Visit `<your-url>/health`. Expected response includes `"ok":true`.

If it fails, open **View logs → Build logs** and look at the first detailed error line.

Note: This is a prototype room-based multiplayer service. Critical outcomes are currently host-driven and not fully cheat-resistant. Avoid marketing it as secure or production hardened.
