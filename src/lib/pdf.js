// ייצוא דף המקורות ל-PDF דרך מנוע ההדפסה של הדפדפן.
// יתרון מכריע על פני "צילום" (html2canvas): הדפדפן מבצע חלוקה אמיתית לעמודים
// לפי שורות — לעולם לא חותך שורה, והפלט וקטורי, חד ובר-בחירה.
//
// קריטי: window.print() חייב להיקרא *ישירות* בתוך מחוות המשתמש (הלחיצה),
// בלי setTimeout/await לפניו — אחרת דפדפנים (במיוחד נייד ו-WebView) חוסמים אותו.

function sanitizeTitle(title) {
  return (title || 'דף מקורות').replace(/[\\/:*?"<>|]+/g, '').trim() || 'דף מקורות'
}

// מפעיל הדפסה/שמירת-PDF. שם הקובץ המוצע נגזר מכותרת הדף (document.title).
export function exportSheetToPdf(title) {
  const prevTitle = document.title
  document.title = sanitizeTitle(title)

  const restore = () => {
    document.title = prevTitle
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)

  // קריאה סינכרונית — בתוך מחוות הלחיצה
  window.print()

  // נפילה-לאחור: אם afterprint לא נורה (דפדפנים מסוימים), משחזרים את הכותרת
  setTimeout(() => {
    if (document.title !== prevTitle) restore()
  }, 3000)
}

export const printSheet = exportSheetToPdf
