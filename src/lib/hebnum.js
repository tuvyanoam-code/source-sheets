// hebnum.js — הפרדת שורת-מקור לחלק שמי ולחלק מספרי.
//
// זהו התיקון המרכזי. עד היום המספרים ("יג", "ד") נשלחו יחד עם שם הספר
// ל-/api/name, וההשלמה-האוטומטית של ספריא התאימה אותם לכותרות ספרים:
// "ד" החזיר דברים / דניאל / דקדוק / דת, והרעיל את התוצאות.
// גרוע מכך — "ד" הופיע ברשימת מילות-הקישור ולכן נמחק לגמרי, כך שכל
// מקור שההלכה/הפסוק שלו הוא ד' איבד אותו.
//
// כאן מפרידים את המספרים *לפני* כל פנייה לרשת: שם הספר הולך ל-API נקי,
// והמספרים מחוברים חזרה לרפרנס אחרי שהספר זוהה.

const GEMATRIA = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50,
  ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
}

// מילים שמתארות *רמה* ולא תוכן — נזרקות כשהן צמודות למספר.
// ("בראשית פרק א פסוק א" → בראשית + [1,1])
const LEVEL_WORDS = new Set([
  'פרק', 'פרקים', 'פסוק', 'פסוקים', 'דף', 'עמוד', 'עמ', 'סימן', 'סי',
  'סעיף', 'סק', 'הלכה', 'הלכות', 'משנה', 'משניות', 'אות',
  'פסקה', 'שורה', 'חלק', 'מאמר', 'דין', 'תורה', 'עמוד',
])

// עומק מקסימלי של רפרנס. עוצר בליעה בורחת של מילים לתוך החלק המספרי.
const MAX_SECTIONS = 3

