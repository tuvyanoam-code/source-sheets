// match.js — התאמת שם-ספר בעברית, טהור מרשת (ולכן בר-בדיקה).
//
// מחליף את prefixMatch הישן. שני שינויים מהותיים:
//
// 1. פיסוק. הישן פיצל כותרות ב-\s+ בלבד, כך שהפסיק נשאר דבוק למילה:
//    "מי השלוח, חלק א" → ["מי","שלוח,","חלק","א"] ו-"שלוח," לא התאים ל"השילוח".
//    כל כותרת רב-חלקית — כלומר רוב ספרי החסידות והפרשנות — קיבלה ציון שגוי.
//
// 2. שיטת הניקוד. הישן דרש התאמה *רציפה מהטוקן הראשון* וניקד matched*100,
//    כך שכותרת ארוכה ונכונה הפסידה לכותרת קצרה ומקרית. כאן מנקדים לפי
//    *כיסוי* כל מילות השאילתה — מועמד נחשב ודאי רק אם כיסה את כולן.
//    זה גם שומר על כלל הבטיחות המקורי: "רשב\"א סנהדרין" לעולם לא יגלוש
//    ל"סנהדרין" סתם, כי סנהדרין מכסה רק חצי מהשאילתה.

const NIQQUD = /[֑-ׇ]/g
const QUOTES = /['"׳״`]/g
const PUNCT = /[,.;:()[\]{}־–—|]/g

/** נרמול להשוואה: בלי ניקוד, בלי גרשיים, פיסוק → רווח. */
export const norm = (s) =>
  (s || '').replace(NIQQUD, '').replace(QUOTES, '').replace(PUNCT, ' ').replace(/\s+/g, ' ').trim()

/** נרמול לשליחה לספריא: משמר גרשיים — הם מבחינים ראשי-תיבות (רש"י ≠ רשי). */
export const normLight = (s) => (s || '').replace(NIQQUD, '').trim()

// מילות-קישור שאינן נושאות זהות.
// שים לב: 'ד', 'פרק', 'פסוק', 'דף', 'עמוד', 'סימן' *אינן* כאן יותר —
// המספרים כבר הוסרו על ידי splitRef, ו-'ד' ברשימה הזו הוא שגרם
// לכל הלכה ד' להימחק מהשורה.
export const CONNECTORS = new Set([
  'על', 'של', 'את', 'ספר', 'מסכת', 'פרשת', 'פרשה',
  'גמרא', 'גמ', 'תלמוד', 'בבלי', 'ירושלמי',
  'הלכות', 'הל', 'מהלכות', 'שער', 'חלק',
])

const AFFIX = 'לבמהושכ'
const stripPref = (w) => (w.length > 2 && AFFIX.includes(w[0]) ? w.slice(1) : w)

/** וריאציות כתיב מלא/חסר של מילה (הוספה/השמטה של י' ו-ו'). */
export function wordVariants(w) {
  const s = norm(w)
  if (!s) return new Set()
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

export function wordsMatch(a, b) {
  const va = wordVariants(a)
  for (const x of wordVariants(b)) if (va.has(x)) return true
  return false
}

/**
 * מפרק מחרוזת לטוקנים משמעותיים (בלי מילות-קישור).
 * לא מסירים כאן אותיות-שימוש — wordVariants כבר בודק את שתי הצורות,
 * והסרה כאן הייתה מרסקת מילים תקינות ("כלים"→"לים", "משנה"→"שנה")
 * ופותחת פתח להתאמות-שווא.
 */
export function tokenize(s) {
  return norm(s)
    .split(/\s+/)
    .filter((w) => w && !CONNECTORS.has(w) && !CONNECTORS.has(stripPref(w)))
}

/**
 * מנקד מועמד מול טוקני השאילתה.
 * @returns { coverage, extra, score, confident }
 *   coverage — איזה חלק ממילות השאילתה כוסה (0..1)
 *   confident — כיסוי מלא: אפשר לבחור אוטומטית בלי לשאול את המשתמש
 */
export function scoreCandidate(candidateTitle, queryTokens) {
  const titleWords = tokenize(candidateTitle)
  if (titleWords.length === 0 || queryTokens.length === 0) return null

  const matchedTitleIdx = new Set()
  const unmatchedQuery = []
  let covered = 0
  for (const qt of queryTokens) {
    const idx = titleWords.findIndex((tw, i) => !matchedTitleIdx.has(i) && wordsMatch(tw, qt))
    if (idx >= 0) {
      matchedTitleIdx.add(idx)
      covered++
    } else {
      unmatchedQuery.push(qt)
    }
  }

  const coverage = covered / queryTokens.length
  const extra = titleWords.length - matchedTitleIdx.size
  // כיסוי הוא הגורם המכריע; מילים עודפות בכותרת מורידות מעט;
  // בין שווים — הכותרת הקצרה מנצחת.
  const score = coverage * 1000 - extra * 6 - candidateTitle.length * 0.02

  // unmatchedQuery = מילים שהמשתמש כתב ולא נמצאות בשם הספר.
  // אלו המועמדות להיות שם פרשה/חלק, ואיתן יורדים לתוכן העניינים.
  return { coverage, extra, score, unmatchedQuery, confident: coverage === 1 }
}

/** בוחר את המועמד הטוב ביותר מרשימה של { ref, he }. */
export function pickBest(candidates, queryTokens) {
  let best = null
  for (const c of candidates) {
    const s = scoreCandidate(c.he || c.ref, queryTokens)
    if (!s) continue
    if (!best || s.score > best.score) best = { ...c, ...s }
  }
  return best
}

/** ממיין רשימת מועמדים לפי איכות ההתאמה (לתצוגה בבורר). */
export function rankCandidates(candidates, queryTokens) {
  return candidates
    .map((c) => ({ ...c, ...(scoreCandidate(c.he || c.ref, queryTokens) || { score: -1, coverage: 0 }) }))
    .sort((a, b) => b.score - a.score)
}
