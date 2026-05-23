/**
 * CV PDF Backend - Puppeteer + Express
 * Uses @sparticuz/chromium - a Chromium bundle for serverless/cloud environments
 */

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cors());

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  return browserPromise;
}

const PAGINATION_CSS = `
  .item, .item-head, .experience-item, .education-item, .project-item,
  .reference-item, .skill-group {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  h2, h3, .section-title {
    break-after: avoid;
    page-break-after: avoid;
  }
  .sidebar {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
`;

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'cv-pdf-backend' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/generate-pdf', async (req, res) => {
  const { html, filename } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'html field is required' });
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

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
