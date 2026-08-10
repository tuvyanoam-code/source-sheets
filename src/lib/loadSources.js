import { fetchSource } from './sefaria.js'
import { fetchFromWikisource, fetchWikisourcePage } from './wikisource.js'
import { resolveChoices, applySections } from './resolve.js'

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

export async function loadSource(ref, googleCfg) {
  // 1) רפרנס מדויק שספריא מבינה כמו שהוא ("בראשית א, א")
  const direct = await fetchSource(ref)
  if (direct.ok) return direct

  // 2) פענוח
  let choices = { exact: null, options: [], message: null }
  try {
    choices = await resolveChoices(ref, googleCfg)
  } catch {
    /* נטפל למטה */
  }

  if (choices.exact?.ref) {
    const r = await fetchSource(choices.exact.ref)
    if (r.ok) return { ...r, resolvedFrom: ref, note: choices.message || null }
  }

  // 3) זיהוי לא ודאי — בורר. שומרים את המספרים כדי לחברם אחרי הבחירה.
  if (choices.options?.length) {
    return {
      ok: false,
      needsChoice: true,
      ref,
      heRef: ref,
      resolvedFrom: ref,
      options: choices.options,
      message: choices.message,
      pendingSections: choices.pendingSections || [],
      pendingAmud: choices.pendingAmud || null,
    }
  }

  // 4) גיבוי ויקיטקסט
  const fallback = await fetchFromWikisource(ref)
  if (fallback.ok) return fallback
  return { ok: false, ref, heRef: ref, error: direct.error }
}

/**
 * טעינה לפי ref שנבחר בבורר.
 * חדש: מחבר את המספרים שנשלפו מהשורה המקורית. בלי זה בחירה של
 * "משנה למלך על הלכות כלים" הייתה מחזירה את הספר כולו במקום יג,ד.
 */
export async function loadByRef(ref, resolvedFrom, candidates, pendingSections, pendingAmud) {
  let target = ref
  if (pendingSections?.length) {
    try {
      target = await applySections(ref, pendingSections, pendingAmud)
    } catch {
      target = ref
    }
  }
  const r = await fetchByRef(target)
  if (r.ok) return { ...r, resolvedFrom, candidates }
  return { ok: false, ref: target, heRef: target, error: r.error }
}

export async function loadAllSources(raw, onProgress, googleCfg) {
  const refs = parseRefs(raw)
  let done = 0
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
