// Customer-facing presentation only. No writes to listings, prices, stock or variants.
function text(html) {
  return String(html || '').slice(0, 100000)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/(?:p|div|li|tr|h[1-6])\s*>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:td|th)\s*>/gi, ' | ')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim().slice(0, 16000);
}
function image(url) {
  try { const u = new URL(String(url)); return u.protocol === 'https:' && /(^|\.)cjdropshipping\.com$/.test(u.hostname) ? u.href : null; }
  catch (_) { return null; }
}
function normalize(details) {
  const pictures = [];
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(String(details.description || '').slice(0, 100000))) && pictures.length < 12) {
    const src = image(m[1]);
    if (src && !pictures.includes(src)) pictures.push(src);
  }
  let material = details.material;
  try { material = JSON.parse(material); } catch (_) {}
  return {
    title: text(details.title).slice(0, 250), variant: text(details.variant).slice(0, 200),
    description: text(details.description), material: text(Array.isArray(material) ? material.join(', ') : material).slice(0, 250),
    image: image(details.image), detailImages: pictures
  };
}
module.exports = { text, image, normalize };
