/**
 * AI Analyzer Module
 * Uses Claude API to intelligently extract funding opportunities from raw page content.
 * This is the core differentiator vs. brittle regex scraping.
 */

const https = require("https");
const { RELEVANCE_KEYWORDS } = require("./sources");

const ANTHROPIC_API_URL = "api.anthropic.com";
const MODEL = "claude-sonnet-4-20250514";

/**
 * Analyze a single source page and extract funding opportunities.
 */
async function analyzeSource(source, pageText, apiKey) {
  const keywords = RELEVANCE_KEYWORDS.join(", ");

  const prompt = `You are an EU funding analyst specializing in sustainable maritime transport, inland waterway vessels, and green fleet modernization. 

SOURCE: ${source.name}
URL: ${source.url}
SOURCE PRIORITY: ${source.priority}
SOURCE CONTEXT: ${source.note}

CONTEXT FOR RELEVANCE:
The client is a Romanian company (Bavaria Yachts Romania dealer) looking for EU, Romanian state, or international funding opportunities to finance:
- Purchase of electric-powered boats (tourist/recreational on Danube)
- Low-emission vessel fleet modernization
- Inland waterway sustainability projects in Romania
- Danube-related green transport infrastructure
- Any applicable SME grants or state aid for vessel acquisition

RELEVANCE KEYWORDS: ${keywords}

PAGE CONTENT:
---
${pageText}
---

TASK:
Extract all relevant funding opportunities, open calls, upcoming deadlines, or important announcements from this page content.

Return a JSON object with this exact structure:
{
  "source_id": "${source.id}",
  "source_name": "${source.name}",
  "page_accessible": true or false,
  "opportunities": [
    {
      "title": "Name of the call/programme/opportunity",
      "programme": "Programme name (e.g. Interreg, CEF, PNRR)",
      "status": "OPEN" | "UPCOMING" | "CLOSED" | "ONGOING" | "UNKNOWN",
      "deadline": "Date if found, otherwise null",
      "budget": "Total budget or max grant if mentioned",
      "support_intensity": "% grant coverage if mentioned",
      "eligible_actions": "Brief description of what is funded",
      "relevance_score": 1-10 (10 = perfectly matches electric boats on Danube for Romanian SME),
      "relevance_reason": "Why this is or isn't relevant",
      "apply_url": "Direct application URL if found",
      "key_info": "2-3 sentences of critical information for the client"
    }
  ],
  "summary": "1-2 sentence summary of what this source currently offers",
  "next_check_recommendation": "DAILY" | "WEEKLY" | "MONTHLY" (based on how dynamic this source is)
}

IMPORTANT:
- If the page is a 403, empty, or clearly blocked, set page_accessible: false and opportunities: []
- Only include opportunities with relevance_score >= 4
- If no relevant opportunities found, return empty opportunities array
- Do not invent information. Only extract what is explicitly on the page.
- Return ONLY the JSON object, no markdown fences, no explanation.`;

  try {
    const response = await callClaudeAPI(prompt, apiKey);
    const parsed = JSON.parse(response);
    return parsed;
  } catch (err) {
    console.error(`  ✗ AI analysis failed for ${source.id}: ${err.message}`);
    return {
      source_id: source.id,
      source_name: source.name,
      page_accessible: false,
      opportunities: [],
      summary: `Analysis failed: ${err.message}`,
      next_check_recommendation: "WEEKLY"
    };
  }
}

/**
 * Generate the final email digest from all analyzed results.
 */
async function generateDigest(allResults, apiKey, period = "weekly") {
  // Flatten all opportunities, sorted by relevance
  const allOpportunities = allResults
    .flatMap((r) => (r.opportunities || []).map((o) => ({ ...o, _source: r.source_name, _source_url: r.opportunities?.[0]?.apply_url })))
    .filter((o) => o.relevance_score >= 5)
    .sort((a, b) => b.relevance_score - a.relevance_score);

  const openCalls = allOpportunities.filter((o) => o.status === "OPEN");
  const upcomingCalls = allOpportunities.filter((o) => o.status === "UPCOMING");
  const ongoingPrograms = allOpportunities.filter((o) => ["ONGOING", "UNKNOWN"].includes(o.status));

  const digestData = JSON.stringify({
    period,
    generated: new Date().toISOString(),
    open_calls: openCalls,
    upcoming_calls: upcomingCalls,
    ongoing_programs: ongoingPrograms,
    sources_checked: allResults.length,
    sources_accessible: allResults.filter((r) => r.page_accessible).length,
  }, null, 2);

  const prompt = `You are a senior EU funding consultant preparing a briefing for a Romanian executive.

CLIENT PROFILE:
- SC Bavaria Yachts România SRL — official Bavaria Yachts dealer in Romania
- Seeking EU/state funding for: electric boat acquisition, Danube fleet greening, sustainable inland waterway projects
- SME classification, based in Romania, operational on the Danube corridor
- Capable of co-financing 20-50%, looking for opportunities in 2026

RAW FUNDING DATA FROM THIS WEEK'S MONITORING:
${digestData}

TASK:
Write a professional, executive-grade ${period} funding digest email in English. Structure:

1. SUBJECT LINE: Compelling, specific, includes date
2. HEADER: Brief 2-3 line executive summary — what's the most important thing this week?
3. 🟢 OPEN NOW (deadline-driven): Each opportunity with: Name | Programme | Deadline | Max Grant | Relevance to client | Action required
4. 🟡 COMING SOON: Opportunities to prepare for
5. 🔵 STRATEGIC PROGRAMMES: Ongoing programs worth exploring
6. ⚠️ ACTION ITEMS: Specific next steps for the client this week, ordered by urgency
7. SOURCES CHECKED: Brief list of sources monitored

Style: Executive briefing tone. Dense with facts. No filler phrases. No "I hope this finds you well." 
Use clear formatting with headers and bullet points.
Flag CRITICAL items (imminent deadlines, high relevance) explicitly.

Return format:
{
  "subject": "email subject line",
  "body_html": "full HTML email body",
  "body_text": "plain text version"
}

Return ONLY JSON, no markdown fences.`;

  try {
    const response = await callClaudeAPI(prompt, apiKey, 3000);
    return JSON.parse(response);
  } catch (err) {
    // Fallback: generate basic digest without AI formatting
    return generateFallbackDigest(allResults, allOpportunities);
  }
}

function generateFallbackDigest(allResults, opportunities) {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const open = opportunities.filter((o) => o.status === "OPEN");

  const text = `EU FUNDING MONITOR — ${date}

SOURCES CHECKED: ${allResults.length}
RELEVANT OPPORTUNITIES FOUND: ${opportunities.length}
OPEN CALLS: ${open.length}

${opportunities.map((o) => `
[${o.status}] ${o.title}
Programme: ${o.programme}
Deadline: ${o.deadline || "N/A"}
Relevance: ${o.relevance_score}/10
${o.key_info}
Apply: ${o.apply_url || "See source"}
`).join("\n---\n")}`;

  return {
    subject: `EU Funding Monitor – ${date} | ${open.length} Open Calls`,
    body_html: `<pre>${text}</pre>`,
    body_text: text,
  };
}

/**
 * Low-level Claude API call.
 */
function callClaudeAPI(prompt, apiKey, maxTokens = 2000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const options = {
      hostname: ANTHROPIC_API_URL,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data.error) {
            reject(new Error(data.error.message));
          } else {
            const text = data.content?.[0]?.text || "";
            // Strip markdown fences if present
            const clean = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
            resolve(clean);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Claude API timeout"));
    });

    req.write(body);
    req.end();
  });
}

module.exports = { analyzeSource, generateDigest };
