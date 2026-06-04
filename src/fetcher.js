/**
 * Fetcher Module
 * Resilient HTTP fetching with retries, timeouts, and user-agent rotation.
 * Returns raw text content for AI parsing (no fragile CSS selectors).
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// Rotate user agents to reduce blocking
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

let uaIndex = 0;
function nextUserAgent() {
  return USER_AGENTS[uaIndex++ % USER_AGENTS.length];
}

/**
 * Fetch a URL with timeout and retry.
 * Returns: { url, text, statusCode, error }
 */
async function fetchUrl(url, options = {}) {
  const { timeout = 20000, retries = 2, retryDelay = 3000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await _fetch(url, timeout);
      return { url, text, statusCode: 200, error: null };
    } catch (err) {
      if (attempt < retries) {
        console.log(`  ↻ Retry ${attempt + 1}/${retries} for ${url} (${err.message})`);
        await sleep(retryDelay);
      } else {
        return { url, text: null, statusCode: null, error: err.message };
      }
    }
  }
}

function _fetch(url, timeout) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === "https:" ? https : http;

    const req = lib.get(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        headers: {
          "User-Agent": nextUserAgent(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ro;q=0.8",
          "Accept-Encoding": "identity",
          Connection: "close",
        },
        timeout,
      },
      (res) => {
        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          req.destroy();
          resolve(_fetch(res.headers.location, timeout));
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 400) {
          req.destroy();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve(body);
        });
        res.on("error", reject);
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeout}ms`));
    });

    req.on("error", reject);
  });
}

/**
 * Strip HTML to plain text for AI consumption.
 * Preserves links and structural text, removes scripts/styles.
 */
function htmlToText(html) {
  if (!html) return "";

  return html
    // Remove scripts, styles, noscript
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    // Preserve link text with URLs
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "$2 [$1]")
    // Block elements → newlines
    .replace(/<\/?(div|p|section|article|h[1-6]|li|tr|br|header|footer|nav|main)[^>]*>/gi, "\n")
    // Remove remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€")
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Truncate text to roughly N characters while preserving sentence boundaries.
 */
function truncateText(text, maxChars = 12000) {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > maxChars * 0.8
    ? truncated.slice(0, lastPeriod + 1) + "\n[...content truncated for analysis]"
    : truncated + "\n[...content truncated for analysis]";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchUrl, htmlToText, truncateText, sleep };
