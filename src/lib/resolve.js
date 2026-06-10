// פענוח ניסוח חופשי בעברית ל-reference מדויק של ספריא — חינמי, ללא מפתח, ובר-קיימא.
// עקרונות בטיחות:
//  1. הטוקן הראשון של השאילתה חייב להתאים לשם הספר/המפרש — כדי שלעולם לא "נחליק"
//     ל"גמרא סנהדרין" כשמבקשים "רשב"א על סנהדרין".
//  2. מקורות פרשנות ("<מפרש> על <מסכת/חומש>") נבנים ומאומתים מול ספריא; אם הצירוף לא
//     קיים — נכשלים *ביושר* ומציעים על מה המפרש כן קיים, במקום להחזיר מקור אחר.

import { searchWikisource } from './wikisource.js'
import { googleSourceSearch } from './google.js'

const BASE = 'https://www.sefaria.org/api'

// ---------- נרמול עברי ----------
const NIQQUD = /[֑-ׇֽ]/g
const GERESH = /['"׳״`]/g
// norm — להשוואות פנימיות (מסיר ניקוד + גרשיים)
const norm = (s) => (s || '').replace(NIQQUD, '').replace(GERESH, '').trim()
// normLight — למחרוזות שנשלחות לספריא: משמר גרשיים, כי הם מבחינים ראשי-תיבות
// (רש"י ≠ "רשימות", רשב"א ≠ ...). מסיר רק ניקוד/טעמים.
const normLight = (s) => (s || '').replace(NIQQUD, '').trim()

const CONNECTORS = new Set([
  'על', 'פרשת', 'פרשה', 'פרק', 'פסוק', 'של', 'דף', 'עמוד', 'ספר',
  'מסכת', 'הלכות', 'סימן', 'את', 'עמ', 'ד',
  // מילות-רעש לגמרא — הספר בספריא הוא רק שם המסכת ("ברכות"), לא "גמרא ברכות"
  'גמרא', 'גמ', 'תלמוד', 'בבלי',
])
const PREFIX = 'לבמהושכ'
const stripPref = (w) => (w.length > 2 && PREFIX.includes(w[0]) ? w.slice(1) : w)

// טוקנים משמרים גרשיים (לצורך שליחה לספריא); ההשוואות מסירות אותם בהמשך.
const tokens = (s) =>
  normLight(s)
    .replace(/[,.;:]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !CONNECTORS.has(norm(t)))

// וריאציות מלא/חסר של מילה (כולל צורה ללא אות-שימוש פותחת)
function wordVariants(w) {
  const s = norm(w)
  const pos = []
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] === 'י' || s[i] === 'ו') pos.push(i)
    if (pos.length >= 4) break
  }
  const out = new Set()
  for (let mask = 0; mask < 1 << pos.length; mask++) {
    const ch = s.split('')
    for (let k = 0; k < pos.length; k++) if (mask & (1 << k)) ch[pos[k]] = ''
    const v = ch.join('')
    if (v) {
      out.add(v)
      out.add(stripPref(v))
    }
  }
  return out
}
function wordsMatch(a, b) {
  const va = wordVariants(a)
  for (const x of wordVariants(b)) if (va.has(x)) return true
  return false
}

// צורות-שאילתה לקריאות name API: צורה עם גרשיים (מבחינה ראשי-תיבות),
// צורה בלי גרשיים, ווריאציות מלא/חסר.
function queryForms(text) {
  const out = []
  const seen = new Set()
  const add = (v) => {
    const t = (v || '').trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  add(normLight(text)) // עם גרשיים
  const s = norm(text) // בלי גרשיים
  add(s)
  // צורת ראשי-תיבות: גרשיים לפני האות האחרונה של המילה הראשונה (רשי→רש"י, רמבם→רמב"ם)
  const words = normLight(text).split(/\s+/)
  if (words[0] && /^[א-ת]{3,5}$/.test(words[0])) {
    const w = words[0]
    add([w.slice(0, -1) + '"' + w.slice(-1), ...words.slice(1)].join(' '))
  }
  const pos = []
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] === 'י' || s[i] === 'ו') pos.push(i)
    if (pos.length >= 4) break
  }
  for (let mask = 1; mask < 1 << pos.length && out.length < 10; mask++) {
    const ch = s.split('')
    for (let k = 0; k < pos.length; k++) if (mask & (1 << k)) ch[pos[k]] = ''
    add(ch.join(''))
  }
  return out
}

