/**
 * AI Analyzer Module — Sales Intelligence Edition
 *
 * Reoriented from "grants for us" to "grants our prospects can use to buy from us."
 * The output is prospect intelligence, not grant applications.
 */

const https = require("https");
const { RELEVANCE_KEYWORDS } = require("./sources");

const ANTHROPIC_API_URL = "api.anthropic.com";
const MODEL = "claude-sonnet-4-20250514";

/**
 * Analyze a single source page and extract funding opportunities
 * through the lens of a boat/engine dealer whose clients are the beneficiaries.
 */
async function analyzeSource(source, pageText, apiKey) {
  const keywords = RELEVANCE_KEYWORDS.join(", ");

  const prompt = `You are a sales intelligence analyst working for a marine equipment dealer in Romania.

YOUR EMPLOYER:
SC Bavaria Yachts România SRL — official dealer for Bavaria Yachts and electric marine engines in Romania.
They sell to: river tourism operators, passenger transport companies, port/marina operators, municipalities,
public institutions, NGOs active on the Danube, logistics/cargo companies near waterways, fishing businesses,
recreational/private buyers, and any organization that operates or could operate a vessel.

CRITICAL FRAMING — READ THIS CAREFULLY:
The dealer does NOT apply for these grants themselves.
Their CUSTOMERS and PROSPECTS apply for grants, and use that funding to PURCHASE boats and engines from the dealer.
Your job is to identify which grants allow beneficiaries to procure vessels, electric engines, or related maritime equipment,
and to profile WHICH TYPE OF CUSTOMER is eligible so the dealer can target their sales outreach accordingly.

PRODUCTS THE DEALER SELLS:
- Bavaria Yachts sailing and motor boats
- Electric outboard and inboard marine engines
- Hybrid propulsion systems
- Vessel retrofitting components
- Related maritime equipment and accessories

SOURCE: ${source.name}
URL: ${source.url}
SOURCE PRIORITY: ${source.priority}
SOURCE CONTEXT: ${source.note}

RELEVANCE KEYWORDS: ${keywords}

PAGE CONTENT:
---
${pageText}
---

TASK:
Extract all funding opportunities where the beneficiary (the dealer's potential customer) could use the grant
to purchase boats, electric/hybrid engines, or maritime equipment. Also flag programs where vessels are
eligible as part of a broader project (e.g. an NGO doing river conservation could buy an electric boat as
project equipment).

Return a JSON object with this exact structure:
{
  "source_id": "${source.id}",
  "source_name": "${source.name}",
  "page_accessible": true or false,
  "opportunities": [
    {
      "title": "Name of the call/programme",
      "programme": "Programme name (e.g. Interreg, CEF, PNRR, LIFE)",
      "status": "OPEN" | "UPCOMING" | "CLOSED" | "ONGOING" | "UNKNOWN",
      "deadline": "Date if found, otherwise null",
      "budget": "Total call budget or max grant per project if mentioned",
      "support_intensity": "% grant coverage if mentioned (e.g. 60% non-repayable)",
      "eligible_beneficiaries": [
        "List each eligible entity type: e.g. river tourism SME, municipality, NGO, port operator, private company, etc."
      ],
      "vessel_procurement_angle": "Explain specifically HOW and WHY a vessel or electric engine purchase fits this grant. Be concrete. If it does not fit at all, say so.",
      "target_customer_segment": "Which of the dealer's customer types should be approached with this opportunity? Be specific: e.g. 'Danube river cruise operators', 'municipalities with public ferry services', 'environmental NGOs on Danube'",
      "sales_pitch_angle": "In 1-2 sentences, how should the dealer frame the conversation with that prospect? What pain point or opportunity does this grant solve for them?",
      "relevance_score": 1-10,
      "relevance_reason": "Why this scores as it does for the dealer's sales intelligence purpose",
      "apply_url": "Direct application or info URL if found",
      "deadline_urgency": "HIGH (< 60 days) | MEDIUM (60-180 days) | LOW (> 180 days) | UNKNOWN"
    }
  ],
  "summary": "1-2 sentence summary of what this source offers from a sales intelligence perspective",
  "next_check_recommendation": "DAILY" | "WEEKLY" | "MONTHLY"
}

SCORING GUIDE:
10 = Grant explicitly covers vessel/engine purchase, eligible beneficiaries are clearly the dealer's prospects, open now
7-9 = Grant covers transport/fleet/equipment where a vessel is a natural fit, strong prospect match
4-6 = Indirect fit — vessel could be part of a broader project, or prospect type is right but vessel angle needs work
1-3 = Weak or no fit — include only if the prospect angle is genuinely interesting despite indirect fit
0 = No relevance whatsoever — exclude entirely

IMPORTANT:
- If page is blocked/empty, set page_accessible: false and opportunities: []
- Only include opportunities scoring >= 4
- Do not invent. Extract only what the page explicitly states.
- The vessel_procurement_angle and sales_pitch_angle fields are the most important — be specific and actionable.
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
 * Generate the sales intelligence digest email.
 */
async function generateDigest(allResults, apiKey, period = "weekly") {
  const allOpportunities = allResults
    .flatMap((r) => (r.opportunities || []).map((o) => ({ ...o, _source: r.source_name })))
    .filter((o) => o.relevance_score >= 4)
    .sort((a, b) => b.relevance_score - a.relevance_score);

  const urgent = allOpportunities.filter((o) => o.deadline_urgency === "HIGH");
  const open = allOpportunities.filter((o) => o.status === "OPEN");
  const upcoming = allOpportunities.filter((o) => o.status === "UPCOMING");
  const ongoing = allOpportunities.filter((o) => ["ONGOING", "UNKNOWN"].includes(o.status));

  const digestData = JSON.stringify({
    period,
    generated: new Date().toISOString(),
    urgent_deadlines: urgent,
    open_calls: open,
    upcoming_calls: upcoming,
    ongoing_programs: ongoing,
    sources_checked: allResults.length,
    sources_accessible: allResults.filter((r) => r.page_accessible !== false).length,
  }, null, 2);

  const prompt = `You are a senior sales strategist preparing a weekly intelligence briefing for the owner of a marine equipment dealership in Romania.

DEALER PROFILE:
SC Bavaria Yachts România SRL — sells Bavaria Yachts, electric marine engines, hybrid propulsion systems.
Customer segments: river tourism operators, Danube cargo/logistics companies, municipalities with water services,
public institutions, environmental NGOs, marinas/ports, private recreational buyers, fishing businesses.
Strategic goal: use EU and Romanian state funding programs as a SALES TOOL — identify which prospects
have access to grants that would let them buy boats or engines, then approach them with a targeted pitch.

THIS WEEK'S FUNDING INTELLIGENCE DATA:
${digestData}

TASK:
Write a professional, executive-grade ${period} sales intelligence briefing. This is NOT a grant application guide.
It is a sales targeting tool. Structure it as follows:

1. SUBJECT LINE: Specific, includes date, sales-intelligence framing (e.g. "3 grant windows = 3 prospect conversations this week")
2. EXECUTIVE SUMMARY (3 lines max): What are the 1-2 highest-priority prospect actions this week and why?
3. 🔴 ACT THIS WEEK — URGENT: Grants with deadlines under 60 days. For each: Grant name | Eligible prospect type | What they can buy | Deadline | Suggested outreach angle
4. 🟢 OPEN CALLS — PIPELINE BUILDING: All other open calls. Same format.
5. 🟡 COMING SOON — PREPARE PROSPECTS NOW: Upcoming calls where prospects need lead time to prepare applications. Identify who to call now so they're ready.
6. 🔵 ONGOING PROGRAMMES — EVERGREEN PROSPECTS: Standing programmes with no hard deadline. Good for slow-burn outreach.
7. 📋 THIS WEEK'S PROSPECT HIT LIST: A concrete list of the specific customer types to contact this week, ranked by urgency, with one-line talking points for each.
8. SOURCES MONITORED: ${allResults.length} sources checked, ${allResults.filter(r => r.page_accessible !== false).length} accessible.

TONE: Direct, commercial, executive. No filler. No "please find attached." Write as if briefing a sales director.
Use grant money as a conversion tool, not an academic exercise.
Every opportunity should translate to: WHO to call, WHAT to say, WHY now.

Return format — JSON only, no markdown fences:
{
  "subject": "email subject line",
  "body_html": "full HTML email body with proper formatting",
  "body_text": "plain text version"
}`;

  try {
    const response = await callClaudeAPI(prompt, apiKey, 3500);
    return JSON.parse(response);
  } catch (err) {
    return generateFallbackDigest(allResults, allOpportunities);
  }
}

function generateFallbackDigest(allResults, opportunities) {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const urgent = opportunities.filter((o) => o.deadline_urgency === "HIGH");

  const text = `SALES INTELLIGENCE BRIEFING — ${date}

SOURCES CHECKED: ${allResults.length} | OPPORTUNITIES IDENTIFIED: ${opportunities.length} | URGENT (< 60 days): ${urgent.length}

${opportunities.map((o) => `
[${o.status}] [URGENCY: ${o.deadline_urgency}] ${o.title}
Programme: ${o.programme}
Deadline: ${o.deadline || "N/A"}
Target Prospects: ${o.target_customer_segment}
Eligible Beneficiaries: ${(o.eligible_beneficiaries || []).join(", ")}
Vessel Angle: ${o.vessel_procurement_angle}
Sales Pitch: ${o.sales_pitch_angle}
Relevance: ${o.relevance_score}/10
Info: ${o.apply_url || "See source"}
`).join("\n---\n")}`;

  return {
    subject: `Sales Intelligence Briefing – ${date} | ${urgent.length} Urgent Prospect Windows`,
    body_html: `<pre style="font-family:monospace;font-size:13px">${text}</pre>`,
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
