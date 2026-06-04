/**
 * GitHub Writer Module
 * Commits the structured opportunities data back to the repo as data/opportunities.json
 * This makes the data accessible to the Vercel web app without any external database.
 */

const https = require("https");

const GITHUB_API = "api.github.com";
const REPO_OWNER = "555FDA";
const REPO_NAME = "EUfounds-searcher";
const DATA_FILE_PATH = "data/opportunities.json";

/**
 * Write opportunities data to the GitHub repo.
 * Creates or updates data/opportunities.json on the main branch.
 */
async function writeOpportunitiesToRepo(allResults, token) {
  if (!token) {
    console.log("  ⚠ GH_PAT not set — skipping GitHub data write");
    return false;
  }

  try {
    // Build the structured data payload
    const opportunities = allResults
      .flatMap((r) =>
        (r.opportunities || []).map((o) => ({
          ...o,
          source_name: r.source_name,
          source_id: r.source_id,
        }))
      )
      .filter((o) => o.relevance_score >= 4)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    const payload = {
      last_updated: new Date().toISOString(),
      run_date: new Date().toLocaleDateString("en-GB", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric"
      }),
      total_opportunities: opportunities.length,
      urgent_count: opportunities.filter((o) => o.deadline_urgency === "HIGH").length,
      open_count: opportunities.filter((o) => o.status === "OPEN").length,
      sources_checked: allResults.length,
      sources_accessible: allResults.filter((r) => r.page_accessible !== false).length,
      opportunities,
    };

    const content = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");

    // Check if file already exists (need its SHA to update)
    let existingSha = null;
    try {
      const existing = await githubApiGet(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`, token);
      existingSha = existing.sha;
    } catch (e) {
      // File doesn't exist yet — will create it
    }

    // Create or update the file
    const body = {
      message: `chore: update funding opportunities [${new Date().toISOString().slice(0, 10)}]`,
      content,
      branch: "main",
    };
    if (existingSha) body.sha = existingSha;

    await githubApiPut(
      `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`,
      body,
      token
    );

    console.log(`  ✓ Opportunities written to repo: ${DATA_FILE_PATH}`);
    console.log(`    ${opportunities.length} opportunities, ${payload.urgent_count} urgent`);
    return true;
  } catch (err) {
    console.error(`  ✗ GitHub write failed: ${err.message}`);
    return false;
  }
}

function githubApiGet(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GITHUB_API,
      path,
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "eu-funding-monitor",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode === 404) { reject(new Error("Not found")); return; }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function githubApiPut(path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: GITHUB_API,
      path,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "eu-funding-monitor",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`GitHub API ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
          return;
        }
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      });
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

module.exports = { writeOpportunitiesToRepo };
