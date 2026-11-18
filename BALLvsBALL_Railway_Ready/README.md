# BALL vs BALL — Railway + GitHub deployment

## Deploy
1. Create a GitHub repository, upload all files in this folder to its root (not the ZIP).
2. In Railway, **New Project → Deploy from GitHub repo** and select that repository.
3. In Railway → Variables set `DEV_CODE` to a private secret code (do NOT share it publicly) and `DEV_SIGNING_SECRET` to a long random secret (at least 32 characters). Keep both out of GitHub.
4. Railway → Settings → Networking → Generate Domain. Open the URL.
5. Open the URL in two different browsers/devices. One creates an Online 1v1 room; the other joins using the code.
6. For a custom domain, add it under Railway Networking and follow the DNS records Railway gives you.

## What you need to send
No credentials, passwords, API tokens, or Railway account access. If you want help connecting a custom domain, share only the **public Railway URL** and your domain name. Do not share DEV_CODE or DEV_SIGNING_SECRET.

## Controls
Online host chooses ball, aims with mouse or arrows, locks aim and launches. Guest chooses ball and an angle slider in the room before pressing Ready. The host starts the match. The host simulates physics and streams battle state to the guest. This is a functioning **prototype**, not a secure server-authoritative ranked game. Host-side manipulation, latency and reconnection are not fully protected.

## Balls
Math Ball (125 coins): random addition and multiplication answers become damage. Laser Ball (175 coins): wall-bounce-to-wall-bounce laser segments, increasing damage. Prism Ball (225 coins): every 4th bounce emits a close-range burst. Fibonacci (250 coins). CELL and Harpoon remain DEV-only. Virus damage ticks every 0.5 seconds.

## Important
Guest coins and inventories are saved in their browser, not in a central database. Room state is stored in server memory and disappears when the Railway instance restarts. Deploy one Railway instance for this prototype. DEV2026 offline test code does not provide trusted online privileges; use your Railway DEV_CODE variable. The server verifies developer tokens but developer code redemption is intentionally available to anyone who knows that code, so keep it private.
