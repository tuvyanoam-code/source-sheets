// resolve.js — פענוח שורת-מקור חופשית ל-reference של ספריא.
//
// סדר הפעולות החדש (וזה כל ההבדל):
//   1. מפרידים מספרים משם     — splitRef("משנה למלך כלים יג,ד")
//                                 → { title:"משנה למלך כלים", sections:[13,4] }
//   2. שולחים לספריא שם *נקי*  — /api/name/משנה למלך כלים
//   3. מנקדים לפי כיסוי מלא    — "משנה למלך על משנה תורה, הלכות כלים" = 100%
//   4. מחברים את המספרים חזרה  — "Mishneh LaMelech on Mishneh Torah, Vessels 13:4"
//
// קודם המספרים נשלחו יחד עם השם, וההשלמה של ספריא התאימה אותם לכותרות:
// "ד" החזיר דברים/דניאל/דקדוק/דת. עכשיו זה לא קורה.

import { splitRef, formatSections } from './hebnum.js'
import { tokenize, pickBest, rankCandidates, normLight, norm, wordVariants } from './match.js'
import { searchWikisource } from './wikisource.js'
import { googleSourceSearch } from './google.js'

const BASE = 'https://www.sefaria.org/api'

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
const indexApi = (t) => getJson(`${BASE}/index/${encodeURIComponent(t)}`)

async function textExists(ref) {
  const d = await getJson(`${BASE}/v3/texts/${encodeURIComponent(ref)}?return_format=text_only`)
  return { ok: !d.error, heRef: d.heRef }
}

/** וריאציות כתיב מלא/חסר של השם השלם, לשליחה ל-name API. */
function titleForms(title) {
  const out = []
  const seen = new Set()
  const add = (v) => {
    const t = (v || '').trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  add(normLight(title)) // עם גרשיים — מבחין ראשי-תיבות
  const s = norm(title) // בלי גרשיים
  add(s)

  // צורת ראשי-תיבות: גרשיים לפני האות האחרונה (רשי → רש"י, רמבם → רמב"ם)
  const words = normLight(title).split(/\s+/)
  if (words[0] && /^[א-ת]{3,5}$/.test(words[0])) {
    const w = words[0]
    add([w.slice(0, -1) + '"' + w.slice(-1), ...words.slice(1)].join(' '))
  }

  // מלא/חסר על השם השלם
  const pos = []
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] === 'י' || s[i] === 'ו') pos.push(i)
    if (pos.length >= 4) break
  }
  for (let mask = 1; mask < 1 << pos.length && out.length < 8; mask++) {
    const ch = s.split('')
    for (let k = 0; k < pos.length; k++) if (mask & (1 << k)) ch[pos[k]] = ''
    add(ch.join(''))
  }
  return out
}

/** אוסף מועמדים מכל וריאציות הכתיב, במקביל. */
async function collectCandidates(title) {
  const responses = await Promise.all(
    titleForms(title).map((v) => nameApi(v).then((d) => ({ v, d })).catch(() => null)),
  )

  const byRef = new Map()
  let direct = null // תשובת is_ref — מגיעה עם sectionNames, שימושי לעומק

  for (const r of responses) {
    if (!r || !r.d || r.d.error) continue
    const { v, d } = r

    if (d.is_ref && d.ref && !direct) {
      direct = {
        ref: d.ref,
        he: d.completion_objects?.[0]?.title || v,
        sectionNames: d.sectionNames || null,
        heSectionNames: d.heSectionNames || null,
        addressExamples: d.addressExamples || null,
      }
      if (!byRef.has(d.ref)) byRef.set(d.ref, { ref: d.ref, he: direct.he })
    }

    for (const co of d.completion_objects || []) {
      if (co.type !== 'ref' || !co.key) continue
      if (!byRef.has(co.key)) byRef.set(co.key, { ref: co.key, he: normLight(co.title || '') })
    }
  }
  return { candidates: [...byRef.values()], direct }
}

/** עומק הספר וסוג הכתובת — קובע איך מחברים את המספרים. */
async function bookShape(ref, direct) {
  if (direct && direct.ref === ref && direct.sectionNames) {
    return {
      depth: direct.sectionNames.length,
      isTalmud: /^\d+[ab]$/.test(String(direct.addressExamples?.[0] || '')),
    }
  }
  const idx = await indexApi(ref)
  if (idx.error) return { depth: null, isTalmud: false }
  const addr = idx.schema?.addressTypes || idx.addressTypes || []
  return {
    depth: (idx.schema?.sectionNames || idx.sectionNames || []).length || null,
    isTalmud: addr[0] === 'Talmud',
  }
}

/**
 * ירידה לתוכן העניינים לאיתור פרשה/חלק.
 * משמש כשאין מספרים אבל נשארו מילים ("מי השילוח על פרשת קורח" → קורח).
 */
async function resolveSection(bookRef, leftover) {
  if (!leftover || leftover.length === 0) return [bookRef]
  const idx = await indexApi(bookRef)
  if (idx.error) return [bookRef]

  const joined = norm(leftover.join(' '))
  const targets = new Set()
  for (const t of leftover) for (const v of wordVariants(t)) targets.add(v)

  const found = []
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, path))
    if (!node || typeof node !== 'object') return
    const heRaw = norm(node.heTitle || '')
    const heWords = heRaw.split(/\s+/)
    const en = node.title || ''
    const newPath = en ? [...path, en] : path
    if (en && heRaw) {
      // 3 = התאמה מלאה ("אחרי מות" מנצח את "מות" של שמות)
      // 2 = אחרי הסרת אות-שימוש · 1 = תת-מחרוזת
      let level = 0
      if (heRaw === joined || targets.has(heRaw) ||
          (heWords.length > 1 && heWords.every((w) => targets.has(w)))) level = 3
      else if ([...targets].some((t) => t === heRaw)) level = 2
      else if ([...targets].some((t) => t.length > 2 && (t.includes(heRaw) || heRaw.includes(t)))) level = 1
      if (level > 0) found.push({ ref: newPath.join(', '), level })
    }
    for (const k of ['schema', 'nodes', 'contents']) if (node[k]) walk(node[k], newPath)
  }
  walk(idx.schema || idx, [])

  const seen = new Set()
  const uniq = found.filter((f) => !seen.has(f.ref) && seen.add(f.ref))
  uniq.sort((a, b) => b.level - a.level || a.ref.length - b.ref.length)
  return uniq.length ? uniq.map((u) => u.ref) : [bookRef]
}

