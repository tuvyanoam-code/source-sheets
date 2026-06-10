// שמירה/טעינה של הגדרות העיצוב מ-localStorage
import { GOOGLE_KEY, GOOGLE_CX } from '../secrets.js'

const KEY = 'source-sheets:settings'

export const DEFAULT_SETTINGS = {
  bodyFont: 'frank-ruhl',     // מזהה מתוך BODY_FONTS
  headingFont: 'suez',        // מזהה מתוך HEADING_FONTS
  bodySize: 19,               // px
  headingSize: 24,            // px
  lineHeight: 1.9,            // ריווח שורות
  showNoteLines: true,        // שורות ריקות לפרשנות אישית
  noteLines: 3,               // כמה שורות פרשנות לכל מקור
  googleKey: GOOGLE_KEY,      // Google Custom Search API key (מוטמע מ-secrets)
  googleCx: GOOGLE_CX,        // מזהה מנוע החיפוש (cx)
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    const merged = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
    // מפתח/cx של גוגל מגיעים תמיד מההטמעה (secrets) — לא מ-localStorage,
    // כדי שמפתח שבור ישן לא יישמר ויאט.
    merged.googleKey = DEFAULT_SETTINGS.googleKey
    merged.googleCx = DEFAULT_SETTINGS.googleCx
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    // לא שומרים את פרטי גוגל ל-localStorage (מגיעים מ-secrets)
    const { googleKey, googleCx, ...rest } = settings
    localStorage.setItem(KEY, JSON.stringify(rest))
  } catch {
    // התעלם משגיאות אחסון
  }
}
