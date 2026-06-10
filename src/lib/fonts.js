// ייבוא כל הפונטים (Google Fonts תומכי-עברית) מקומית דרך @fontsource —
// כך התצוגה וה-PDF משתמשים באותו פונט בדיוק, וזה עובד גם offline ב-APK.
import '@fontsource/frank-ruhl-libre/400.css'
import '@fontsource/frank-ruhl-libre/500.css'
import '@fontsource/frank-ruhl-libre/700.css'
import '@fontsource/david-libre/400.css'
import '@fontsource/david-libre/500.css'
import '@fontsource/david-libre/700.css'
import '@fontsource/noto-serif-hebrew/400.css'
import '@fontsource/noto-serif-hebrew/700.css'
import '@fontsource/heebo/400.css'
import '@fontsource/heebo/500.css'
import '@fontsource/heebo/700.css'
import '@fontsource/assistant/400.css'
import '@fontsource/assistant/600.css'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/miriam-libre/400.css'
import '@fontsource/miriam-libre/700.css'
import '@fontsource/suez-one/400.css'
import '@fontsource/secular-one/400.css'
import '@fontsource/bellefair/400.css'

// פונטים מתאימים לגוף הטקסט (קריאוּת ארוכה)
export const BODY_FONTS = [
  { id: 'frank-ruhl', label: 'פרנק-רוהל (סריף קלאסי)', stack: "'Frank Ruhl Libre', serif" },
  { id: 'david', label: 'דוד', stack: "'David Libre', serif" },
  { id: 'noto-serif', label: 'נוטו סריף עברי', stack: "'Noto Serif Hebrew', serif" },
  { id: 'heebo', label: 'חיבה (סן-סריף)', stack: "'Heebo', sans-serif" },
  { id: 'assistant', label: 'אסיסטנט', stack: "'Assistant', sans-serif" },
  { id: 'rubik', label: 'רוביק', stack: "'Rubik', sans-serif" },
  { id: 'miriam', label: 'מרים', stack: "'Miriam Libre', sans-serif" },
]

// פונטים מתאימים לכותרות (משקל ונוכחות)
export const HEADING_FONTS = [
  { id: 'suez', label: 'סואץ (כותרת מודגשת)', stack: "'Suez One', serif" },
  { id: 'secular', label: 'סקולר וואן', stack: "'Secular One', sans-serif" },
  { id: 'bellefair', label: 'בלפייר', stack: "'Bellefair', serif" },
  { id: 'frank-ruhl-h', label: 'פרנק-רוהל', stack: "'Frank Ruhl Libre', serif" },
  { id: 'heebo-h', label: 'חיבה', stack: "'Heebo', sans-serif" },
]

export function fontStackById(list, id) {
  const found = list.find((f) => f.id === id)
  return found ? found.stack : list[0].stack
}
