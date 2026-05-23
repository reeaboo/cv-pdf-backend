/**
 * CV PDF Backend - Puppeteer + Express
 *
 * Receives rendered CV HTML from the frontend, generates a PDF with:
 * - 100px top margin on every page
 * - Sections never split awkwardly (headings stay with first item)
 * - Individual items don't split mid-paragraph
 * - Same result in every browser
 */

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow large CV HTML payloads
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Shared browser instance (faster than launching per-request)
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browserPromise;
}

/* ===== Pagination CSS injected into every PDF ===== */
const PAGINATION_CSS = `
  /* Don't split individual items mid-content (one job, one degree, etc.) */
  .item, .item-head, .experience-item, .education-item, .project-item,
  .reference-item, .skill-group {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Keep section headings with the first item below them
     (so "Experience" never sits alone at the bottom of a page) */
  h2, h3, .section-title {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* The sidebar in Creative template should stay as one block on page 1 */
  .sidebar {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Ensure backgrounds print (otherwise sidebar color disappears) */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
`;

/* ===== Health check (also used for warm-up) ===== */
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'cv-pdf-backend' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ===== Main PDF generation endpoint ===== */
app.post('/generate-pdf', async (req, res) => {
  const { html, filename } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'html field is required' });
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Inject pagination CSS into the HTML
    const fullHTML = html.replace(
      '</head>',
      `<style>${PAGINATION_CSS}</style></head>`
    );

    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '100px',
        bottom: '100px',
        left: '0',
        right: '0',
      },
      preferCSSPageSize: false,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(filename || 'CV').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'PDF generation failed', detail: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`CV PDF backend listening on port ${PORT}`);
});
