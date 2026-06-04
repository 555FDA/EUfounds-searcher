/**
 * EU Funding Monitor — Main Orchestrator
 * 
 * Usage:
 *   node index.js              → Run once immediately
 *   node index.js --schedule   → Start scheduled daemon (uses CRON_SCHEDULE from .env)
 *   node index.js --dry-run    → Run analysis, skip email send, save HTML to ./output/
 */

require("dotenv").config();
const cron = require("node-cron");
const path = require("path");

const { SOURCES } = require("./src/sources");
const { fetchUrl, htmlToText, truncateText, sleep } = require("./src/fetcher");
const { analyzeSource, generateDigest } = require("./src/analyzer");
const { sendDigestEmail } = require("./src/mailer");
const {
  loadState, saveState, filterNewOpportunities,
  updateSourceHealth, saveRunReport
} = require("./src/state");

const OUTPUT_DIR = path.join(__dirname, "output");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_TO: process.env.EMAIL_TO,
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 8 * * 1", // Default: Monday 08:00
  LOOKBACK_DAYS: parseInt(process.env.LOOKBACK_DAYS || "7"),
  FETCH_DELAY_MS: 2500, // Polite delay between fetches
};

// ─── VALIDATION ───────────────────────────────────────────────────────────────

function validateConfig() {
  const missing = [];
  if (!CONFIG.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!CONFIG.EMAIL_FROM) missing.push("EMAIL_FROM");
  if (!CONFIG.EMAIL_PASSWORD) missing.push("EMAIL_PASSWORD");
  if (!CONFIG.EMAIL_TO) missing.push("EMAIL_TO");
  
  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables:\n   ${missing.join(", ")}`);
    console.error("   Copy .env.example to .env and fill in the values.\n");
    process.exit(1);
  }
}

// ─── CORE RUN ─────────────────────────────────────────────────────────────────

async function run(dryRun = false) {
  const startTime = Date.now();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`🇪🇺 EU FUNDING MONITOR — ${new Date().toISOString()}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN (no email)" : "LIVE"}`);
  console.log(`   Sources: ${SOURCES.length}`);
  console.log(`${"─".repeat(60)}\n`);

  const state = loadState();
  const results = [];

  // ── PHASE 1: Fetch & Analyze all sources ────────────────────────────────
  for (let i = 0; i < SOURCES.length; i++) {
    const source = SOURCES[i];
    const progress = `[${i + 1}/${SOURCES.length}]`;
    console.log(`${progress} ${source.priority === "HIGH" ? "🔴" : source.priority === "MEDIUM" ? "🟡" : "⚪"} ${source.name}`);
    console.log(`     URL: ${source.url}`);

    // Fetch
    const fetchResult = await fetchUrl(source.url, { timeout: 25000, retries: 2 });
    
    if (fetchResult.error || !fetchResult.text) {
      console.log(`     ✗ Fetch failed: ${fetchResult.error}`);
      updateSourceHealth(state, source.id, false, fetchResult.error);
      results.push({
        source_id: source.id,
        source_name: source.name,
        page_accessible: false,
        opportunities: [],
        summary: `Fetch failed: ${fetchResult.error}`,
        next_check_recommendation: "WEEKLY",
      });
    } else {
      // Convert to plain text and truncate
      const plainText = truncateText(htmlToText(fetchResult.text), 14000);
      console.log(`     ✓ Fetched ${plainText.length.toLocaleString()} chars → sending to AI...`);

      // AI Analysis
      const analysis = await analyzeSource(source, plainText, CONFIG.ANTHROPIC_API_KEY);
      updateSourceHealth(state, source.id, true);

      const opCount = analysis.opportunities?.length || 0;
      console.log(`     → ${opCount} relevant opportunit${opCount === 1 ? "y" : "ies"} found`);
      if (opCount > 0) {
        analysis.opportunities.forEach((o) => {
          console.log(`        • [${o.status}/${o.relevance_score}/10] ${o.title}`);
        });
      }
      results.push(analysis);
    }

    // Polite delay between requests
    if (i < SOURCES.length - 1) await sleep(CONFIG.FETCH_DELAY_MS);
  }

  // ── PHASE 2: Deduplicate against seen state ──────────────────────────────
  const allOpportunities = results.flatMap((r) => r.opportunities || []);
  const newOpportunities = filterNewOpportunities(allOpportunities, state, CONFIG.LOOKBACK_DAYS);

  console.log(`\n📊 Analysis complete:`);
  console.log(`   Sources checked: ${results.length}`);
  console.log(`   Accessible: ${results.filter((r) => r.page_accessible !== false).length}`);
  console.log(`   Total opportunities: ${allOpportunities.length}`);
  console.log(`   New this period: ${newOpportunities.length}`);

  // ── PHASE 3: Generate digest ─────────────────────────────────────────────
  // Replace opportunities in results with only new ones for digest
  const resultsWithNew = results.map((r) => ({
    ...r,
    opportunities: (r.opportunities || []).filter((o) =>
      newOpportunities.some((n) => n.title === o.title && n.programme === o.programme)
    ),
  }));

  const period = CONFIG.LOOKBACK_DAYS <= 1 ? "daily" : CONFIG.LOOKBACK_DAYS <= 7 ? "weekly" : "monthly";
  
  let digest;
  if (newOpportunities.length === 0) {
    // Send a brief "all clear" digest
    digest = {
      subject: `EU Funding Monitor — ${new Date().toLocaleDateString("en-GB")} | No new opportunities`,
      body_html: `<h2>No New Opportunities This Period</h2>
<p>All ${allOpportunities.length} identified opportunities were already reported in the previous digest.</p>
<p><strong>Sources monitored:</strong> ${results.length} (${results.filter(r => r.page_accessible !== false).length} accessible)</p>
<p>The monitor continues to track all sources. Next check: ${CONFIG.CRON_SCHEDULE}</p>`,
      body_text: `No new funding opportunities this ${period}. ${allOpportunities.length} known opportunities tracked across ${results.length} sources.`,
    };
  } else {
    console.log("\n🤖 Generating AI digest email...");
    digest = await generateDigest(resultsWithNew, CONFIG.ANTHROPIC_API_KEY, period);
  }

  // ── PHASE 4: Save report ─────────────────────────────────────────────────
  const reportPath = saveRunReport(results, digest, OUTPUT_DIR);
  console.log(`\n💾 Report saved: ${reportPath}`);

  // ── PHASE 5: Send email ──────────────────────────────────────────────────
  if (!dryRun) {
    console.log(`\n📧 Sending email to: ${CONFIG.EMAIL_TO}`);
    try {
      const info = await sendDigestEmail(digest, CONFIG);
      console.log(`   ✓ Email sent: ${info.messageId}`);
    } catch (err) {
      console.error(`   ✗ Email failed: ${err.message}`);
      console.error("   The HTML digest is saved to ./output/latest-digest.html");
    }
  } else {
    console.log("\n📄 DRY RUN: Email not sent. Check ./output/latest-digest.html");
  }

  // ── Persist state ────────────────────────────────────────────────────────
  state.last_run = new Date().toISOString();
  state.run_count = (state.run_count || 0) + 1;
  saveState(state);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Run complete in ${elapsed}s\n`);
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isScheduled = args.includes("--schedule");
const isDryRun = args.includes("--dry-run");

validateConfig();

if (isScheduled) {
  console.log(`\n🕐 EU Funding Monitor — Scheduled Mode`);
  console.log(`   Schedule: ${CONFIG.CRON_SCHEDULE}`);
  console.log(`   Email: ${CONFIG.EMAIL_TO}`);
  console.log(`   Waiting for next trigger...\n`);

  if (!cron.validate(CONFIG.CRON_SCHEDULE)) {
    console.error(`❌ Invalid cron expression: ${CONFIG.CRON_SCHEDULE}`);
    process.exit(1);
  }

  // Run immediately on start, then on schedule
  run(isDryRun).catch(console.error);

  cron.schedule(CONFIG.CRON_SCHEDULE, () => {
    run(isDryRun).catch(console.error);
  });
} else {
  // Single run
  run(isDryRun).catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
