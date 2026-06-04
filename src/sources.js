/**
 * EU Funding Monitor — Source Definitions
 * 
 * Each source defines a URL to fetch and context to guide AI extraction.
 * Add/remove sources here without touching the core engine.
 */

const SOURCES = [
  // ─── ROMANIAN NATIONAL PORTALS ───────────────────────────────────────────
  {
    id: "oportunitati-ue",
    name: "Oportunitati UE (Romanian EU Opportunities Portal)",
    url: "https://oportunitati-ue.gov.ro/",
    priority: "HIGH",
    tags: ["romania", "national", "transport", "green"],
    note: "Central Romanian portal for all EU-funded programs. Check for open calls under Transport and Green Transition."
  },
  {
    id: "oportunitati-ue-transport",
    name: "Programul Transport – Oportunitati UE",
    url: "https://oportunitati-ue.gov.ro/en/program/programul-transport/",
    priority: "HIGH",
    tags: ["transport", "inland-waterway", "danube", "romania"],
    note: "Specific transport programme page. Look for calls related to inland waterways, Danube fleet, ports."
  },
  {
    id: "fonduri-mt",
    name: "Romanian Ministry of Transport – EU Funds",
    url: "https://fonduri.mt.ro/",
    priority: "HIGH",
    tags: ["romania", "transport", "ministry"],
    note: "Ministry-level funding page. Any open calls for naval/waterway projects are critical."
  },
  {
    id: "mfe-romania",
    name: "Romanian Ministry of European Funds",
    url: "https://mfe.gov.ro/",
    priority: "MEDIUM",
    tags: ["romania", "cohesion", "structural-funds"],
    note: "Structural and cohesion fund management. Look for green transport, sustainability calls."
  },

  // ─── INTERREG / TRANSNATIONAL ─────────────────────────────────────────────
  {
    id: "interreg-danube",
    name: "Interreg Danube Region Programme",
    url: "https://interreg-danube.eu/calls-for-proposals",
    priority: "HIGH",
    tags: ["interreg", "danube", "transnational", "fleet-greening"],
    note: "Danube-specific transnational programme. Priority 2 = green transport. PREMETER/DEMETER type projects. Check for new calls after 3rd call closed Dec 2025."
  },
  {
    id: "interreg-danube-news",
    name: "Interreg Danube – News & Updates",
    url: "https://interreg-danube.eu/news-and-events/news",
    priority: "MEDIUM",
    tags: ["interreg", "danube"],
    note: "News section may announce upcoming calls before official launch."
  },

  // ─── EU CENTRAL INSTITUTIONS ──────────────────────────────────────────────
  {
    id: "cinea-cef",
    name: "CINEA – Connecting Europe Facility (Transport)",
    url: "https://cinea.ec.europa.eu/programmes/connecting-europe-facility/transport_en",
    priority: "HIGH",
    tags: ["CEF", "TEN-T", "danube", "corridor-VII", "EU"],
    note: "CEF Transport calls for TEN-T Corridor VII (Danube). Shore-side electricity, green ports, navigation. Large grants."
  },
  {
    id: "cinea-calls",
    name: "CINEA – Open Calls",
    url: "https://cinea.ec.europa.eu/funding-opportunities/calls-proposals_en",
    priority: "HIGH",
    tags: ["CEF", "EU", "calls"],
    note: "All open calls managed by CINEA. Filter for transport and energy."
  },
  {
    id: "ec-funding-tenders",
    name: "EU Funding & Tenders Portal",
    url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search;callCode=null;freeTextSearchKeyword=inland%20waterway;matchWholeText=true;typeCodes=0,1;statusCodes=31094501,31094502;programmePeriod=null;programCcm2Id=null;programDivisionCode=null;frameworkProgramme=null;theme=null;keywordCode=null;maxResults=50;sortQuery=openingDate;orderBy=asc;onlyTenders=false;topicListKey=topicSearchTablePageState",
    priority: "HIGH",
    tags: ["EU", "tenders", "inland-waterway", "green"],
    note: "EU F&T Portal pre-filtered for inland waterway topics. Shows all open EU-level calls."
  },
  {
    id: "ec-funding-green-transport",
    name: "EU Funding & Tenders – Green Transport",
    url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search;callCode=null;freeTextSearchKeyword=green%20transport%20waterway;matchWholeText=false;typeCodes=0,1;statusCodes=31094501,31094502;sortQuery=openingDate;orderBy=asc",
    priority: "MEDIUM",
    tags: ["EU", "tenders", "green-transport"],
    note: "Broader green transport search on EU portal."
  },

  // ─── SPECIALIZED DANUBE / WATERWAY ────────────────────────────────────────
  {
    id: "prodanube",
    name: "Pro Danube International",
    url: "https://www.prodanube.eu/",
    priority: "MEDIUM",
    tags: ["danube", "fleet-greening", "PREMETER", "DEMETER"],
    note: "Operator of PREMETER/DEMETER vessel electrification projects. Any new project announcements here are directly relevant."
  },
  {
    id: "afdj",
    name: "AFDJ – Lower Danube River Administration",
    url: "https://www.afdj.ro/",
    priority: "MEDIUM",
    tags: ["romania", "danube", "administration"],
    note: "Romanian Danube authority. May publish tenders or partnership calls for green navigation projects."
  },
  {
    id: "naiades",
    name: "NAIADES – EU Inland Waterway Action Programme",
    url: "https://www.naiades.info/",
    priority: "MEDIUM",
    tags: ["EU", "inland-waterway", "policy", "fleet-greening"],
    note: "EU IWT programme. Funding news, calls for emission reduction in inland navigation."
  },

  // ─── PNRR ─────────────────────────────────────────────────────────────────
  {
    id: "pnrr-romania",
    name: "PNRR Romania – Official Portal",
    url: "https://mfe.gov.ro/pnrr/",
    priority: "MEDIUM",
    tags: ["PNRR", "romania", "green", "transport"],
    note: "Romanian PNRR implementation. Component 4 (sustainable transport) may still have residual calls."
  },

  // ─── INNOVATION & HORIZON ─────────────────────────────────────────────────
  {
    id: "horizon-europe-transport",
    name: "Horizon Europe – Zero-Emission Waterborne Transport",
    url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search;callCode=null;freeTextSearchKeyword=zero%20emission%20waterborne;typeCodes=0,1;statusCodes=31094501,31094502;sortQuery=openingDate;orderBy=asc",
    priority: "LOW",
    tags: ["Horizon", "R&D", "zero-emission", "waterborne"],
    note: "R&D grants for zero-emission waterborne transport. Relevant if partnering with universities or tech developers."
  },
  {
    id: "innovation-fund",
    name: "EU Innovation Fund",
    url: "https://climate.ec.europa.eu/eu-action/eu-emissions-trading-system-eu-ets/innovation-fund_en",
    priority: "LOW",
    tags: ["innovation", "decarbonisation", "EU"],
    note: "Large-scale decarbonisation projects. Relevant for electric fleet at scale."
  },
  {
    id: "life-programme",
    name: "LIFE Programme – Climate Action",
    url: "https://cinea.ec.europa.eu/programmes/life_en",
    priority: "LOW",
    tags: ["LIFE", "climate", "GHG", "adaptation"],
    note: "Climate adaptation calls. Possible for GHG reduction demonstration projects with Danube vessels."
  }
];

// Keywords that signal relevance when AI parses content
const RELEVANCE_KEYWORDS = [
  "inland waterway", "waterway", "vessel", "boat", "fleet", "electric boat",
  "hybrid vessel", "zero emission", "low emission", "LNG", "hydrogen propulsion",
  "Danube", "dunăre", "dunare", "navă", "nava", "flotă", "flota",
  "PREMETER", "DEMETER", "NAIADES", "TEN-T", "Corridor VII",
  "port", "bunkering", "shore power", "modal shift",
  "green shipping", "sustainable transport", "decarbonisation", "GHG",
  "electrification", "retrofit", "fleet renewal", "fleet modernization",
  "SME", "România", "Romania", "apel", "call for proposals"
];

module.exports = { SOURCES, RELEVANCE_KEYWORDS };