// ---------- מטמון בקשות ----------
const cache = new Map()
async function getJson(url) {
  if (cache.has(url)) return cache.get(url)
  let data
  try {
    const res = await fetch(url)
    data = res.ok ? await res.json() : { error: `HTTP ${res.status}` }
  } catch (e) {
    data = { error: String(e) }
  }
  cache.set(url, data)
  return data
}
const nameApi = (q) => getJson(`${BASE}/name/${encodeURIComponent(q)}`)
const indexApi = (title) => getJson(`${BASE}/index/${encodeURIComponent(title)}`)
async function textExists(ref) {
  const d = await getJson(
    `${BASE}/v3/texts/${encodeURIComponent(ref)}?return_format=text_only`,
  )
  return { ok: !d.error, heRef: d.heRef }
}

// כל קריאות ה-name לוריאציות איות במקביל
async function nameVariants(str) {
  const res = await Promise.all(
    queryForms(str).map((v) =>
      nameApi(v).then((d) => ({ v, d })).catch(() => null),
    ),
  )
  return res.filter(Boolean)
}

// ---------- התאמת ספר (לא-פרשנות): תחילית רציפה מהטוקן הראשון ----------
// מקבלים מועמד רק אם הטוקן הראשון מותאם, וההתאמה רציפה מההתחלה.
function prefixMatch(heTitle, qtokens) {
  const titleWords = norm(heTitle)
    .split(/\s+/)
    .map(stripPref)
    .filter((w) => w && !CONNECTORS.has(w))
  if (titleWords.length === 0) return null
  const covered = qtokens.map((qt) => titleWords.some((tw) => wordsMatch(tw, qt)))
  if (!covered[0]) return null
  let k = 0
  while (k < covered.length && covered[k]) k++
  const extra = titleWords.filter((tw) => !qtokens.some((qt) => wordsMatch(tw, qt))).length
  return { matched: k, leftover: qtokens.slice(k), extra }
}

async function resolveBook(qtokens) {
  let best = null
  for (let cut = Math.min(qtokens.length, 4); cut >= 1; cut--) {
    const responses = await nameVariants(qtokens.slice(0, cut).join(' '))
    for (const { v, d } of responses) {
      const cands = []
      if (d.is_ref && d.ref) cands.push({ key: d.ref, he: v })
      for (const co of d.completion_objects || [])
        if (co.type === 'ref' && co.key && !co.key.includes(' on '))
          cands.push({ key: co.key, he: co.title || '' })
      for (const c of cands) {
        const m = prefixMatch(c.he, qtokens)
        if (!m) continue
        const score = m.matched * 100 - m.extra * 2 - c.he.length * 0.05
        if (!best || score > best.score)
          best = { ref: c.key, leftover: m.leftover, score }
      }
    }
    // לא עוצרים מוקדם — מעריכים את כל ה-cuts ובוחרים את ההתאמה החזקה ביותר גלובלית
    // (כך "ליקוטי מוהר״ן" ב-cut קצר מנצח "ליקוטי תורה" חלש ב-cut ארוך).
  }
  return best
}

// ---------- זיהוי משפחת-פרשנות "<מפרש> על <בסיס>" ----------
async function detectCommentary(leadTokens) {
  const responses = await nameVariants(leadTokens.join(' '))
  const families = new Map() // stem -> { heComm, bases:[{en,he}] }
  for (const { d } of responses) {
    for (const co of d.completion_objects || []) {
      const key = co.key || ''
      if (co.type !== 'ref' || !key.includes(' on ')) continue
      const stem = key.split(' on ')[0]
      const title = co.title || ''
      // heComm לתצוגה — משמר גרשיים (רש"י, רשב"א); ההשוואה מנרמלת בכל מקרה.
      const heComm = title.includes(' על ') ? normLight(title.split(' על ')[0]) : ''
      if (!heComm) continue
      // ה-heComm חייב להתאים לטוקנים שהמשתמש כתב (כל מילותיו)
      const heWords = heComm.split(/\s+/).map(stripPref)
      const ok = heWords.every((hw) => leadTokens.some((t) => wordsMatch(hw, t)))
      if (!ok) continue
      if (!families.has(stem)) families.set(stem, { heComm, bases: [] })
      const baseHe = title.includes(' על ') ? title.split(' על ')[1] : ''
      families.get(stem).bases.push({ en: key.split(' on ')[1], he: normLight(baseHe) })
    }
  }
  return [...families.entries()].map(([stem, info]) => ({ stem, ...info }))
}

