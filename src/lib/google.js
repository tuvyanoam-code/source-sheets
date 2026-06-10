// חיפוש דרך Google Programmable Search (Custom Search JSON API) — מוגבל לספריא+ויקיטקסט.
// דורש מפתח API ומזהה מנוע חיפוש (cx) מההגדרות. חינמי עד 100 חיפושים/יום.
// ה-API הזה פתוח ל-CORS, ולכן אפשר לקרוא לו ישירות מהדפדפן/WebView.
const ENDPOINT = 'https://www.googleapis.com/customsearch/v1'

// ממיר קישור-תוצאה ל-ref של ספריא או לכותרת ויקיטקסט.
export function linkToRef(link) {
  let u
  try {
    u = new URL(link)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'sefaria.org' || host === 'sefaria.org.il') {
    let p = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
    // מדלגים על דפים שאינם טקסט (נושאים, דפי מקורות, חיפוש, API, גרסאות)
    if (!p || /^(topics|sheets|search|api|texts|collections|groups|profile|story_editor|calendars|\.)/i.test(p))
      return null
    if (p.includes('/')) return null
    p = p.replace(/_/g, ' ').replace(/%2C/gi, ',').trim()
    return { ref: p, source: 'ספריא' }
  }
  if (host.endsWith('wikisource.org')) {
    let t = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ''))
    if (!t || t.includes(':')) return null // דפים מיוחדים
    t = t.replace(/_/g, ' ').trim()
    return { ref: 'ws:' + t, source: 'ויקיטקסט' }
  }
  return null
}

// מחזיר רשימת מועמדים [{ ref, source }] לפי דירוג גוגל.
export async function googleSourceSearch(query, cfg) {
  if (!cfg || !cfg.googleKey || !cfg.googleCx) return []
  const q = `${query} site:sefaria.org OR site:he.wikisource.org`
  const url =
    `${ENDPOINT}?key=${encodeURIComponent(cfg.googleKey)}` +
    `&cx=${encodeURIComponent(cfg.googleCx)}&num=8&q=${encodeURIComponent(q)}`
  let items = []
  try {
    const data = await (await fetch(url)).json()
    if (data.error) return []
    items = data.items || []
  } catch {
    return []
  }
  const out = []
  const seen = new Set()
  for (const it of items) {
    const r = linkToRef(it.link)
    if (r && !seen.has(r.ref)) {
      seen.add(r.ref)
      out.push(r)
    }
  }
  return out
}
