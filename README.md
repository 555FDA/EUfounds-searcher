# EU Funding Monitor 🇪🇺

AI-powered monitoring agent for EU, Romanian state, and international funding opportunities  
targeting **electric/low-emission boat acquisition and Danube inland waterway sustainability projects**.

Built for: **SC Bavaria Yachts România SRL**

---

## What It Does

1. **Fetches** 17 target URLs across Romanian portals, EU institutions, Interreg Danube, CINEA, and specialized waterway programmes — every run.
2. **Analyzes** each page with Claude AI, which understands context and extracts relevant funding calls without fragile CSS selectors.
3. **Deduplicates** against previously seen opportunities to avoid alert fatigue.
4. **Generates** a professional executive digest email via Claude AI.
5. **Delivers** the digest to your inbox on schedule.

---

## Sources Monitored (17 total)

| Priority | Source |
|----------|--------|
| 🔴 HIGH | Oportunitati UE (Romanian national portal) |
| 🔴 HIGH | Programul Transport – Oportunitati UE |
| 🔴 HIGH | Romanian Ministry of Transport (fonduri.mt.ro) |
| 🔴 HIGH | Interreg Danube Region Programme – Calls |
| 🔴 HIGH | CINEA – CEF Transport programme |
| 🔴 HIGH | CINEA – Open Calls |
| 🔴 HIGH | EU Funding & Tenders Portal (inland waterway filter) |
| 🟡 MEDIUM | Interreg Danube – News & Updates |
| 🟡 MEDIUM | Ministry of European Funds (mfe.gov.ro) |
| 🟡 MEDIUM | EU F&T Portal – Green Transport search |
| 🟡 MEDIUM | Pro Danube International (PREMETER/DEMETER) |
| 🟡 MEDIUM | AFDJ – Lower Danube River Administration |
| 🟡 MEDIUM | NAIADES – EU Inland Waterway Action Programme |
| 🟡 MEDIUM | PNRR Romania portal |
| ⚪ LOW | Horizon Europe – Zero-Emission Waterborne |
| ⚪ LOW | EU Innovation Fund |
| ⚪ LOW | LIFE Programme – Climate Action |

---

## Quick Start

### Prerequisites
- Node.js 18+ 
- Anthropic API key (get at console.anthropic.com)
- Gmail account with App Password enabled

### 1. Setup

```bash
git clone <your-repo>
cd eu-funding-monitor
npm install
cp .env.example .env
```

### 2. Configure `.env`

```env
ANTHROPIC_API_KEY=sk-ant-...
EMAIL_FROM=yourname@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx    # Gmail App Password
EMAIL_TO=recipient@domain.com
CRON_SCHEDULE=0 8 * * 1               # Monday 08:00
LOOKBACK_DAYS=7
```

**Gmail App Password setup:**
1. Google Account → Security → 2-Step Verification (must be enabled)
2. Security → App Passwords → Generate for "Mail"
3. Use the 16-character code as `EMAIL_PASSWORD`

### 3. Test (dry run — no email sent)

```bash
npm test
# or
node index.js --dry-run
```

Check `./output/latest-digest.html` to preview the email.

### 4. Run once

```bash
npm start
```

### 5. Run as scheduled daemon (VPS/server)

```bash
npm run schedule
# or keep it alive with PM2:
pm2 start index.js --name "eu-funding-monitor" -- --schedule
pm2 save
pm2 startup
```

---

## Deployment Options

### Option A: GitHub Actions (Recommended — FREE, zero server)

1. Push this repo to GitHub (private)
2. Add secrets in GitHub → Settings → Secrets and Variables → Actions:
   - `ANTHROPIC_API_KEY`
   - `EMAIL_FROM`
   - `EMAIL_PASSWORD`
   - `EMAIL_TO`
3. The workflow runs every Monday at 09:00 Bucharest time automatically
4. Trigger manually anytime from the Actions tab

**Cost: €0. Runs forever.**

### Option B: VPS with PM2

```bash
# Install PM2
npm install -g pm2

# Start scheduled daemon
pm2 start index.js --name "eu-monitor" -- --schedule
pm2 startup    # Enable autostart on reboot
pm2 save
```

### Option C: Any Linux VPS with cron

```bash
# Add to crontab
crontab -e

# Add this line (runs every Monday 08:00):
0 8 * * 1 cd /path/to/eu-funding-monitor && node index.js >> logs/monitor.log 2>&1
```

---

## Output

- **`output/latest-digest.html`** — Preview of last email
- **`output/state.json`** — Seen opportunities (deduplication state)
- **`output/run-<timestamp>.json`** — Full JSON data from each run

---

## Adding / Removing Sources

Edit `src/sources.js`. Each source needs:

```javascript
{
  id: "unique-id",
  name: "Human readable name",
  url: "https://...",
  priority: "HIGH" | "MEDIUM" | "LOW",
  tags: ["tag1", "tag2"],
  note: "Context for AI — what to look for on this page"
}
```

---

## Costs

| Component | Cost |
|-----------|------|
| Claude API (analysis) | ~$0.10–0.30 per run (17 sources × ~2K tokens each + digest) |
| Email sending | Free (Gmail SMTP) |
| GitHub Actions | Free (2000 min/month, each run ~5 min) |
| VPS (optional) | €3–5/month if self-hosting |

**Monthly cost at weekly cadence: ~€1.50 in API costs.**

---

## Troubleshooting

**"Fetch failed" for Romanian government sites**  
Some `.gov.ro` sites block bots. This is expected. The AI will note `page_accessible: false`. 
Manually check those sources monthly.

**Email not sending**  
- Verify Gmail App Password (not your account password)
- Check 2FA is enabled on the Gmail account
- Try `node index.js --dry-run` first and check `output/latest-digest.html`

**No opportunities found**  
- Check `output/state.json` — may have been seen before
- Delete `output/state.json` to reset deduplication
- Try `LOOKBACK_DAYS=30` to widen the window
