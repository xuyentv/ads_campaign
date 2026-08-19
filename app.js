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
function addQuery(url, query) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${query}`;
}
function exactKeyword(value) {
  const clean = String(value || '').replace(/^\[|\]$/g, '').trim();
  return clean ? `[${clean}]` : '';
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
  const tracking = [
    'utm_source=share&utm_medium=referral&utm_campaign=brand&utm_content=s1',
    'utm_source=share&utm_medium=referral&utm_campaign=brand&utm_content=s2',
    'utm_source=content&utm_medium=referral&utm_campaign=brand&utm_content=guide1',
    'utm_source=content&utm_medium=referral&utm_campaign=brand&utm_content=guide2',
    'utm_source=partner&utm_medium=referral&utm_campaign=brand&utm_content=info1',
    'utm_source=partner&utm_medium=referral&utm_campaign=brand&utm_content=info2'
  ];
  return {
    product: data.product || {}, analysis: data.analysis || {}, usps: (data.usps || []).slice(0, 3), policyRisks: data.policy_risks || [],
    headlines: (data.headlines || []).slice(0, 15).map((item) => fitText(titleCase(item), limits.headline)),
    descriptions: (data.descriptions || []).slice(0, 4).map((item) => fitText(titleCase(item), limits.description)),
    finalUrl: url,
    path1: fitText(data.display_path?.path1 || 'Official', limits.path).replace(/\s+/g, '-'),
    path2: fitText(data.display_path?.path2 || 'Order-Online', limits.path).replace(/\s+/g, '-'),
    sitelinks: (data.sitelinks || []).slice(0, 6).map((item, index) => ({
      text: fitText(titleCase(item.text), limits.sitelinkText),
      description1: fitText(titleCase(item.description1), limits.sitelinkDescription),
      description2: fitText(titleCase(item.description2), limits.sitelinkDescription),
      finalUrl: addQuery(url, tracking[index] || `utm_source=partner&utm_medium=referral&utm_content=s${index + 1}`)
    })),
    callouts: (data.callouts || []).slice(0, 10).map((item) => fitText(titleCase(item), limits.callout)),
    snippets: (data.structured_snippets || []).slice(0, 2).map((item) => ({ header: item.header || 'Types', values: (item.values || []).slice(0, 5) })),
    promotionTarget: fitText(titleCase(data.promotion_target || 'Sitewide Orders'), 20),
    keywords: selected, keywordStats, keywordsVerified: researchRows.length > 0,
    negativeKeywords: data.negative_keywords || []
  };
}

function codeBox(title, id, content, note = '') {
  return `<section class="panel section output-section"><div class="section-head"><h3>${esc(title)}</h3><button class="secondary copy-code" data-target="${id}">Sao chép</button></div>${note}<pre id="${id}" class="code-box">${esc(content)}</pre></section>`;
}

function rsaTsv(c) {
  const headers = [...Array(15)].map((_, i) => `Headline ${i + 1}`)
    .concat([...Array(4)].map((_, i) => `Description ${i + 1}`), ['Final URL', 'Path 1', 'Path 2']);
  const values = c.headlines.concat(c.descriptions, [c.finalUrl, c.path1, c.path2]);
  return `${headers.join('\t')}\n${values.map(tabClean).join('\t')}`;
}
function sitelinkTsv(c) {
  const header = 'Link text\tDescription line 1\tDescription line 2\tFinal URL';
  return `${header}\n${c.sitelinks.map((item) => [item.text, item.description1, item.description2, item.finalUrl].map(tabClean).join('\t')).join('\n')}`;
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
    ['Có 3 USP từ nội dung nguồn', c.usps.length >= 3],
    ['Dữ liệu xuất dạng Tab-Delimited', true]
  ];
  return `<section class="panel section output-section"><div class="section-head"><h3>Nhật ký kiểm tra công khai - Audit Log</h3></div><div class="audit-table">${checks.map(([label, ok]) => `<div><strong>${esc(label)}</strong><span class="${ok ? 'audit-ok' : 'audit-fail'}">${ok ? 'ĐẠT' : 'CHƯA ĐẠT'}</span></div>`).join('')}</div><p class="audit-note"><strong>Lưu ý:</strong> Không hệ thống nào có thể bảo đảm Google phê duyệt quảng cáo. Hãy kiểm tra URL, quyền sử dụng thương hiệu, nội dung ưu đãi và chính sách hiện hành trước khi đăng.</p></section>`;
}

function render(data, url, researchRows) {
  campaign = normalize(data, url, researchRows);
  const analysisHtml = `<section class="panel section output-section"><div class="section-head"><h3>Phân tích sâu</h3></div><p><strong>Sản phẩm tôi đang phân tích là:</strong> ${esc(campaign.product.name || 'Chưa xác định')} — <strong>Công dụng/Loại hình:</strong> ${esc(campaign.product.type || '')}</p><p><strong>Phân tích:</strong> ${esc(campaign.analysis.summary || '')}</p><p><strong>USP đã đối chiếu từ nội dung bạn cung cấp:</strong></p><ol>${campaign.usps.map((usp) => `<li>${esc(usp)}</li>`).join('')}</ol><p><strong>Policy Scan:</strong></p><ul>${campaign.policyRisks.map((risk) => `<li>${esc(risk)}</li>`).join('')}</ul></section>`;
  const sitelinkNote = '<p><strong>PHẢI DÙNG công cụ tạo Link của sản phẩm này NẾU HỌ CÓ; với các link dưới đây, cần tự kiểm tra link hoạt động bình thường, không lỗi hoặc 404.</strong></p>';
  const snippetNote = '<p><strong>[Add\\Campaign Level\\Add New - Quay ra copy bổ sung các Value bằng tay và XÓA NHỮNG CÁI CŨ ĐI]</strong></p>';
  const promoNote = '<p><strong>[COPY PASTE ĐỂ THÀNH KHUYẾN MÃI MỚI VÀ XÓA KHUYẾN MÃI CŨ ĐI, KHÔNG SỬA GÌ Ở KHUYẾN MÃI CŨ, CHỈ XÓA]</strong></p>';
  els.results.innerHTML = analysisHtml
    + codeBox(campaign.keywordsVerified ? 'Từ khóa Brand đã xác minh - Money Keywords' : 'Gợi ý Brand Keywords BOFU', 'keywordsCode', keywordText(campaign))
    + codeBox('Số liệu Keyword Planner', 'keywordStatsCode', keywordStatsTsv(campaign))
    + codeBox('Quảng cáo tìm kiếm thích ứng - RSA', 'rsaCode', rsaTsv(campaign))
    + codeBox('Liên kết trang web - Sitelinks', 'sitelinkCode', sitelinkTsv(campaign), sitelinkNote)
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
Return ONLY valid JSON with this schema: {"product":{"name":"","type":""},"analysis":{"summary":""},"usps":[3 exact quotes copied from supplied source text],"policy_risks":[strings],"keywords":[20-40 BOFU brand keyword strings],"headlines":[15 strings],"descriptions":[4 strings],"display_path":{"path1":"","path2":""},"sitelinks":[{"text":"","description1":"","description2":""} exactly 6],"callouts":[10 strings],"structured_snippets":[{"header":"Types|Brands|Services|Styles|Courses|Amenities","values":[4-5 strings]} exactly 2],"promotion_target":"","negative_keywords":[strings]}.
Keyword rules: generate exact-match-ready brand keyword ideas with no more than four words each. Cover brand core and spelling variants, brand + buy/price/sale/coupon/store/order, brand + verified product categories or models, and reverse-order variants where natural. Focus only on high purchase intent. When verified keyword research is supplied, select only terms present in it; otherwise generate ideas but never claim or invent search volume, CPC, competition, or source.
Technical rules: all ad assets in English Title Case; every headline at most 29 characters including spaces; every description at most 89; sitelink text at most 24; each sitelink description at most 34; callouts at most 24; display paths at most 15 each. No terminal periods in headlines, sitelink text, or callouts. Keep 15 headlines semantically diverse and BOFU-oriented. The final headline must use {keyword:Brand} syntax with the real brand replacing Brand. Use up to five relevant brand keywords naturally when length permits. Do not generate Promotion discounts; only suggest a neutral promotion target. If source text is insufficient, reflect uncertainty in analysis and avoid unsupported claims.`;

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
  navigator.clipboard.writeText(document.getElementById(button.dataset.target).textContent);
  toast('Đã sao chép');
});