/**
 * מנסה לבנות רפרנס מלא ומאמת אותו.
 * אם המספרים עמוקים מדי לספר — מקצר בהדרגה במקום להיכשל.
 */
async function buildAndVerify(bookRef, sections, shape, amud) {
  const attempts = []
  const full = formatSections(sections, shape.depth, shape.isTalmud, amud)
  if (full) attempts.push(bookRef + full)
  for (let n = sections.length - 1; n >= 1; n--) {
    const partial = formatSections(sections.slice(0, n), shape.depth, shape.isTalmud, amud)
    if (partial) attempts.push(bookRef + partial)
  }
  attempts.push(bookRef)

  for (const ref of attempts) {
    const { ok, heRef } = await textExists(ref)
    if (ok) return { ref, heRef, exact: ref === attempts[0] }
  }
  return null
}

/**
 * הפונקציה הראשית.
 * @returns { exact:{ref} } — זוהה בוודאות, להציג ישירות
 *          { options:[{ref,he,recommended,source}], message } — לבחירת המשתמש
 */
export async function resolveChoices(line, googleCfg) {
  const { title, sections, amud } = splitRef(line)
  const qtokens = tokenize(title)
  if (qtokens.length === 0) return { exact: null, options: [], message: null }

  const { candidates, direct } = await collectCandidates(title)

  // ----- מסלול ודאי: מועמד שמכסה את *כל* מילות השאילתה -----
  const best = pickBest(candidates, qtokens)
  if (best && best.confident) {
    const shape = await bookShape(best.ref, direct)

    // נשארו מילים שאינן בשם הספר (פרשה/חלק) — יורדים לתוכן העניינים
    let bookRef = best.ref
    if (best.unmatchedQuery.length > 0 && sections.length === 0) {
      const drilled = await resolveSection(best.ref, best.unmatchedQuery)
      if (drilled[0] !== best.ref) bookRef = drilled[0]
    }

    if (sections.length > 0) {
      const built = await buildAndVerify(bookRef, sections, shape, amud)
      if (built && built.exact) return { exact: { ref: built.ref }, options: [], message: null }
      if (built) {
        // הספר נכון אבל המספרים לא נמצאו — אומרים את זה במפורש
        return {
          exact: { ref: built.ref },
          options: [],
          message: `לא נמצא ${sections.join(':')} — הוצג הקטע הקרוב ביותר.`,
        }
      }
    } else {
      const { ok } = await textExists(bookRef)
      if (ok) return { exact: { ref: bookRef }, options: [], message: null }
    }
  }

  // ----- מסלול לא-ודאי: בורר למשתמש -----
  const optMap = new Map()
  const add = (ref, he, source) => {
    if (ref && !optMap.has(ref)) optMap.set(ref, { ref, he: he || null, source: source || 'ספריא' })
  }

  // גוגל, אם הוגדר מפתח — המשתמש סומך על הדירוג שלו
  if (googleCfg?.googleKey && googleCfg?.googleCx) {
    try {
      for (const g of await googleSourceSearch(line, googleCfg))
        add(g.ref, g.source === 'ויקיטקסט' ? g.ref.replace(/^ws:/, '') : null, g.source)
    } catch {
      /* גוגל לא זמין */
    }
  }

  for (const c of rankCandidates(candidates, qtokens).slice(0, 10)) add(c.ref, c.he)

  // ויקיטקסט — מקורות שספריא לא מכירה
  try {
    const qset = new Set()
    for (const t of qtokens) for (const v of wordVariants(t)) qset.add(v)
    const relevant = (he) => norm(he).split(/[/\s,]+/).some((w) => w && [...wordVariants(w)].some((v) => qset.has(v)))
    for (const t of (await searchWikisource(title, qtokens)).filter(relevant).slice(0, 4))
      add('ws:' + t, t, 'ויקיטקסט')
  } catch {
    /* ויקיטקסט לא זמין */
  }

  // אימות והשלמת כותרות עבריות במקביל
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
  entries = entries.filter((o) => o.valid).slice(0, 10)
  if (entries.length) entries[0].recommended = true

  return {
    exact: null,
    options: entries,
    message: sections.length
      ? `לא הצלחתי לזהות בוודאות «${title}». בחר/י את הספר — ${sections.join(':')} יתווסף אוטומטית:`
      : 'בחר/י את המקור שהתכוונת אליו:',
    pendingSections: sections,
    pendingAmud: amud,
  }
}

/**
 * אחרי שהמשתמש בחר ספר מהבורר — מחבר אליו את המספרים שנשלפו מהשורה.
 * בלי זה, בחירה בבורר הייתה מחזירה את הספר כולו במקום את הקטע.
 */
export async function applySections(bookRef, sections, amud) {
  if (!sections || sections.length === 0 || bookRef.startsWith('ws:')) return bookRef
  const shape = await bookShape(bookRef, null)
  const built = await buildAndVerify(bookRef, sections, shape, amud)
  return built ? built.ref : bookRef
}