const QUOTES = /['"׳״`]/
const QUOTES_G = /['"׳״`]/g
const NIQQUD = /[֑-ׇ]/g

const bare = (s) => (s || '').replace(NIQQUD, '').replace(QUOTES_G, '').trim()

// מילים ותיבות-קיצור נפוצות שהן גם גימטריה תקינה — לעולם לא מספר בפני עצמן.
// (ר"ן = 250, יו"ד = 20, ע"א = 71 … אבל בשורת-מקור אלו שמות, לא מספרים.)
const NOT_NUMBERS = new Set([
  'את', 'של', 'על', 'אל', 'כל', 'גם', 'הר', 'בא', 'שם', 'רב', 'לא', 'תא', 'אב', 'אם',
  'יוד', 'עא', 'עב', 'חמ', 'אהע', 'רן', 'רה', 'שך', 'מלך', 'רמה',
])

/**
 * ממיר מחרוזת למספר אם היא גימטריה תקינה, אחרת null.
 *
 * המפתח הוא כלל הסדר: במספר עברי תקין ערכי האותיות אינם *עולים*
 * (רמ"ב = 200,40,2 ✓ · דברים = 4,2,200 ✗ · כלים = 20,30 ✗ · דף = 4,80 ✗).
 * זה מבחין בין מספר למילה הרבה יותר טוב מאשר ספירת אותיות.
 */
export function heNum(token) {
  const raw = (token || '').trim()
  const s = bare(raw)
  if (!s || !/^[א-ת]+$/.test(s)) return null
  if (NOT_NUMBERS.has(s)) return null

  // תקרת אורך. בלעדיה מילים שערכי אותיותיהן יורדים נקראות כמספר —
  // "תניא" = 400+50+10+1 יורד לגמרי, ובלי התקרה היה נקרא 461.
  // מספרי פרק/סימן אמיתיים כמעט לעולם אינם עוברים 3 אותיות (תר"מ = 640).
  const quoted = QUOTES.test(raw)
  if (s.length > (quoted ? 4 : 3)) return null

  const vals = []
  for (const ch of s) {
    const v = GEMATRIA[ch]
    if (!v) return null
    vals.push(v)
  }

  // כלל הסדר — עם חריג ט"ו/ט"ז (15/16, שנכתבים כך כדי לא לכתוב י-ה/י-ו)
  if (!(s === 'טו' || s === 'טז')) {
    for (let i = 1; i < vals.length; i++) if (vals[i] > vals[i - 1]) return null
  }

  const n = vals.reduce((a, b) => a + b, 0)
  return n > 0 && n <= 1000 ? n : null
}

/**
 * מזהה סימון עמוד גמרא בסוף השורה: "ב." / "ב:" / "ב ע\"א" / "ב ע\"ב".
 * מחזיר 'a' | 'b' | null.
 */
function detectAmud(line) {
  const t = (line || '').trim()
  if (/\.\s*$/.test(t)) return 'a'
  if (/:\s*$/.test(t)) return 'b'
  const m = bare(t).match(/(?:^|\s)(עא|עב)$/)
  if (m) return m[1] === 'עא' ? 'a' : 'b'
  return null
}

/**
 * מפרק שורה ל-{ title, sections, amud }.
 *
 *   "משנה למלך כלים יג,ד"   → { title:'משנה למלך כלים', sections:[13,4] }
 *   "משנה למלך כלים יג ד"   → { title:'משנה למלך כלים', sections:[13,4] }
 *   "בראשית פרק א פסוק א"   → { title:'בראשית',        sections:[1,1] }
 *   "ברכות ב."              → { title:'ברכות', sections:[2], amud:'a' }
 *   "מי השילוח על קורח"     → { title:'מי השילוח על קורח', sections:[] }
 */
export function splitRef(line) {
  const amud = detectAmud(line)

  // מסירים סימני עמוד/פיסוק, אבל *לא* גרשיים (הם מבחינים ראשי-תיבות).
  let cleaned = (line || '').replace(/[.:]\s*$/, ' ')
  // ע"א / ע"ב בסוף — סימון עמוד, לא חלק מהשם
  if (amud) cleaned = cleaned.replace(/\s*ע["׳״']?[אב]\s*$/, ' ')
  cleaned = cleaned.replace(/[,;()\[\]־–—]/g, ' ').trim()

  const words = cleaned.split(/\s+/).filter(Boolean)
  const sections = []

  // סורקים מהסוף: אוספים מספרים, זורקים מילות-רמה שצמודות אליהם.
  // סדר הבדיקה קריטי — "דף" חייב להיבדק כמילת-רמה לפני שינסו לקרוא אותו
  // כגימטריה (ד+ף = 84).
  let i = words.length - 1
  let sawNumber = false
  while (i >= 0) {
    // מילת-רמה נזרקת רק אם כבר מצאנו מספר מימינה
    if (sawNumber && LEVEL_WORDS.has(bare(words[i]))) {
      i--
      continue
    }
    const n = heNum(words[i])
    if (n !== null && sections.length < MAX_SECTIONS) {
      sections.unshift(n)
      sawNumber = true
      i--
      continue
    }
    break
  }

  // הגנה: אם *כל* השורה נבלעה כמספרים, זו כנראה לא שורת-מקור אמיתית —
  // מחזירים את המקור כפי שהוא.
  if (i < 0) return { title: cleaned, sections: [], amud: null }

  return { title: words.slice(0, i + 1).join(' '), sections, amud }
}

/**
 * בונה את סיומת הרפרנס לפי עומק הספר וסוג הכתובת.
 * @param sections מספרים שנשלפו מהשורה
 * @param depth    כמה רמות יש לספר (מ-sectionNames של ספריא)
 * @param isTalmud האם הכתובת היא כתובת-דף (Talmud)
 * @param amud     'a' | 'b' | null
 */
export function formatSections(sections, depth, isTalmud, amud) {
  if (!sections || sections.length === 0) return ''
  if (isTalmud) {
    const daf = sections[0]
    const side = amud || (sections[1] === 2 ? 'b' : 'a')
    return ` ${daf}${side}`
  }
  const use = depth ? sections.slice(0, depth) : sections
  return use.length ? ' ' + use.join(':') : ''
}
