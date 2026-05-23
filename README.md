# CV PDF Backend

Generates CV PDFs using Puppeteer. Deployed on Render.com free tier.

## Files

- `server.js` — The actual server. Receives HTML, returns PDF.
- `package.json` — Lists dependencies (Express, Puppeteer, CORS).
- `render.yaml` — Tells Render how to install and run.
- `.gitignore` — Excludes `node_modules` from git.

## Endpoints

- `GET /` — Health check (also wakes the server from sleep)
- `POST /generate-pdf` — Body: `{ html: "...", filename: "MyName" }`. Returns PDF.

## How it produces clean pagination

1. `margin: { top: '100px', ... }` — Every page starts 100px from top
2. `break-inside: avoid` on `.item` — Individual jobs/degrees stay intact
3. `break-after: avoid` on `h2` — Section headings stay with first item below
