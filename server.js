/**
 * CV PDF Backend - Puppeteer + @sparticuz/chromium
 * Generates PDF with guaranteed top/bottom margins on every page
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

/* Pagination + margin enforcement CSS injected into every PDF.
   Key trick: use @page margins (handled at PDF level, not browser level)
   AND wrap content so the CV's own backgrounds don't fill the margins. */
const PAGINATION_CSS = `
  /* Enforce 100px top/bottom margin on every printed page */
  @page {
    size: A4;
    margin: 100px 0;
  }
  
  /* Override the CV's own fixed-height styling that prevents
     proper multi-page flow */
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
  
  /* Print colors faithfully */
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

    // preferCSSPageSize: true makes Puppeteer respect the @page rule above
    // (which sets margin: 100px 0). This is more reliable than the
    // margin option in some content layouts.
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
