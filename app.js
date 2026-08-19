'use strict';

const $ = (selector) => document.querySelector(selector);
const storeKey = 'adforge_deepseek_settings';
let campaign = null;

const limits = {
  headline: 29,
  description: 89,
  sitelinkText: 24,
  sitelinkDescription: 34,
  callout: 24,
  path: 15
};

const els = {
  modal: $('#settingsModal'), apiKey: $('#apiKey'), model: $('#model'), endpoint: $('#endpoint'),
  dot: $('#apiDot'), status: $('#apiStatus'), generate: $('#generateBtn'), error: $('#errorBox'),
  empty: $('#empty'), results: $('#results')
};

function getSettings() {
  try { return JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { return {}; }
}

function syncSettings() {
  const settings = getSettings();
  els.apiKey.value = settings.apiKey || '';
  els.model.value = settings.model || 'deepseek-chat';
  els.endpoint.value = settings.endpoint || 'https://api.deepseek.com/chat/completions';
  els.dot.classList.toggle('on', Boolean(settings.apiKey));
  els.status.textContent = settings.apiKey ? `Đã kết nối ${settings.model || 'deepseek-chat'}` : 'Chưa cấu hình API';
}

function showError(message) { els.error.textContent = message; els.error.classList.add('show'); }
function clearError() { els.error.classList.remove('show'); }
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 1800);
}
function esc(value = '') { return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`); }
function charLength(value) { return [...String(value || '')].length; }
function isWithin(value, max) { return charLength(value) <= max; }
function fitText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (charLength(text) <= max) return text;
  const chars = [...text].slice(0, max + 1).join('');
  const cut = chars.lastIndexOf(' ');
  return (cut > Math.floor(max * 0.55) ? chars.slice(0, cut) : [...text].slice(0, max).join(''))
    .replace(/[,:;.!?\s]+$/, '').trim();
}
function titleCase(value) {
  return String(value || '').replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
function tabClean(value) { return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim(); }
function exactKeyword(value) {
  const clean = String(value || '').replace(/^\[|\]$/g, '').trim();
  return clean ? `[${clean}]` : '';
}

function cleanJsonText(value) {
  const text = String(value || '').replace(/^\uFEFF/, '').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function parseCampaignJson(value) {
  const text = cleanJsonText(value);
  if (!text) throw new Error('EMPTY_JSON');
  try {
    return JSON.parse(text);
  } catch (error) {
    const likelyTruncated = !text.endsWith('}') || /unterminated|unexpected end/i.test(error.message);
    throw new Error(likelyTruncated ? 'TRUNCATED_JSON' : 'INVALID_JSON');
  }
}

async function requestCampaign(settings, messages) {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.model || 'deepseek-chat', messages, temperature: 0.2,
      max_tokens: 6500, response_format: { type: 'json_object' }
    })
  });
  const rawText = await response.text();
  let raw;
  try { raw = JSON.parse(rawText); } catch { throw new Error('DeepSeek trả về phản hồi HTTP không hợp lệ. Vui lòng thử lại.'); }
  if (!response.ok) throw new Error(raw.error?.message || `Lỗi API ${response.status}`);
  const choice = raw.choices?.[0];
  if (!choice?.message?.content) throw new Error('DeepSeek không trả về nội dung chiến dịch.');
  if (choice.finish_reason === 'length') throw new Error('TRUNCATED_JSON');
  return choice.message.content;
}

function parseKeywordResearch(raw) {
  if (!raw.trim()) return [];
  const lines = raw.trim().split(/\r?\n/);
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const start = /keyword|từ khóa/i.test(lines[0]) ? 1 : 0;
  return lines.slice(start).map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    return {
      keyword: cells[0] || '', volume: Number(String(cells[1] || '').replace(/[^0-9.]/g, '')) || 0,
      source: cells[2] || '', cpc_min: cells[3] || '', cpc_max: cells[4] || ''
    };
  }).filter((row) => row.keyword && row.volume > 500 && row.keyword.split(/\s+/).length <= 4 && row.source);
}

function normalize(data, url, researchRows) {
  const allowed = new Map(researchRows.map((row) => [row.keyword.toLowerCase(), row]));
  const suggestions = (data.keywords || []).map((item) => typeof item === 'string' ? item : item.keyword)
    .map((keyword) => String(keyword || '').replace(/^\[|\]$/g, '').trim())
    .filter((keyword, index, list) => keyword && keyword.split(/\s+/).length <= 4 && list.findIndex((entry) => entry.toLowerCase() === keyword.toLowerCase()) === index);
  const selected = researchRows.length ? suggestions.filter((keyword) => allowed.has(keyword.toLowerCase())) : suggestions;
  const keywordStats = selected.filter((keyword) => allowed.has(keyword.toLowerCase())).map((keyword) => allowed.get(keyword.toLowerCase()));
  return {
    product: data.product || {}, analysis: data.analysis || {}, usps: (data.usps || []).slice(0, 3), policyRisks: data.policy_risks || [],
    headlines: (data.headlines || []).slice(0, 15).map((item) => fitText(titleCase(item), limits.headline)),
    descriptions: (data.descriptions || []).slice(0, 4).map((item) => fitText(titleCase(item), limits.description)),
    finalUrl: url,
    path1: fitText(data.display_path?.path1 || 'Official', limits.path).replace(/\s+/g, '-'),
    path2: fitText(data.display_path?.path2 || 'Order-Online', limits.path).replace(/\s+/g, '-'),
    sitelinks: (data.sitelinks || []).slice(0, 6).map((item) => ({
      text: fitText(titleCase(item.text), limits.sitelinkText),
      description1: fitText(titleCase(item.description1), limits.sitelinkDescription),
      description2: fitText(titleCase(item.description2), limits.sitelinkDescription)
    })),
    callouts: (data.callouts || []).slice(0, 10).map((item) => fitText(titleCase(item), limits.callout)),
    snippets: (data.structured_snippets || []).slice(0, 2).map((item) => ({ header: item.header || 'Types', values: (item.values || []).slice(0, 5) })),
    promotionTarget: fitText(titleCase(data.promotion_target || 'Sitewide Orders'), 20),
    keywords: selected, keywordStats, keywordsVerified: researchRows.length > 0, sourceVerified: Boolean(data.source_verified),
    negativeKeywords: data.negative_keywords || []
  };
}

function codeBox(title, id, content, note = '') {
  const lines = String(content).split(/\r?\n/).filter((line) => line.trim());
  const preview = lines.map((line, index) => {
    const cells = line.split('\t');
    return `<div class="data-row"><span class="row-number">${index + 1}</span><div class="data-cells">${cells.map((cell) => `<span>${esc(cell)}</span>`).join('')}</div></div>`;
  }).join('');
  return `<section class="panel section output-section"><div class="section-head"><div><span class="section-kicker">Google Ads Asset</span><h3>${esc(title)}</h3></div><button class="secondary copy-code" data-target="${id}">Sao chép</button></div>${note}<div class="data-list">${preview}</div><textarea id="${id}" class="copy-data" aria-hidden="true" tabindex="-1">${esc(content)}</textarea></section>`;
}

function assetRow(label, value, max = 0) {
  const count = max ? `<span class="asset-count ${isWithin(value, max) ? '' : 'over'}">${charLength(value)}/${max}</span>` : '';
  return `<div class="asset-row"><span class="asset-label">${esc(label)}</span><span class="asset-value">${esc(value)}</span>${count}</div>`;
}

function rsaBox(c) {
  const rows = c.headlines.map((value, index) => assetRow(`Headline ${index + 1}`, value, limits.headline))
    .concat(c.descriptions.map((value, index) => assetRow(`Description ${index + 1}`, value, limits.description)))
    .concat([assetRow('Final URL', c.finalUrl), assetRow('Path 1', c.path1, limits.path), assetRow('Path 2', c.path2, limits.path)]);
  return `<section class="panel section output-section featured-section"><div class="section-head"><div><span class="section-kicker">Responsive Search Ad</span><h3>Quảng cáo tìm kiếm thích ứng - RSA</h3></div><button class="secondary copy-code" data-target="rsaCode">Sao chép từng hàng</button></div><div class="asset-list">${rows.join('')}</div><textarea id="rsaCode" class="copy-data" aria-hidden="true" tabindex="-1">${esc(rsaRows(c))}</textarea></section>`;
}

function sitelinkBox(c, note) {
  const cards = c.sitelinks.map((item, index) => `<article class="sitelink-row"><div class="sitelink-index">${index + 1}</div><div class="sitelink-fields">${assetRow('Link text', item.text, limits.sitelinkText)}${assetRow('Description 1', item.description1, limits.sitelinkDescription)}${assetRow('Description 2', item.description2, limits.sitelinkDescription)}</div></article>`).join('');
  return `<section class="panel section output-section"><div class="section-head"><div><span class="section-kicker">Ad Extension</span><h3>Liên kết trang web - Sitelinks</h3></div><button class="secondary copy-code" data-target="sitelinkCode">Sao chép</button></div>${note}<div class="sitelink-list">${cards}</div><textarea id="sitelinkCode" class="copy-data" aria-hidden="true" tabindex="-1">${esc(sitelinkTsv(c))}</textarea></section>`;
}

function rsaRows(c) {
  return c.headlines.map((value, index) => `Headline ${index + 1}\t${tabClean(value)}`)
    .concat(c.descriptions.map((value, index) => `Description ${index + 1}\t${tabClean(value)}`))
    .concat([`Final URL\t${tabClean(c.finalUrl)}`, `Path 1\t${tabClean(c.path1)}`, `Path 2\t${tabClean(c.path2)}`])
    .join('\n');
}
function sitelinkTsv(c) {
  const header = 'Link text\tDescription line 1\tDescription line 2';
  return `${header}\n${c.sitelinks.map((item) => [item.text, item.description1, item.description2].map(tabClean).join('\t')).join('\n')}`;
}
function calloutTsv(c) { return `Callout text\n${c.callouts.map(tabClean).join('\n')}`; }
function snippetTsv(c) {
  return `Header\tValues\n${c.snippets.map((item) => `${tabClean(item.header)}\t${(item.values || []).map(tabClean).join('; ')}`).join('\n')}`;
}
function promotionText(c) { return `Promotion Target\n${c.promotionTarget}\n\nPercent discount\n50%\n\nFinal URL\n${c.finalUrl}`; }
function keywordText(c) { return `${c.keywords.map(exactKeyword).join('\n')}\n\n${c.keywordsVerified ? 'Đã lọc theo dữ liệu volume >500 do người dùng cung cấp.' : 'AI Brand Keyword Ideas — CHƯA xác minh volume/CPC. Hãy kiểm tra bằng Keyword Planner trước khi chạy.'}\nCopy cả từ khoá Bình đã nghiên cứu trong Sheet Research và đóng [], nếu trùng thì thôi.`; }
function keywordStatsTsv(c) {
  if (!c.keywordStats.length) return 'Chưa có dữ liệu Keyword Planner được cung cấp. Không có số liệu volume/CPC nào được tạo hoặc suy đoán.';
  return `Keyword\tMonthly searches\tSource\tCPC min\tCPC max\n${c.keywordStats.map((row) => [row.keyword, row.volume, row.source, row.cpc_min, row.cpc_max].map(tabClean).join('\t')).join('\n')}`;
}

function audit(c) {
  const checks = [
    ['RSA đủ 15 Headlines', c.headlines.length === 15],
    ['RSA đủ 4 Descriptions', c.descriptions.length === 4],
    ['Headlines ≤ 29 ký tự', c.headlines.every((item) => isWithin(item, limits.headline))],
    ['Descriptions ≤ 89 ký tự', c.descriptions.every((item) => isWithin(item, limits.description))],
    ['Sitelinks đủ 6 mục', c.sitelinks.length === 6],
    ['Sitelink Text ≤ 24 ký tự', c.sitelinks.every((item) => isWithin(item.text, limits.sitelinkText))],
    ['Sitelink Descriptions ≤ 34 ký tự', c.sitelinks.every((item) => isWithin(item.description1, limits.sitelinkDescription) && isWithin(item.description2, limits.sitelinkDescription))],
    ['Callouts đủ 10 và ≤ 24 ký tự', c.callouts.length === 10 && c.callouts.every((item) => isWithin(item, limits.callout))],
    [c.keywordsVerified ? 'Keywords Exact Match, ≤ 4 từ, volume > 500 đã xác minh' : 'Keyword ideas Exact Match và ≤ 4 từ (volume chưa xác minh)', c.keywords.length > 0 && c.keywords.every((keyword) => keyword.split(/\s+/).length <= 4) && (!c.keywordsVerified || (c.keywordStats.length === c.keywords.length && c.keywordStats.every((row) => row.volume > 500)))],
    [c.sourceVerified ? 'Có 3 USP từ nội dung nguồn' : 'USP chưa xác minh do không cung cấp nội dung nguồn', c.sourceVerified ? c.usps.length >= 3 : true],
    ['Dữ liệu xuất dạng Tab-Delimited', true]
  ];
  return `<section class="panel section output-section"><div class="section-head"><h3>Nhật ký kiểm tra công khai - Audit Log</h3></div><div class="audit-table">${checks.map(([label, ok]) => `<div><strong>${esc(label)}</strong><span class="${ok ? 'audit-ok' : 'audit-fail'}">${ok ? 'ĐẠT' : 'CHƯA ĐẠT'}</span></div>`).join('')}</div><p class="audit-note"><strong>Lưu ý:</strong> Không hệ thống nào có thể bảo đảm Google phê duyệt quảng cáo. Hãy kiểm tra URL, quyền sử dụng thương hiệu, nội dung ưu đãi và chính sách hiện hành trước khi đăng.</p></section>`;
}

function render(data, url, researchRows) {
  campaign = normalize(data, url, researchRows);
  const analysisHtml = `<section class="panel section output-section"><div class="section-head"><h3>Phân tích sâu</h3></div><p><strong>Sản phẩm tôi đang phân tích là:</strong> ${esc(campaign.product.name || 'Chưa xác định')} — <strong>Công dụng/Loại hình:</strong> ${esc(campaign.product.type || '')}</p><p><strong>Phân tích:</strong> ${esc(campaign.analysis.summary || '')}</p><p><strong>USP đã đối chiếu từ nội dung bạn cung cấp:</strong></p><ol>${campaign.usps.map((usp) => `<li>${esc(usp)}</li>`).join('')}</ol><p><strong>Policy Scan:</strong></p><ul>${campaign.policyRisks.map((risk) => `<li>${esc(risk)}</li>`).join('')}</ul></section>`;
  const sitelinkNote = '<p class="section-note"><strong>URL không được tạo tự động.</strong> Hãy thêm URL đích phù hợp bằng công cụ tạo link của sản phẩm khi nhập Sitelinks vào Google Ads.</p>';
  const snippetNote = '<p><strong>[Add\\Campaign Level\\Add New - Quay ra copy bổ sung các Value bằng tay và XÓA NHỮNG CÁI CŨ ĐI]</strong></p>';
  const promoNote = '<p><strong>[COPY PASTE ĐỂ THÀNH KHUYẾN MÃI MỚI VÀ XÓA KHUYẾN MÃI CŨ ĐI, KHÔNG SỬA GÌ Ở KHUYẾN MÃI CŨ, CHỈ XÓA]</strong></p>';
  els.results.innerHTML = analysisHtml
    + codeBox(campaign.keywordsVerified ? 'Từ khóa Brand đã xác minh - Money Keywords' : 'Gợi ý Brand Keywords BOFU', 'keywordsCode', keywordText(campaign))
    + codeBox('Số liệu Keyword Planner', 'keywordStatsCode', keywordStatsTsv(campaign))
    + rsaBox(campaign)
    + sitelinkBox(campaign, sitelinkNote)
    + codeBox('Chú thích - Callouts', 'calloutCode', calloutTsv(campaign))
    + codeBox('Đoạn thông tin có cấu trúc - Structured Snippets', 'snippetCode', snippetTsv(campaign), snippetNote)
    + codeBox('Khuyến mãi - Promotions', 'promotionCode', promotionText(campaign), promoNote)
    + audit(campaign);
  els.empty.style.display = 'none';
  els.results.classList.add('show');
  $('#copyAllBtn').hidden = false;
  $('#newBtn').hidden = false;
}

const systemPrompt = `You are a senior Google Ads and SEM affiliate specialist focused on compliant BOFU brand-search campaigns. Produce persuasive native English copy grounded ONLY in the supplied source text. Never claim you browsed a URL. Never invent product facts, discounts, prices, warranties, authenticity, official-store status, keyword volume, CPC, rankings, reviews, shipping speed, guarantees, or policy approval. Avoid prohibited or absolute claims such as Cure, Guarantee, Instant, 100%, and deceptive urgency. Use Support, Enhance, Formula, or System only when supported by source text.
Return ONLY valid JSON with this schema: {"source_verified":boolean,"product":{"name":"","type":""},"analysis":{"summary":""},"usps":[up to 3 exact quotes copied only from supplied source text],"policy_risks":[strings],"keywords":[20-40 BOFU brand keyword strings],"headlines":[15 strings],"descriptions":[4 strings],"display_path":{"path1":"","path2":""},"sitelinks":[{"text":"","description1":"","description2":""} exactly 6],"callouts":[10 strings],"structured_snippets":[{"header":"Types|Brands|Services|Styles|Courses|Amenities","values":[4-5 strings]} exactly 2],"promotion_target":"","negative_keywords":[strings]}.
Keyword rules: generate exact-match-ready brand keyword ideas with no more than four words each. Cover brand core and spelling variants, brand + buy/price/sale/coupon/store/order, brand + verified product categories or models, and reverse-order variants where natural. Focus only on high purchase intent. When verified keyword research is supplied, select only terms present in it; otherwise generate ideas but never claim or invent search volume, CPC, competition, or source.
Technical rules: all ad assets in English Title Case; every headline at most 29 characters including spaces; every description at most 89; sitelink text at most 24; each sitelink description at most 34; callouts at most 24; display paths at most 15 each. No terminal periods in headlines, sitelink text, or callouts. Keep 15 headlines semantically diverse and BOFU-oriented. The final headline must use {keyword:Brand} syntax with the real brand replacing Brand. Use up to five relevant brand keywords naturally when length permits. Do not generate Promotion discounts; only suggest a neutral promotion target. If source text is insufficient, reflect uncertainty in analysis and avoid unsupported claims.
JSON reliability rules: return one compact JSON object only, with no Markdown fences or commentary. Never insert literal newlines inside string values. Keep analysis.summary under 500 characters, each policy risk under 180 characters, and return at most 30 keywords and 6 policy risks. Escape quotation marks inside strings and always finish the final closing brace.`;

$('#settingsBtn').onclick = () => { syncSettings(); els.modal.classList.add('show'); };
$('#closeModal').onclick = () => els.modal.classList.remove('show');
els.modal.onclick = (event) => { if (event.target === els.modal) els.modal.classList.remove('show'); };
$('#saveSettings').onclick = () => {
  const apiKey = els.apiKey.value.trim(); const endpoint = els.endpoint.value.trim();
  if (!apiKey || !endpoint) return showError('Vui lòng nhập API key và điểm cuối API.');
  localStorage.setItem(storeKey, JSON.stringify({ apiKey, model: els.model.value, endpoint }));
  syncSettings(); els.modal.classList.remove('show'); toast('Đã lưu cài đặt');
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('.copy-code');
  if (!button) return;
  const target = document.getElementById(button.dataset.target);
  navigator.clipboard.writeText(target.value ?? target.textContent);
  toast('Đã sao chép');
});

$('#copyAllBtn').onclick = () => {
  const content = [...document.querySelectorAll('.copy-data')].map((field) => field.value).join('\n\n');
  navigator.clipboard.writeText(content); toast('Đã sao chép toàn bộ nội dung');
};
$('#newBtn').onclick = () => {
  campaign = null; els.results.classList.remove('show'); els.results.innerHTML = '';
  els.empty.style.display = 'grid'; $('#copyAllBtn').hidden = true; $('#newBtn').hidden = true;
};

els.generate.onclick = async () => {
  clearError();
  const settings = getSettings();
  const url = $('#projectUrl').value.trim();
  const source = $('#sourceContent').value.trim();
  const context = $('#context').value.trim();
  const researchRaw = $('#keywordResearch').value.trim();
  if (!settings.apiKey) { els.modal.classList.add('show'); return; }
  try { new URL(url); } catch { return showError('Vui lòng nhập URL hợp lệ, bao gồm https://.'); }
  const researchRows = parseKeywordResearch(researchRaw);
  const old = els.generate.innerHTML;
  els.generate.disabled = true;
  els.generate.innerHTML = '<span class="loader"></span><span>Đang phân tích và tạo chiến dịch...</span>';
  try {
    const keywordInstruction = researchRows.length
      ? `VERIFIED KEYWORD RESEARCH: Select only matching terms from these rows and do not alter metrics:\n${JSON.stringify(researchRows)}`
      : 'NO KEYWORD METRICS PROVIDED: Generate 20-40 strong BOFU brand keyword ideas across all requested brand-intent groups. Do not state volume, CPC, competition, or sources.';
    const sourceInstruction = source
      ? `PAGE SOURCE PROVIDED BY USER:\n${source}\nSet source_verified to true and copy exactly three USP sentences from this source.`
      : 'NO PAGE SOURCE PROVIDED. Set source_verified to false. Use only explicit details in Additional context and safe brand-search wording. Do not claim to have browsed the URL, do not invent USP/product facts, and return an empty usps array when facts cannot be verified.';
    const userPrompt = `Landing page URL: ${url}\nTarget market: ${$('#market').value}\nTone: ${$('#tone').value}\nAdditional context: ${context || 'None'}\n\n${sourceInstruction}\n\n${keywordInstruction}\n\nCreate the campaign now.`;
    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
    let data;
    try {
      data = parseCampaignJson(await requestCampaign(settings, messages));
    } catch (firstError) {
      if (!['TRUNCATED_JSON', 'INVALID_JSON', 'EMPTY_JSON'].includes(firstError.message)) throw firstError;
      els.generate.innerHTML = '<span class="loader"></span><span>JSON chưa hoàn chỉnh, đang tự tạo lại...</span>';
      const retryMessages = messages.concat({
        role: 'user',
        content: 'Regenerate the entire answer as one compact, complete, valid JSON object. Use no Markdown, commentary, literal line breaks inside string values, or trailing commas. Keep analysis and policy-risk strings concise. Include every required key and finish the closing brace.'
      });
      try {
        data = parseCampaignJson(await requestCampaign(settings, retryMessages));
      } catch (retryError) {
        if (['TRUNCATED_JSON', 'INVALID_JSON', 'EMPTY_JSON'].includes(retryError.message)) {
          throw new Error('DeepSeek đã trả về JSON không hoàn chỉnh hai lần. Hãy bấm Tạo chiến dịch để thử lại; ứng dụng đã ngăn dữ liệu lỗi được hiển thị.');
        }
        throw retryError;
      }
    }
    if (!Array.isArray(data.headlines) || !Array.isArray(data.sitelinks)) throw new Error('Mô hình trả về dữ liệu không đúng cấu trúc.');
    render(data, url, researchRows); toast('Đã tạo và kiểm tra chiến dịch');
  } catch (error) {
    showError(error.message === 'Failed to fetch' ? 'Không thể kết nối DeepSeek. Hãy kiểm tra mạng, API endpoint và API key.' : error.message);
  } finally {
    els.generate.disabled = false; els.generate.innerHTML = old;
  }
};

syncSettings();