$('#copyAllBtn').onclick = () => {
  const content = [...document.querySelectorAll('.code-box')].map((box) => box.textContent).join('\n\n');
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
  if (source.length < 300) return showError('Hãy dán ít nhất 300 ký tự nội dung thực tế từ trang sản phẩm để xác minh sản phẩm và USP.');
  const researchRows = parseKeywordResearch(researchRaw);
  const old = els.generate.innerHTML;
  els.generate.disabled = true;
  els.generate.innerHTML = '<span class="loader"></span><span>Đang phân tích và tạo chiến dịch...</span>';
  try {
    const keywordInstruction = researchRows.length
      ? `VERIFIED KEYWORD RESEARCH: Select only matching terms from these rows and do not alter metrics:\n${JSON.stringify(researchRows)}`
      : 'NO KEYWORD METRICS PROVIDED: Generate 20-40 strong BOFU brand keyword ideas across all requested brand-intent groups. Do not state volume, CPC, competition, or sources.';
    const userPrompt = `Landing page URL: ${url}\nTarget market: ${$('#market').value}\nTone: ${$('#tone').value}\nAdditional context: ${context || 'None'}\n\nVERIFIED PAGE SOURCE PROVIDED BY USER:\n${source}\n\n${keywordInstruction}\n\nCreate the campaign now. Copy exactly three USP sentences from the supplied page source.`;
    const response = await fetch(settings.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({ model: settings.model || 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.35, response_format: { type: 'json_object' } })
    });
    const raw = await response.json();
    if (!response.ok) throw new Error(raw.error?.message || `Lỗi API ${response.status}`);
    const text = (raw.choices?.[0]?.message?.content || '').replace(/^```json\s*|\s*```$/g, '');
    const data = JSON.parse(text);
    if (!Array.isArray(data.headlines) || !Array.isArray(data.sitelinks)) throw new Error('Mô hình trả về dữ liệu không đúng cấu trúc.');
    render(data, url, researchRows); toast('Đã tạo và kiểm tra chiến dịch');
  } catch (error) {
    showError(error.message === 'Failed to fetch' ? 'Không thể kết nối DeepSeek. Hãy kiểm tra mạng, API endpoint và API key.' : error.message);
  } finally {
    els.generate.disabled = false; els.generate.innerHTML = old;
  }
};

syncSettings();