// פתרון בסיס פשוט (מסכת/חומש) ל-ref אנגלי
async function resolveBaseRef(baseTokens) {
  const responses = await nameVariants(baseTokens.join(' '))
  for (const { d } of responses) {
    if (d.is_ref && d.ref) return d.ref
    for (const co of d.completion_objects || [])
      if (co.type === 'ref' && co.key && !co.key.includes(' on ')) return co.key
  }
  return null
}

// ---------- drill-down ב-TOC לפרשה/חלק ----------
async function resolveSection(bookRef, leftover) {
  if (leftover.length === 0) return [bookRef]
  const idx = await indexApi(bookRef)
  if (idx.error) return [bookRef]
  const joined = norm(leftover.join(' ')) // לכותרות רב-מילתיות ("לך לך")
  const targets = new Set()
  for (const t of leftover)
    for (const v of wordVariants(t)) {
      targets.add(v)
      targets.add(stripPref(v))
    }
  const found = []
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, path))
    if (!node || typeof node !== 'object') return
    const heRaw = norm(node.heTitle || '')
    const heStrip = stripPref(heRaw)
    const heWords = heRaw.split(/\s+/)
    const en = node.title || ''
    const newPath = en ? [...path, en] : path
    if (en && heRaw) {
      // רמות התאמה: 3=מלאה (כדי ש"אחרי מות" ינצח את "שמות"→"מות"), 2=אחרי הסרת
      // תחילית ("לחנוכה"→"חנוכה"), 1=תת-מחרוזת מטושטשת.
      let level = 0
      if (
        heRaw === joined ||
        targets.has(heRaw) ||
        (heWords.length > 1 &&
          heWords.every((w) => targets.has(w) || targets.has(stripPref(w))))
      )
        level = 3
      else if (targets.has(heStrip)) level = 2
      else if (
        [...targets].some((t) => t.length > 2 && (t.includes(heStrip) || heStrip.includes(t)))
      )
        level = 1
      if (level > 0) found.push({ ref: newPath.join(', '), level })
    }
    for (const k of ['schema', 'nodes', 'contents']) if (node[k]) walk(node[k], newPath)
  }
  walk(idx.schema || idx, [])
  // התאמה חזקה יותר קודם (מלאה > תחילית > מטושטשת)
  const seen = new Set()
  const uniq = found.filter((f) => !seen.has(f.ref) && seen.add(f.ref))
  uniq.sort(
    (a, b) =>
      b.level - a.level ||
      Number(a.ref.includes('Anthology')) - Number(b.ref.includes('Anthology')) ||
      Number(a.ref.includes('Volume II')) - Number(b.ref.includes('Volume II')) ||
      a.ref.length - b.ref.length,
  )
  return uniq.length ? uniq.map((u) => u.ref) : [bookRef]
}

// אפשרויות-בחירה חכמות: רשימת מקורות אמיתיים מספריא (כותרת עברית + ref) לבורר.
async function searchOptions(line) {
  const opts = []
  const seen = new Set()
  for (const { d } of await nameVariants(line)) {
    for (const co of d.completion_objects || []) {
      if (co.type === 'ref' && co.key && !seen.has(co.key)) {
        seen.add(co.key)
        opts.push({ ref: co.key, he: normLight(co.title || '') || co.key })
      }
    }
    if (opts.length >= 12) break
  }
  return opts.slice(0, 8)
}

