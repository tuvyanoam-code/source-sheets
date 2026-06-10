// לקוח לשליפת מקורות מספריא (Sefaria) — ה-API פתוח ל-CORS, ניתן לקרוא ישירות.
const BASE = 'https://www.sefaria.org/api'

// שיטוח טקסט שעשוי לחזור כמחרוזת או כמערך מקונן של סגמנטים
function flattenText(text) {
  if (text == null) return ''
  if (typeof text === 'string') return text
  if (Array.isArray(text)) {
    return text.map(flattenText).filter(Boolean).join(' ')
  }
  return String(text)
}

// ניקוי תגי HTML שיורי (הערות שוליים, ניקוד מסומן וכו') ורווחים כפולים
function stripHtml(s) {
  if (!s) return ''
  return s
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')   // מספרי הערות שוליים
    .replace(/<i[^>]*class="footnote"[^>]*>.*?<\/i>/gi, '')
    .replace(/<[^>]+>/g, '')                  // כל שאר התגיות
    .replace(/&nbsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// שליפת מקור בודד לפי רפרנס (עברית או אנגלית). מחזיר { ok, ref, heRef, text } או { ok:false, error }
export async function fetchSource(ref) {
  const cleanRef = ref.trim()
  if (!cleanRef) return { ok: false, ref, error: 'רפרנס ריק' }

  const url = `${BASE}/v3/texts/${encodeURIComponent(cleanRef)}?return_format=text_only`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return { ok: false, ref: cleanRef, error: `המקור לא נמצא בספריא (${res.status})` }
    }
    const data = await res.json()
    if (data.error) {
      return { ok: false, ref: cleanRef, error: data.error }
    }

    const versions = Array.isArray(data.versions) ? data.versions : []
    // מעדיפים גרסה עברית; אחרת לוקחים את הראשונה
    const hebrew =
      versions.find((v) => (v.language || v.actualLanguage) === 'he') || versions[0]
    if (!hebrew) {
      return { ok: false, ref: cleanRef, error: 'לא נמצא טקסט למקור זה' }
    }

    const text = stripHtml(flattenText(hebrew.text))
    if (!text) {
      return { ok: false, ref: cleanRef, error: 'הטקסט שהתקבל ריק' }
    }

    return {
      ok: true,
      ref: data.ref || cleanRef,
      heRef: data.heRef || cleanRef,
      text,
      source: 'ספריא',
    }
  } catch (err) {
    return { ok: false, ref: cleanRef, error: `שגיאת רשת: ${err.message}` }
  }
}
