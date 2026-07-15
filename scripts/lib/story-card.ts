// Story card renderer — ground.news parity pattern
// Each card: source logo + bloc badge + factuality badge + title + excerpt
// + 3-bloc segments bar + meta line with source count + signal badges
// + expand button for full source list
import type { SigintPackage, Asset } from "./data.ts";

const CARD_LINK_BASE = "/botwavebomba";

export function normBloc(
  b: string | undefined | null
): "western" | "non-aligned" | "adversarial" | "other" {
  if (!b) return "other";
  const x = String(b).toLowerCase();
  if (x.includes("western") || x === "w" || x === "us" || x === "eu") return "western";
  if (x.includes("non-aligned") || x.includes("nonaligned") || x === "n") return "non-aligned";
  if (x.includes("adversarial") || x === "a") return "adversarial";
  return "other";
}

export function blocClass(b: string | undefined | null): string {
  return `bwb-story-card-bloc ${normBloc(b)}`;
}

export function factualityClass(f: string | undefined | null): string {
  if (!f) return "unknown";
  const x = String(f).toLowerCase();
  if (x.includes("very-high") || x === "very_high") return "very-high";
  if (x.includes("high")) return "high";
  if (x.includes("mixed")) return "mixed";
  if (x.includes("very-low") || x === "very_low") return "very-low";
  if (x.includes("low")) return "low";
  return "unknown";
}

export function factualityLabel(f: string | undefined | null): string {
  const c = factualityClass(f);
  return (
    (
      {
        "very-high": "Very high factuality",
        high: "High factuality",
        mixed: "Mixed factuality",
        low: "Low factuality",
        "very-low": "Very low factuality",
        unknown: "Unknown factuality",
      } as Record<string, string>
    )[c] ?? "Unknown factuality"
  );
}