// ---------- הפונקציה הראשית ----------
// אוספת מועמדים לבחירת המשתמש *לפני* התצוגה.
// מחזיר:
//   { exact: { ref } }  — ספריא מזהה את השורה במדויק (רפרנס מפורש/is_ref) → להציג ישירות.
//   { options: [{ ref, he, recommended }], message }  — זיהוי לא ודאי → בורר לבחירה.
export async function resolveChoices(line, googleCfg) {
  const qtokens = tokens(line)
  if (qtokens.length === 0) return { exact: null, options: [], message: null }

  // 0) זיהוי מדויק (is_ref על השורה המלאה) — אין צורך לבחור
  for (const { d } of await nameVariants(line))
    if (d.is_ref && d.ref) return { exact: { ref: d.ref }, options: [], message: null }

  const optMap = new Map() // ref -> { ref, he, source }
  const add = (ref, he, source) => {
    if (!ref) return
    if (!optMap.has(ref)) optMap.set(ref, { ref, he: he || null, source: source || 'ספריא' })
    else if (he && !optMap.get(ref).he) optMap.get(ref).he = he
  }
  let bestRef = null
  let message = null

  // *) חיפוש גוגל (אם הוגדר מפתח) — מקבל עדיפות, כי המשתמש סומך על דירוג גוגל.
  if (googleCfg && googleCfg.googleKey && googleCfg.googleCx) {
    try {
      const gres = await googleSourceSearch(line, googleCfg)
      for (const g of gres) {
        add(g.ref, g.source === 'ויקיטקסט' ? g.ref.replace(/^ws:/, '') : null, g.source)
        if (!bestRef) bestRef = g.ref // התוצאה הראשונה של גוגל = המומלצת
      }
    } catch {
      /* גוגל לא זמין — ממשיכים עם המנוע החינמי */
    }
  }

  // 1) מסלול פרשנות "<מפרש> על <בסיס>"
  for (let nlead = 1; nlead <= 2 && nlead < qtokens.length; nlead++) {
    const families = await detectCommentary(qtokens.slice(0, nlead))
    if (families.length === 0) continue
    const baseRef = await resolveBaseRef(qtokens.slice(nlead))
    for (const fam of families) {
      if (baseRef) {
        const cand = `${fam.stem} on ${baseRef}`
        // eslint-disable-next-line no-await-in-loop
        const { ok, heRef } = await textExists(cand)
        if (ok) {
          add(cand, heRef)
          if (!bestRef) bestRef = cand
        }
      }
      for (const b of fam.bases)
        add(`${fam.stem} on ${b.en}`, `${fam.heComm} על ${b.he || b.en}`)
    }
    if (!bestRef)
      message = `«${families[0].heComm}» לא נמצא במדויק על מקור זה — בחר/י מתוך:`
    break
  }

  // 2) מסלול ספר + drill-down ב-TOC
  const book = await resolveBook(qtokens)
  if (book) {
    const cands = await resolveSection(book.ref, book.leftover)
    const complete = book.leftover.length === 0 || cands[0] !== book.ref
    for (const c of cands) add(c, null)
    if (!bestRef && complete) bestRef = cands[0]
  }

  // קבוצת מילות-השאילתה (לסינון רלוונטיות)
  const qset = new Set()
  for (const t of qtokens) for (const v of wordVariants(t)) qset.add(v)
  const sharesQuery = (he) =>
    norm(he)
      .split(/[/\s,]+/)
      .some((w) => w && [...wordVariants(w)].some((v) => qset.has(v)))

  // 3) אפשרויות רחבות מספריא — רק אם אין מספיק מועמדים מובנים, ובסינון רלוונטיות
  // (כדי לא להציף ב"מיכה"/"מידות" כשהמשתמש כתב "מי השילוח").
  if (optMap.size < 3)
    for (const o of await searchOptions(line)) if (sharesQuery(o.he)) add(o.ref, o.he)

  // 4) חיפוש רחב בויקיטקסט ("גוגל לטקסטים יהודיים") — מקורות שספריא לא מזהה.
  // מסננים לרלוונטיים בלבד (כותרת החולקת מילה עם השאילתה) כדי לא להציף ברעש.
  try {
    const wsTitles = await searchWikisource(line, qtokens)
    for (const t of wsTitles.filter(sharesQuery).slice(0, 5)) add('ws:' + t, t, 'ויקיטקסט')
  } catch {
    /* ויקיטקסט לא זמין — ממשיכים */
  }

  // אימות והשלמת כותרות עבריות (במקביל) — מסננים רפרנסים שאינם קיימים (למשל פענוח URL שגוי מגוגל)
  let entries = [...optMap.values()]
  await Promise.all(
    entries.map(async (o) => {
      if (o.ref.startsWith('ws:') || o.he) {
        o.valid = true
        return
      }
      const { ok, heRef } = await textExists(o.ref)
      o.valid = ok
      o.he = heRef || o.ref
    }),
  )
  entries = entries.filter((o) => o.valid)

  // סידור: המומלץ (גוגל/מובנה) ראשון
  let list = []
  const b = bestRef && entries.find((e) => e.ref === bestRef)
  if (b) {
    list.push(b)
    entries = entries.filter((e) => e !== b)
  }
  list = list.concat(entries).slice(0, 10)
  if (b && list[0]) list[0].recommended = true

  return {
    exact: null,
    options: list,
    message: message || 'בחר/י את המקור שהתכוונת אליו:',
  }
}
