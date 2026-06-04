/**
 * State Manager
 * Persists seen opportunity IDs to disk to avoid re-alerting on duplicates.
 * Also tracks source health (last success, failure count).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STATE_FILE = path.join(__dirname, "../output/state.json");

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (e) {
    console.warn("Could not load state file, starting fresh.");
  }
  return {
    seen_opportunities: {},
    source_health: {},
    last_run: null,
    run_count: 0,
  };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Generate a stable ID for an opportunity (for deduplication).
 */
function opportunityId(opp) {
  const key = `${opp.title || ""}_${opp.programme || ""}_${opp.deadline || ""}`;
  return crypto.createHash("md5").update(key).digest("hex").slice(0, 12);
}

/**
 * Filter out opportunities already seen within the lookback window.
 * Mark new ones as seen.
 */
function filterNewOpportunities(opportunities, state, lookbackDays = 7) {
  const now = Date.now();
  const cutoff = now - lookbackDays * 24 * 60 * 60 * 1000;

  const newOnes = [];
  for (const opp of opportunities) {
    const id = opportunityId(opp);
    const seenAt = state.seen_opportunities[id];
    if (!seenAt || seenAt < cutoff) {
      newOnes.push({ ...opp, _is_new: !seenAt, _id: id });
      state.seen_opportunities[id] = now;
    }
  }

  // Clean old entries (> 90 days)
  const cutoff90 = now - 90 * 24 * 60 * 60 * 1000;
  for (const [id, ts] of Object.entries(state.seen_opportunities)) {
    if (ts < cutoff90) delete state.seen_opportunities[id];
  }

  return newOnes;
}

/**
 * Update source health tracking.
 */
function updateSourceHealth(state, sourceId, success, error = null) {
  if (!state.source_health[sourceId]) {
    state.source_health[sourceId] = { successes: 0, failures: 0, last_success: null, last_error: null };
  }
  const h = state.source_health[sourceId];
  if (success) {
    h.successes++;
    h.last_success = new Date().toISOString();
    h.consecutive_failures = 0;
  } else {
    h.failures++;
    h.last_error = error;
    h.consecutive_failures = (h.consecutive_failures || 0) + 1;
  }
}

/**
 * Save a run report to disk for audit trail.
 */
function saveRunReport(results, digest, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(outputDir, `run-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp, results, digest_subject: digest?.subject }, null, 2));
  
  // Also save the latest email as HTML for review
  if (digest?.body_html) {
    const htmlPath = path.join(outputDir, "latest-digest.html");
    fs.writeFileSync(htmlPath, `<!DOCTYPE html><html><body>${digest.body_html}</body></html>`);
  }
  
  return reportPath;
}

module.exports = { loadState, saveState, filterNewOpportunities, updateSourceHealth, opportunityId, saveRunReport };