function getDomain(url: string): string {
  try {
    return url
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function escapeHtml(s: any): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimeAgo(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return "";
    const now = Date.now();
    const sec = Math.max(0, Math.floor((now - then) / 1000));
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)} d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function blocSegPct(spread: any, key: string): number {
  if (!spread) return 0;
  if (typeof spread === "object" && spread[key] !== undefined) {
    return Math.max(0, Math.min(100, Number(spread[key]) || 0));
  }
  return 0;
}

export function storyCard(pkg: SigintPackage, allStories: Story[] = []): string {
  const sourceList = (pkg.sources || []).slice(0, 12);
  const lead: Asset | undefined = sourceList[0];
  const leadName = lead?.name || "Source";
  const leadUrl = lead?.url || "";
  const leadBloc = normBloc(lead?.bloc || lead?.alignment);
  const leadFactuality = factualityClass(lead?.factuality || lead?.vetting);
  const blocSpread: any = pkg.bloc_spread || pkg.alignmentSpread || {};
  const totalSources = pkg.source_count || pkg.assetCount || sourceList.length;
  const countries: string[] = pkg.countries || pkg.theaters || [];
  const headlines: string[] = pkg.top_headlines || pkg.topHeadlines || [];
  const title = headlines[0] || `Coverage across ${sourceList.length} sources`;
  const snippet =
    (pkg.refraction && (pkg.refraction["headline"] || pkg.refraction["summary"])) ||
    (lead && lead.excerpt) ||
    "";
  const leadIdx = 0;
  const wPct = blocSegPct(blocSpread, "western");
  const nPct = blocSegPct(blocSpread, "non-aligned");
  const aPct = blocSegPct(blocSpread, "adversarial");
  const oPct = Math.max(0, 100 - wPct - nPct - aPct);

  // Signal badges
  const isCoverageGap = wPct < 25 && totalSources >= 3;
  const isMonoFrame = (wPct > 85 || nPct > 85) && totalSources >= 3;
  const isBlackout = aPct > 50 && wPct < 15;

  const sourceRows = sourceList
    .map((src, i) => {
      const url = src.url || "";
      const country = src.country || "";
      const bloc = normBloc(src.bloc || src.alignment);
      const owner = src.owner || "";
      const domain = getDomain(url);
      return `<li class="bwb-card-source-row">
      <span class="bwb-card-source-bloc ${bloc}"></span>
      <span class="bwb-card-source-name">${escapeHtml(src.name)}</span>
      <span class="bwb-card-source-country">${escapeHtml(country)}</span>
      <span class="bwb-card-source-owner">${escapeHtml(owner || domain)}</span>
      <a class="bwb-card-source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(domain)} &nearr;</a>
    </li>`;
    })
    .join("");

  const cardId = `card-${escapeHtml(pkg.id)}`;
  const cardLink = `${CARD_LINK_BASE}/sigint.html?id=${encodeURIComponent(pkg.id)}`;
  return `<article class="bwb-story-card" data-pkg="${escapeHtml(pkg.id)}">
    <a class="bwb-story-card-link" href="${escapeHtml(cardLink)}" aria-label="Read coverage: ${escapeHtml(title)}">
      <div class="bwb-story-card-header">
        <div class="bwb-story-card-logo">
          <img src="https://logo.clearbit.com/${escapeHtml(getDomain(leadUrl))}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
          <span class="bwb-story-card-logo-fallback">${escapeHtml((leadName.match(/[A-Z]/g) || ["S"]).slice(0, 2).join(""))}</span>
        </div>
        <span class="bwb-story-card-source-name">${escapeHtml(leadName)}</span>
        <a href="/botwavebomba/tradecraft.html#rating" class="bwb-bloc-badge-link">
          <span class="${blocClass(leadBloc)}">${leadBloc.replace("-", " ")}</span>
        </a>
        <span class="bwb-story-card-factuality ${leadFactuality}">${escapeHtml(factualityLabel(leadFactuality))}</span>
      </div>
      <h3 class="bwb-story-card-title">${escapeHtml(title)}</h3>
      <p class="bwb-story-card-excerpt">${escapeHtml(snippet)}</p>
      <div class="bwb-story-card-blocs">
        <div class="bwb-blocs-bar" aria-label="Source bloc mix">
          <div class="bwb-blocs-seg western" style="width:${wPct}%" data-label="Western ${Math.round(wPct)}%"></div>
          <div class="bwb-blocs-seg non-aligned" style="width:${nPct}%" data-label="Non-Aligned ${Math.round(nPct)}%"></div>
          <div class="bwb-blocs-seg adversarial" style="width:${aPct}%" data-label="Adversarial ${Math.round(aPct)}%"></div>
          ${oPct > 0 ? `<div class="bwb-blocs-seg other" style="width:${oPct}%" data-label="Other ${Math.round(oPct)}%"></div>` : ""}
        </div>
      </div>
      <div class="bwb-story-card-meta">
        <span class="bwb-story-card-time">${escapeHtml(formatTimeAgo(pkg.lastUpdated))}</span>
        <div class="bwb-story-card-counts">
          <span class="bwb-story-card-count" title="Sources">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${totalSources} ${totalSources === 1 ? "source" : "sources"}
          </span>
          ${
            countries.length
              ? `<span class="bwb-story-card-count" title="Countries">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            ${countries.length} ${countries.length === 1 ? "country" : "countries"}
          </span>`
              : ""
          }
        </div>
        <div class="bwb-story-card-badges">
          ${isCoverageGap ? '<span class="bwb-signal-badge blindspot">Coverage gap</span>' : ""}
          ${isMonoFrame ? '<span class="bwb-signal-badge mono-frame">Mono-frame</span>' : ""}
          ${isBlackout ? '<span class="bwb-signal-badge blackout">W. blackout</span>' : ""}
        </div>
      </div>
    </a>
    <button class="bwb-card-expand" type="button" aria-expanded="false" aria-controls="${cardId}">
      <span class="bwb-card-expand-label">show ${totalSources} sources</span>
    </button>
    <div class="bwb-card-sources" id="${cardId}" hidden>
      <ul>${sourceRows}</ul>
    </div>
  </article>`;
}
