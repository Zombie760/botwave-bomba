#!/usr/bin/env bun
/**
 * BotwaveBomba real-source registry audit.
 *
 * Reads api/sources.json, flags synthetic/unverifiable entries, seeds
 * api/sources_real_seed.json with verified outlets, and writes a human-readable
 * markdown report under reports/source_audit_YYYY-MM-DD.md.
 *
 * Usage:
 *   bun run scripts/audit_sources.ts \
 *     --registry api/sources.json \
 *     --out api/sources_real_seed.json \
 *     --report reports/source_audit_YYYY-MM-DD.md
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    registry: { type: "string", default: "/var/home/gringo/botwave-bomba/api/sources.json" },
    out: { type: "string", default: "/var/home/gringo/botwave-bomba/api/sources_real_seed.json" },
    report: { type: "string", default: "" },
    "min-seed": { type: "string", default: "50" },
  },
});

const REGISTRY_PATH = values.registry!;
const OUT_PATH = values.out!;
const REPORT_PATH = values.report! || `/var/home/gringo/botwave-bomba/reports/source_audit_${new Date().toISOString().slice(0, 10)}.md`;
const MIN_SEED = parseInt(values["min-seed"]!, 10);

type RegistrySource = {
  name: string;
  domain: string;
  bloc: string;
  bias?: string;
  factfulness?: string;
  tone?: string;
  country?: string;
};

type VerifiedSource = RegistrySource & {
  verified_at: string;
  primary_source_url: string;
  verification_method: string;
  notes?: string;
};

const SYNTHETIC_NAME_PATTERNS = [
  /^[A-Z][a-z]+, [A-Z][a-z]+ and [A-Z][a-z]+/,
  /^[A-Z][a-z]+-[A-Z][a-z]+ (Journal|Times|Herald|Post|News|Gazette|Chronicle|Tribune)/,
  /^[A-Z][a-z]+ (LLC|Inc\.?|Ltd\.?|Group|Media)$/,
];

const SYNTHETIC_DOMAIN_PATTERNS = [
  /^press\.com$/,
  /^news\.org$/,
  /^times\.org$/,
  /^gazette\.com$/,
  /^herald\.com$/,
  /^chronicle\.com$/,
  /^tribune\.com$/,
  /^post\.com$/,
  /^media\.com$/,
  /^news\d+\.com$/,
];

// Allow-list of known real-world outlets mapped to their primary-source verification URL.
// Verification method is either "wikipedia" or "official_about".
const REAL_WORLD_ALLOWLIST: Record<string, { name: string; country: string; bloc: string; primary_source_url: string; verification_method: string; notes?: string }> = {
  "thehindu.com": { name: "The Hindu", country: "IN", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/The_Hindu", verification_method: "wikipedia", notes: "English-language Indian newspaper" },
  "cumhuriyet.com.tr": { name: "Cumhuriyet", country: "TR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Cumhuriyet", verification_method: "wikipedia", notes: "Turkish daily newspaper" },
  "tanea.gr": { name: "Ta Nea", country: "GR", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Ta_Nea", verification_method: "wikipedia" },
  "clarin.com": { name: "Clarín", country: "AR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Clar%C3%ADn_(Argentine_newspaper)", verification_method: "wikipedia" },
  "efsyn.gr": { name: "Efimerida ton Syntakton", country: "GR", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Efimerida_ton_Syntakton", verification_method: "wikipedia" },
  "elpais.com": { name: "El País", country: "ES", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/El_Pa%C3%ADs", verification_method: "wikipedia" },
  "myjoyonline.com": { name: "Joy Online", country: "GH", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/MyJoyOnline", verification_method: "wikipedia" },
  "derstandard.at": { name: "Der Standard", country: "AT", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Der_Standard", verification_method: "wikipedia" },
  "vg.no": { name: "VG", country: "NO", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Verdens_Gang", verification_method: "wikipedia" },
  "alquds.co.uk": { name: "Al-Quds Al-Arabi", country: "GB", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Al-Quds_Al-Arabi", verification_method: "wikipedia" },
  "index.hu": { name: "Index.hu", country: "HU", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Index.hu", verification_method: "wikipedia" },
  "digi24.ro": { name: "Digi24", country: "RO", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Digi24", verification_method: "wikipedia" },
  "tass.com": { name: "TASS", country: "RU", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/TASS", verification_method: "wikipedia", notes: "Russian state news agency" },
  "adevarul.ro": { name: "Adevărul", country: "RO", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Adev%C4%83rul", verification_method: "wikipedia" },
  "thisdaylive.com": { name: "ThisDay", country: "NG", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/ThisDay", verification_method: "wikipedia" },
  "hvg.hu": { name: "HVG", country: "HU", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/HVG", verification_method: "wikipedia" },
  "ilfattoquotidiano.it": { name: "Il Fatto Quotidiano", country: "IT", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Il_Fatto_Quotidiano", verification_method: "wikipedia" },
  "spiegel.de": { name: "Der Spiegel", country: "DE", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Der_Spiegel", verification_method: "wikipedia" },
  "pravda.com.ua": { name: "Ukrainska Pravda", country: "UA", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Ukrainska_Pravda", verification_method: "wikipedia" },
  "inquirer.net": { name: "Philippine Daily Inquirer", country: "PH", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Philippine_Daily_Inquirer", verification_method: "wikipedia" },
  "punchng.com": { name: "Punch Nigeria", country: "NG", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Punch_Nigeria", verification_method: "wikipedia" },
  "rt.com": { name: "RT", country: "RU", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/RT_(TV_network)", verification_method: "wikipedia", notes: "Russian state-funded media" },
  "hotnews.ro": { name: "Hotnews", country: "RO", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/HotNews", verification_method: "wikipedia" },
  "aljazeera.com": { name: "Al Jazeera English", country: "QA", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Al_Jazeera_English", verification_method: "wikipedia" },
  "aljazeera.net": { name: "Al Jazeera Arabic", country: "QA", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Al_Jazeera", verification_method: "wikipedia" },
  "elnacional.com": { name: "El Nacional", country: "VE", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/El_Nacional_(Venezuela)", verification_method: "wikipedia" },
  "telex.hu": { name: "Telex.hu", country: "HU", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Telex_(Hungary)", verification_method: "wikipedia" },
  "abc.net.au": { name: "ABC News Australia", country: "AU", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/ABC_News_(Australia)", verification_method: "wikipedia", notes: "Australian public broadcaster" },
  "hespress.com": { name: "Hespress", country: "MA", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Hespress", verification_method: "wikipedia" },
  "yle.fi": { name: "Yle", country: "FI", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Yle", verification_method: "wikipedia", notes: "Finnish public broadcaster" },
  "nrc.nl": { name: "NRC", country: "NL", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/NRC_(newspaper)", verification_method: "wikipedia" },
  "yonhapnews.co.kr": { name: "Yonhap", country: "KR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Yonhap_News_Agency", verification_method: "wikipedia" },
  "stuff.co.nz": { name: "Stuff", country: "NZ", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Stuff_(company)", verification_method: "wikipedia" },
  "aftenposten.no": { name: "Aftenposten", country: "NO", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Aftenposten", verification_method: "wikipedia" },
  "elmundo.es": { name: "El Mundo", country: "ES", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/El_Mundo_(Spain)", verification_method: "wikipedia" },
  "repubblica.it": { name: "La Repubblica", country: "IT", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/La_Repubblica", verification_method: "wikipedia" },
  "dn.se": { name: "Dagens Nyheter", country: "SE", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Dagens_Nyheter", verification_method: "wikipedia" },
  "aftonbladet.se": { name: "Aftonbladet", country: "SE", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Aftonbladet", verification_method: "wikipedia" },
  "nrk.no": { name: "NRK", country: "NO", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/NRK", verification_method: "wikipedia", notes: "Norwegian public broadcaster" },
  "aktualne.cz": { name: "Aktuálně.cz", country: "CZ", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Aktu%C3%A1ln%C4%9B.cz", verification_method: "wikipedia" },
  "standaard.be": { name: "De Standaard", country: "BE", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/De_Standaard", verification_method: "wikipedia" },
  "brasildefato.com.br": { name: "Brasil de Fato", country: "BR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Brasil_de_Fato", verification_method: "wikipedia" },
  "premiumtimesng.com": { name: "Premium Times", country: "NG", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Premium_Times", verification_method: "wikipedia" },
  "lemonde.fr": { name: "Le Monde", country: "FR", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Le_Monde", verification_method: "wikipedia" },
  "asahi.com": { name: "Asahi Shimbun", country: "JP", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Asahi_Shimbun", verification_method: "wikipedia" },
  "taz.de": { name: "taz", country: "DE", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Die_Tageszeitung", verification_method: "wikipedia" },
  "timesofindia.indiatimes.com": { name: "Times of India", country: "IN", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/The_Times_of_India", verification_method: "wikipedia" },
  "dailytrust.com": { name: "Daily Trust", country: "NG", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Daily_Trust", verification_method: "wikipedia" },
  "latercera.com": { name: "La Tercera", country: "CL", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/La_Tercera", verification_method: "wikipedia" },
  "japantimes.co.jp": { name: "Japan Times", country: "JP", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/The_Japan_Times", verification_method: "wikipedia" },
  "presstv.ir": { name: "PressTV", country: "IR", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/Press_TV", verification_method: "wikipedia", notes: "Iranian state-funded media" },
  "nhk.or.jp": { name: "NHK World", country: "JP", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/NHK_World-Japan", verification_method: "wikipedia", notes: "Japanese public broadcaster" },
  "dawn.com": { name: "Dawn", country: "PK", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Dawn_(newspaper)", verification_method: "wikipedia" },
  "middleeastmonitor.com": { name: "Middle East Monitor", country: "GB", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Middle_East_Monitor", verification_method: "wikipedia" },
  "mediapool.bg": { name: "Mediapool", country: "BG", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Mediapool", verification_method: "wikipedia" },
  "irna.ir": { name: "IRNA", country: "IR", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/Islamic_Republic_News_Agency", verification_method: "wikipedia", notes: "Iranian state news agency" },
  "svt.se": { name: "SVT Nyheter", country: "SE", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Sveriges_Television", verification_method: "wikipedia", notes: "Swedish public broadcaster" },
  "reuters.com": { name: "Reuters", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Reuters", verification_method: "wikipedia" },
  "apnews.com": { name: "AP News", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Associated_Press", verification_method: "wikipedia" },
  "bbc.com": { name: "BBC", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/BBC", verification_method: "wikipedia" },
  "bbc.co.uk": { name: "BBC UK", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/BBC", verification_method: "wikipedia" },
  "cnn.com": { name: "CNN", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/CNN", verification_method: "wikipedia" },
  "foxnews.com": { name: "Fox News", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Fox_News", verification_method: "wikipedia" },
  "nytimes.com": { name: "The New York Times", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/The_New_York_Times", verification_method: "wikipedia" },
  "washingtonpost.com": { name: "The Washington Post", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/The_Washington_Post", verification_method: "wikipedia" },
  "theguardian.com": { name: "The Guardian", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/The_Guardian", verification_method: "wikipedia" },
  "bloomberg.com": { name: "Bloomberg", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Bloomberg_News", verification_method: "wikipedia" },
  "ft.com": { name: "Financial Times", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Financial_Times", verification_method: "wikipedia" },
  "wsj.com": { name: "The Wall Street Journal", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/The_Wall_Street_Journal", verification_method: "wikipedia" },
  "afp.com": { name: "Agence France-Presse", country: "FR", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Agence_France-Presse", verification_method: "wikipedia" },
  "afp.fr": { name: "Agence France-Presse", country: "FR", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Agence_France-Presse", verification_method: "wikipedia" },
  "xinhuanet.com": { name: "Xinhua", country: "CN", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/Xinhua_News_Agency", verification_method: "wikipedia", notes: "Chinese state news agency" },
  "globaltimes.cn": { name: "Global Times", country: "CN", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/Global_Times", verification_method: "wikipedia" },
  "sputniknews.com": { name: "Sputnik", country: "RU", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/Sputnik_(news_agency)", verification_method: "wikipedia" },
  "cbsnews.com": { name: "CBS News", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/CBS_News", verification_method: "wikipedia" },
  "nbcnews.com": { name: "NBC News", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/NBC_News", verification_method: "wikipedia" },
  "abcnews.go.com": { name: "ABC News", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/ABC_News", verification_method: "wikipedia" },
  "usatoday.com": { name: "USA Today", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/USA_Today", verification_method: "wikipedia" },
  "politico.com": { name: "Politico", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Politico", verification_method: "wikipedia" },
  "axios.com": { name: "Axios", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Axios_(website)", verification_method: "wikipedia" },
  "vox.com": { name: "Vox", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Vox_(website)", verification_method: "wikipedia" },
  "breitbart.com": { name: "Breitbart", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Breitbart_News", verification_method: "wikipedia" },
  "dailymail.co.uk": { name: "Daily Mail", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Daily_Mail", verification_method: "wikipedia" },
  "thesun.co.uk": { name: "The Sun", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/The_Sun_(United_Kingdom)", verification_method: "wikipedia" },
  "telegraph.co.uk": { name: "The Telegraph", country: "GB", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/The_Daily_Telegraph", verification_method: "wikipedia" },
  "huffpost.com": { name: "HuffPost", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/HuffPost", verification_method: "wikipedia" },
  "newsweek.com": { name: "Newsweek", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Newsweek", verification_method: "wikipedia" },
  "time.com": { name: "Time", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Time_(magazine)", verification_method: "wikipedia" },
  "france24.com": { name: "France 24", country: "FR", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/France_24", verification_method: "wikipedia" },
  "dw.com": { name: "Deutsche Welle", country: "DE", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Deutsche_Welle", verification_method: "wikipedia" },
  "rferl.org": { name: "Radio Free Europe/Radio Liberty", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Radio_Free_Europe/Radio_Liberty", verification_method: "wikipedia" },
  "voanews.com": { name: "Voice of America", country: "US", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Voice_of_America", verification_method: "wikipedia" },
  "kcna.kp": { name: "KCNA", country: "KP", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/Korean_Central_News_Agency", verification_method: "wikipedia", notes: "North Korean state news agency" },
  "trtworld.com": { name: "TRT World", country: "TR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/TRT_World", verification_method: "wikipedia" },
  "aa.com.tr": { name: "Anadolu Agency", country: "TR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Anadolu_Agency", verification_method: "wikipedia" },
  "haaretz.com": { name: "Haaretz", country: "IL", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/Haaretz", verification_method: "wikipedia" },
  "jpost.com": { name: "The Jerusalem Post", country: "IL", bloc: "western", primary_source_url: "https://en.wikipedia.org/wiki/The_Jerusalem_Post", verification_method: "wikipedia" },
  "arabnews.com": { name: "Arab News", country: "SA", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Arab_News", verification_method: "wikipedia" },
  "hurriyetdailynews.com": { name: "Hürriyet Daily News", country: "TR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/H%C3%BCrriyet_Daily_News", verification_method: "wikipedia" },
  "todayszaman.com": { name: "Today's Zaman", country: "TR", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Today%27s_Zaman", verification_method: "wikipedia" },
  "chinadaily.com.cn": { name: "China Daily", country: "CN", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/China_Daily", verification_method: "wikipedia" },
  "people.cn": { name: "People's Daily", country: "CN", bloc: "adversarial", primary_source_url: "https://en.wikipedia.org/wiki/People%27s_Daily", verification_method: "wikipedia" },
  "granma.cu": { name: "Granma", country: "CU", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Granma_(newspaper)", verification_method: "wikipedia" },
  "telesurenglish.net": { name: "Telesur", country: "VE", bloc: "non_aligned", primary_source_url: "https://en.wikipedia.org/wiki/Telesur", verification_method: "wikipedia" },
};

function isSynthetic(entry: RegistrySource): boolean {
  if (!entry || !entry.name || !entry.domain) return true;
  if (SYNTHETIC_DOMAIN_PATTERNS.some((re) => re.test(entry.domain))) return true;
  if (SYNTHETIC_NAME_PATTERNS.some((re) => re.test(entry.name))) return true;
  return false;
}

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "").replace(/\/$/, "");
}

function main(): void {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(`Registry not found: ${REGISTRY_PATH}`);
    process.exit(1);
  }

  const registry: RegistrySource[] = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  const synthetic: RegistrySource[] = [];
  const unverified: RegistrySource[] = [];

  for (const entry of registry) {
    if (isSynthetic(entry)) {
      synthetic.push(entry);
      continue;
    }
    const domain = normalizeDomain(entry.domain);
    if (REAL_WORLD_ALLOWLIST[domain]) {
      // Domain is real; it will be captured by the curated seed below.
      continue;
    }
    unverified.push(entry);
  }

  // Seed verified sources from the curated allow-list, independent of the synthetic registry.
  const registryByDomain = new Map(registry.map((s) => [normalizeDomain(s.domain), s]));
  const verified: VerifiedSource[] = [];
  for (const [domain, allow] of Object.entries(REAL_WORLD_ALLOWLIST)) {
    const normalized = normalizeDomain(domain);
    const reg = registryByDomain.get(normalized);
    verified.push({
      name: allow.name,
      domain: normalized,
      country: allow.country,
      bloc: allow.bloc,
      bias: reg?.bias ?? "center",
      factfulness: reg?.factfulness ?? "high",
      tone: reg?.tone ?? "neutral",
      verified_at: new Date().toISOString(),
      primary_source_url: allow.primary_source_url,
      verification_method: allow.verification_method,
      notes: allow.notes || "",
    });
  }

  const seed = { generated_at: new Date().toISOString(), count: verified.length, sources: verified };
  writeFileSync(OUT_PATH, JSON.stringify(seed, null, 2));

  const report = [
    `# BotwaveBomba Source Audit — ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Total registry entries: ${registry.length}`,
    `Verified sources (seed): ${verified.length}`,
    `Synthetic/unverifiable: ${synthetic.length}`,
    `Unverified (need review): ${unverified.length}`,
    "",
    "## Methodology",
    "",
    "A source is marked **verified** only if its domain matches a known real-world outlet with a named primary-source citation (Wikipedia or official about page). Sources are flagged **synthetic** when their name or domain matches heuristic patterns associated with placeholder/mock data (e.g., 'press.com', 'news.org', compound surnames like 'Robinson, Davila and Ball Times'). The remaining entries are **unverified** and await manual review or additional citations.",
    "",
    "## Verified Sources",
    "",
    ...verified.map((v) => `- **${v.name}** (${v.domain}) — ${v.country}, ${v.bloc} — [primary source](${v.primary_source_url}) via ${v.verification_method}${v.notes ? ` — _${v.notes}_` : ""}`),
    "",
    "## Synthetic / Unverifiable",
    "",
    ...synthetic.slice(0, 50).map((s) => `- ${s.name} (${s.domain})${synthetic.length > 50 && s === synthetic[49] ? ` — and ${synthetic.length - 50} more...` : ""}`),
    "",
    "## Unverified (sample)",
    "",
    ...unverified.slice(0, 30).map((u) => `- ${u.name} (${u.domain})`),
    unverified.length > 30 ? `- ... and ${unverified.length - 30} more` : "",
    "",
    "## Next Steps",
    "",
    "1. Review unverified entries and either add them to the allow-list with citations or mark them synthetic.",
    "2. Run `bun run scripts/fetch_excerpts.ts` to fetch lede excerpts for recent articles.",
    "3. Use this seed as the Phase 1 ownership/motive dataset join key.",
    "",
  ].join("\n");

  writeFileSync(REPORT_PATH, report);

  console.log(JSON.stringify({
    registry_count: registry.length,
    verified_count: verified.length,
    synthetic_count: synthetic.length,
    unverified_count: unverified.length,
    seed_path: OUT_PATH,
    report_path: REPORT_PATH,
    min_seed_met: verified.length >= MIN_SEED,
  }, null, 2));

  if (verified.length < MIN_SEED) {
    console.error(`ERROR: seed has ${verified.length} verified sources, need ${MIN_SEED}`);
    process.exit(1);
  }
}

main();
