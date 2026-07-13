const CORRUPTION_API_V2=window.BWB_URL?window.BWB_URL("api/corruption_v2.json"):"/api/corruption_v2.json",CORRUPTION_API_V1=window.BWB_URL?window.BWB_URL("api/corruption.json"):"/api/corruption.json";async function loadCorruptionData(){try{const t=await fetch(CORRUPTION_API_V2,{cache:"no-cache"});if(t.ok){const o=await t.json();if(o&&(o.schema_version===2||o.tier1_pacs||o.money_trail))return o}}catch{}try{const t=await fetch(CORRUPTION_API_V1,{cache:"no-cache"});if(t.ok)return await t.json()}catch{console.warn("Corruption API not available")}return[]}function isV2(t){return t&&typeof t=="object"&&!Array.isArray(t)&&(t.schema_version===2||t.tier1_pacs||t.money_trail)}function formatMoney(t){return t>=1e6?"$"+(t/1e6).toFixed(1)+"M":t>=1e3?"$"+(t/1e3).toFixed(0)+"K":"$"+t.toLocaleString()}function getOfficeBadge(t){return{President:"PRES",Senate:"SEN",House:"HOUSE",Governor:"GOV",StateLegislature:"STATE"}[t]||t}function getDonorTypeBadge(t){return{corporation:"CORP",pac:"PAC",superpac:"SUPER PAC",individual:"INDIVIDUAL","501c4":"DARK MONEY"}[t]||t.toUpperCase()}function renderCards(t){const o=document.getElementById("money-trail-feed");if(!o)return;const n={};t.forEach(e=>{const i=`${e.recipient}|${e.recipient_state}|${e.recipient_office}`;n[i]||(n[i]={recipient:e.recipient,state:e.recipient_state,office:e.recipient_office,total:0,donors:[]}),n[i].total+=e.amount,n[i].donors.push(e)});let a="";Object.values(n).forEach((e,i)=>{const r=getOfficeBadge(e.office),l=e.state;a+=`
    <article class="bwb-story-card" data-story-id="corruption-${i}">
      <div class="bwb-story-header">
        <span class="bwb-story-section">${r} \u2014 ${l}</span>
        <span class="bwb-story-flag">${formatMoney(e.total)}</span>
      </div>
      <h2 class="bwb-story-title">${e.recipient}</h2>
      <div class="bwb-donor-list">
    `,e.donors.forEach(c=>{const p=getDonorTypeBadge(c.donor_type);a+=`
        <div class="bwb-donor-row">
          <span class="bwb-donor-name">${c.donor}</span>
          <span class="bwb-donor-type">${p}</span>
          <span class="bwb-donor-amount">${formatMoney(c.amount)}</span>
        </div>
      `}),a+=`
      </div>
      <div class="bwb-story-meta">
        <span class="bwb-story-source">Source: ${e.donors[0].filing_type}</span>
        ${e.donors.some(c=>c.flags?.includes("large_donation"))?'<span class="bwb-story-flag flag-warning">LARGE DONATIONS</span>':""}
      </div>
      <div class="bwb-story-actions">
        <a href="${e.donors[0].source_url}" target="_blank" class="bwb-story-btn">View FEC Filing</a>
        <button class="bwb-story-btn btn-outline" onclick="shareTrail('${e.recipient.replace(/'/g,"\\'")}', '${formatMoney(e.total)}', '${r}', '${l}')">Share</button>
      </div>
    </article>
    `}),o.innerHTML=a}function renderTable(t){const o=document.querySelector("#donor-table tbody");if(!o)return;const n=[...t].sort((e,i)=>i.amount-e.amount);let a="";n.forEach(e=>{const i=getOfficeBadge(e.recipient_office),r=getDonorTypeBadge(e.donor_type);a+=`
    <tr>
      <td>${e.donor}</td>
      <td><span class="bwb-badge">${r}</span></td>
      <td>$${e.amount.toLocaleString()}</td>
      <td>${e.recipient}</td>
      <td><span class="bwb-badge">${i}</span></td>
      <td>${e.recipient_state}</td>
      <td><a href="${e.source_url}" target="_blank">${e.filing_type}</a></td>
    </tr>
    `}),o.innerHTML=a}function shareTrail(t,o,n,a){const e=`${t} (${n}-${a}) received ${o} in traced donations. Source: FEC filings. #CorruptionTracker #FollowTheMoney`;navigator.share?navigator.share({title:"USA Corruption Tracker",text:e,url:window.location.href}):(navigator.clipboard.writeText(e),alert("Copied to clipboard"))}async function init(){const t=await loadCorruptionData();if(isV2(t))renderV2(t);else{renderCards(t),renderTable(t);const o=document.querySelector(".bwb-page-title");if(o){const n=t.reduce((a,e)=>a+e.amount,0);o.textContent=`USA CORRUPTION TRACKER \u2014 ${t.length} DONATIONS | $${(n/1e6).toFixed(1)}M TRACED`}}}function renderV2(t){renderV2PacGrid(t.tier1_pacs||[]),renderV2MoneyTrail(t.money_trail||[]),renderV2Thesis(t);const o=document.querySelector(".bwb-page-title");if(o){const n=(t.tier1_pacs||[]).length,a=(t.money_trail||[]).length;o.textContent=`USA CORRUPTION TRACKER \u2014 ${n} PRO-ISRAEL PACs | ${a} MONEY-TRAIL ROWS`}}function renderV2Thesis(t){const o=document.getElementById("money-trail-feed");if(!o)return;const n=t.thesis||"",a=t.substrate_definition||"",e=t.primary_source_policy||"";if(!document.getElementById("v2-thesis")){const i=document.createElement("div");i.id="v2-thesis",i.className="bwb-trades-explainer",i.style.marginBottom="1.5rem",i.innerHTML=`
      <h3 class="bwb-sidebar-title">V2 SUBSTRATE: PRO-ISRAEL PAC MONEY TRAIL</h3>
      <p class="bwb-sidebar-body"><strong>Thesis:</strong> ${escapeHtml(n)}</p>
      <p class="bwb-sidebar-body"><strong>Scope:</strong> ${escapeHtml(a)}</p>
      <p class="bwb-sidebar-body"><strong>Money trail chain:</strong> Donor &rarr; Lobbyist &rarr; Congress &rarr; Agency &rarr; Rule &rarr; Contract</p>
      <p class="bwb-sidebar-body" style="opacity:.75;font-size:.85rem;"><strong>Primary-source policy:</strong> ${escapeHtml(e)}</p>
    `,o.parentNode.insertBefore(i,o)}}function renderV2PacGrid(t){const o=document.getElementById("money-trail-feed");if(!o||!t.length)return;const n=document.createElement("div");n.id="v2-pac-grid",n.className="bwb-feed",n.style.display="grid",n.style.gridTemplateColumns="repeat(auto-fill, minmax(320px, 1fr))",n.style.gap="1rem",n.style.marginBottom="2rem",t.forEach((a,e)=>{const i=a.fec_committee_id||"no-FEC",r=a.fec_url||`https://www.fec.gov/data/committees/?q=${encodeURIComponent(a.name||a.short_name||"")}`,l=a.opensecrets_url||"#",c=document.createElement("article");c.className="bwb-story-card",c.dataset.pacId=i,c.innerHTML=`
      <div class="bwb-story-header">
        <span class="bwb-story-section">${escapeHtml(a.type||"PAC")}</span>
        <span class="bwb-story-flag">${escapeHtml(a.hq_state||"")} ${a.founded?"&middot; f. "+escapeHtml(String(a.founded)):""}</span>
      </div>
      <h2 class="bwb-story-title">${escapeHtml(a.name)}</h2>
      <p class="bwb-sidebar-body" style="font-size:.85rem;opacity:.85;">${escapeHtml(a.notes||"")}</p>
      <div class="bwb-story-meta">
        <span class="bwb-story-source">FEC: ${escapeHtml(i)}</span>
      </div>
      <div class="bwb-story-actions">
        <a href="${escapeAttr(r)}" target="_blank" rel="noopener" class="bwb-story-btn">FEC Filing</a>
        <a href="${escapeAttr(l)}" target="_blank" rel="noopener" class="bwb-story-btn btn-outline">OpenSecrets</a>
      </div>
    `,n.appendChild(c)}),o.parentNode.insertBefore(n,o)}function renderV2MoneyTrail(t){const o=document.getElementById("donor-table");if(!o)return;let n=document.getElementById("v2-money-trail-container");n&&n.remove(),n=document.createElement("div"),n.id="v2-money-trail-container",n.className="bwb-corruption-table-container",n.style.marginTop="2rem",n.innerHTML=`
    <h3 class="bwb-sidebar-title">MONEY TRAIL: DONOR &rarr; LOBBYIST &rarr; CONGRESS &rarr; AGENCY &rarr; RULE &rarr; CONTRACT</h3>
    <p class="bwb-sidebar-body" style="opacity:.75;font-size:.85rem;">Sortable columns. Click any column header to re-sort. Click any bill/vote URL to open the primary source. <span class="bwb-badge">${t.length} ROWS</span> <span class="bwb-badge" style="background:#666;">SCAFFOLD &mdash; OPERATOR VERIFIES</span></p>
    <table class="bwb-corruption-table" id="v2-money-trail-table">
      <thead>
        <tr>
          <th data-sort="donor_pac">Donor / PAC</th>
          <th data-sort="donor_amount_to_congress">Amount</th>
          <th data-sort="lobbyist_registrant">Lobbyist / Registrant</th>
          <th data-sort="congress_member">Congress Member</th>
          <th data-sort="bill_or_rule">Bill / Rule</th>
          <th data-sort="vote_url">Roll-call Vote</th>
          <th data-sort="verified">Verified</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `,o.parentNode.parentNode.appendChild(n);const a=n.querySelector("tbody");t.forEach(r=>{const l=document.createElement("tr"),c=r.donor_pac_fec?` <a href="https://www.fec.gov/data/committee/${escapeAttr(r.donor_pac_fec)}/" target="_blank" rel="noopener">[FEC]</a>`:"",p=r.bill_url?`<a href="${escapeAttr(r.bill_url)}" target="_blank" rel="noopener">${escapeHtml(r.bill_or_rule_id||r.bill_or_rule||"bill")}</a>`:escapeHtml(r.bill_or_rule||""),s=r.vote_url?`<a href="${escapeAttr(r.vote_url)}" target="_blank" rel="noopener">${escapeHtml((r.vote_record||"vote").slice(0,60))}</a>`:escapeHtml(r.vote_record||""),u=r.verified?'<span class="bwb-badge" style="background:#2e7d32;">VERIFIED</span>':'<span class="bwb-badge" style="background:#999;">SCAFFOLD</span>';l.innerHTML=`
      <td>${escapeHtml(r.donor_pac||"")}${c}</td>
      <td>${r.amount?"$"+Number(r.amount).toLocaleString():"TBD"}</td>
      <td>${escapeHtml(r.lobbyist_registrant||r.lobbyist||"n/a")}</td>
      <td>${escapeHtml(r.congress_member||"")}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(r.congress_office||"")} &middot; ${escapeHtml(r.congress_state||"")}</span></td>
      <td>${p}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(r.agency||"")}${r.contract_id?" &middot; "+escapeHtml(r.contract_id):""}</span></td>
      <td>${s}</td>
      <td>${u}</td>
    `,l.dataset.row=JSON.stringify(r),a.appendChild(l)});let e="donor_amount_to_congress",i=-1;n.querySelectorAll("th[data-sort]").forEach(r=>{r.style.cursor="pointer",r.addEventListener("click",()=>{const l=r.getAttribute("data-sort");l===e?i=-i:(e=l,i=l==="verified"?1:-1);const c=[...t].sort((s,u)=>{const d=s[e],b=u[e];return d==null&&b==null?0:d==null?1:b==null?-1:typeof d=="number"&&typeof b=="number"?(d-b)*i:String(d).localeCompare(String(b))*i}),p=n.querySelector("tbody");p.innerHTML="",c.forEach(s=>{const u=document.createElement("tr"),d=s.donor_pac_fec?` <a href="https://www.fec.gov/data/committee/${escapeAttr(s.donor_pac_fec)}/" target="_blank" rel="noopener">[FEC]</a>`:"",b=s.bill_url?`<a href="${escapeAttr(s.bill_url)}" target="_blank" rel="noopener">${escapeHtml(s.bill_or_rule_id||s.bill_or_rule||"bill")}</a>`:escapeHtml(s.bill_or_rule||""),f=s.vote_url?`<a href="${escapeAttr(s.vote_url)}" target="_blank" rel="noopener">${escapeHtml((s.vote_record||"vote").slice(0,60))}</a>`:escapeHtml(s.vote_record||""),y=s.verified?'<span class="bwb-badge" style="background:#2e7d32;">VERIFIED</span>':'<span class="bwb-badge" style="background:#999;">SCAFFOLD</span>';u.innerHTML=`
          <td>${escapeHtml(s.donor_pac||"")}${d}</td>
          <td>${s.amount?"$"+Number(s.amount).toLocaleString():"TBD"}</td>
          <td>${escapeHtml(s.lobbyist_registrant||s.lobbyist||"n/a")}</td>
          <td>${escapeHtml(s.congress_member||"")}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(s.congress_office||"")} &middot; ${escapeHtml(s.congress_state||"")}</span></td>
          <td>${b}<br><span style="opacity:.7;font-size:.8em;">${escapeHtml(s.agency||"")}${s.contract_id?" &middot; "+escapeHtml(s.contract_id):""}</span></td>
          <td>${f}</td>
          <td>${y}</td>
        `,p.appendChild(u)})})})}function escapeHtml(t){return t==null?"":String(t).replace(/[&<>"']/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[o])}function escapeAttr(t){return escapeHtml(t)}document.addEventListener("DOMContentLoaded",init);
