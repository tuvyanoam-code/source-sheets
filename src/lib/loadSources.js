import { fetchSource } from './sefaria.js'
import { fetchFromWikisource, fetchWikisourcePage } from './wikisource.js'
import { resolveChoices } from './resolve.js'

// שליפה לפי ref — מנתב 'ws:' לויקיטקסט, אחרת לספריא.
function fetchByRef(ref) {
  return ref.startsWith('ws:') ? fetchWikisourcePage(ref.slice(3)) : fetchSource(ref)
}

// מקבל טקסט גולמי (מקור לכל שורה), מסנן שורות ריקות והערות.
export function parseRefs(raw) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

// שולף מקור בודד:
// 1) ניסיון ישיר (רפרנס מדויק כמו "בראשית א, א") → מוצג ישירות
// 2) זיהוי מדויק של ספריא (is_ref) → מוצג ישירות
// 3) זיהוי לא ודאי → לא מציגים טקסט אלא בורר אפשרויות (needsChoice) לבחירה לפני התצוגה
export async function loadSource(ref, googleCfg) {
  // 1) רפרנס מדויק
  const direct = await fetchSource(ref)
  if (direct.ok) return direct

  // 2/3) איסוף מועמדים
  let choices = { exact: null, options: [], message: null }
  try {
    choices = await resolveChoices(ref, googleCfg)
  } catch {
    /* נטפל למטה */
  }

  // זיהוי מדויק — מציגים ישירות
  if (choices.exact && choices.exact.ref) {
    const r = await fetchSource(choices.exact.ref)
    if (r.ok) return { ...r, resolvedFrom: ref }
  }

  // זיהוי לא ודאי — מחזירים בורר לבחירת המשתמש (אין טקסט עד שיבחר)
  if (choices.options && choices.options.length) {
    return {
      ok: false,
      needsChoice: true,
      ref,
      heRef: ref,
      resolvedFrom: ref,
      options: choices.options,
      message: choices.message,
    }
  }

  // לא נמצא כלום — גיבוי מויקיטקסט, ואז כישלון
  const fallback = await fetchFromWikisource(ref)
  if (fallback.ok) return fallback
  return { ok: false, ref, heRef: ref, error: direct.error }
}

// טוען רפרנס לפי ref מפורש (לשימוש בבחירה מהבורר) — מצרף את הניסוח המקורי.
export async function loadByRef(ref, resolvedFrom, candidates) {
  const r = await fetchByRef(ref)
  if (r.ok) return { ...r, resolvedFrom, candidates }
  return { ok: false, ref, heRef: ref, error: r.error }
}

export async function loadAllSources(raw, onProgress, googleCfg) {
  const refs = parseRefs(raw)
  let done = 0
  // טוענים את כל המקורות במקביל ושומרים על הסדר לפי האינדקס
  const results = await Promise.all(
    refs.map(async (ref) => {
      const r = await loadSource(ref, googleCfg)
      done += 1
      if (onProgress) onProgress(done, refs.length, ref)
      return r
    }),
  )
  return results
}
