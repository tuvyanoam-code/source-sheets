// חיפוש ושליפה מויקיטקסט העברי (he.wikisource) — מנוע חיפוש רחב וחינמי (CORS פתוח)
// המשמש כ"גוגל לטקסטים יהודיים": מוצא מקורות שספריא לא מזהה, והמשתמש בוחר מהתוצאות.
const WS = 'https://he.wikisource.org/w/api.php'

// מסיר HTML, הערות-שוליים, וזבל ניווט/קישוטים נפוצים של ויקיטקסט.
const JUNK = /היברובוקס|שיעורים בספר|ביאור:|משלים בספר|^ויקיטקסט|קטגוריה:|מתוך ויקיטקסט|דף הבית|תרומה|^עריכה$|\[עריכה\]/
function clean(s) {
  let t = (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\[\d+\]/g, '')
  t = t
    .split('\n')
    .filter((line) => {
      const l = line.trim()
      return !l || !JUNK.test(l)
    })
    .join('\n')
  return t
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function wsSearch(srsearch, limit) {
  const url =
    `${WS}?action=query&list=search&srsearch=${encodeURIComponent(srsearch)}` +
    `&srlimit=${limit}&srprop=&format=json&origin=*`
  try {
    const data = await (await fetch(url)).json()
    return {
      hits: (data?.query?.search || []).map((h) => h.title),
      suggestion: data?.query?.searchinfo?.suggestion || null,
    }
  } catch {
    return { hits: [], suggestion: null }
  }
}

// חיפוש רחב: intitle (דיוק) + טקסט-מלא (כיסוי) + הצעת-איות. מחזיר רשימת כותרות.
export async function searchWikisource(query, qtokens) {
  const toks = (qtokens && qtokens.length ? qtokens : query.split(/\s+/)).filter(Boolean)
  const titleQuery = toks.map((t) => `intitle:${t}`).join(' ')
  const [byTitle, byText] = await Promise.all([
    titleQuery ? wsSearch(titleQuery, 8) : Promise.resolve({ hits: [] }),
    wsSearch(query, 10),
  ])
  const titles = []
  const seen = new Set()
  const push = (t) => {
    if (t && !seen.has(t)) {
      seen.add(t)
      titles.push(t)
    }
  }
  byTitle.hits.forEach(push) // התאמות-כותרת קודם (מדויק יותר)
  byText.hits.forEach(push)
  if (titles.length === 0 && byText.suggestion) {
    const s = await wsSearch(byText.suggestion, 8)
    s.hits.forEach(push)
  }
  return titles.slice(0, 8)
}

// שליפת הטקסט המלא של דף ויקיטקסט לפי כותרת.
// ללא exchars — מחזיר את הטקסט המלא (לא חותך מקורות ארוכים).
// גיבוי דרך action=parse אם extracts מחזיר ריק/קצר מדי.
export async function fetchWikisourcePage(title) {
  const extractUrl =
    `${WS}?action=query&prop=extracts&explaintext=1&exsectionformat=plain&exlimit=1` +
    `&titles=${encodeURIComponent(title)}&format=json&origin=*`
  try {
    const data = await (await fetch(extractUrl)).json()
    const page = Object.values(data?.query?.pages || {})[0]
    let text = clean(page?.extract)
    const heRef = page?.title || title

    // גיבוי: אם הטקסט קצר מדי/ריק (דפים עם תבניות/הכללות), שולפים את ה-HTML המרונדר.
    if (!text || text.length < 60) {
      const parseUrl =
        `${WS}?action=parse&prop=text&disabletoc=1&disableeditsection=1` +
        `&page=${encodeURIComponent(title)}&format=json&origin=*`
      const pData = await (await fetch(parseUrl)).json()
      const html = pData?.parse?.text?.['*']
      const parsed = clean(html)
      if (parsed && parsed.length > text.length) text = parsed
    }

    if (!text) return { ok: false, ref: title, error: 'לא נמצא טקסט בויקיטקסט' }
    return { ok: true, ref: title, heRef, text, source: 'ויקיטקסט' }
  } catch (err) {
    return { ok: false, ref: title, error: `שגיאת רשת: ${err.message}` }
  }
}

// גיבוי ישן (תוצאה ראשונה) — נשאר לתאימות.
export async function fetchFromWikisource(ref) {
  const titles = await searchWikisource(ref)
  if (!titles.length) return { ok: false, ref, error: 'לא נמצא בויקיטקסט' }
  return fetchWikisourcePage(titles[0])
}
