/**
 * CV PDF Backend - Puppeteer + @sparticuz/chromium
 * 
 * Approach: Use Puppeteer's margin option (works at PDF level)
 * with 0 margin on the first page (CV's own design handles page 1)
 * and 100px margin on subsequent pages.
 * 
 * Since Puppeteer doesn't support per-page margin natively,
 * we use a hybrid CSS + margin approach.
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

/* Pagination CSS:
   - @page :first sets ZERO margin on page 1 (CV design fills the page)
   - @page :not(:first) sets 100px top margin on page 2+ (breathing room)
   - break-inside: avoid keeps sections together */
const PAGINATION_CSS = `
  @page {
    size: A4;
    margin: 0;
  }
  
  @page :first {
    margin: 0;
  }
  
  @page :not(:first) {
    margin-top: 100px;
    margin-bottom: 100px;
  }
  
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
  
  .cv, .cv.template-creative {
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
    page-break-after: auto !important;
  }
  
  /* Sections never split mid-content */
  .item, .item-head, .experience-item, .education-item, .project-item,
  .reference-item, .skill-group {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  
  /* Section headings stay with first item below */
  h2, h3, .section-title {
    break-after: avoid !important;
    page-break-after: avoid !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
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
      preferCSSPageSize: true,
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
