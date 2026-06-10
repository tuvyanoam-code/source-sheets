// ייצוא דף המקורות ל-PDF דרך מנוע ההדפסה של הדפדפן.
// יתרון מכריע על פני "צילום" של הדף (html2canvas): הדפדפן מבצע חלוקה אמיתית
// לעמודים לפי שורות — לעולם לא חותך שורה באמצע, מזרים טקסט ארוך על פני עמודים,
// והפלט וקטורי, חד ובר-בחירה. עובד גם בדפדפן וגם ב-WebView של אנדרואיד
// (דיאלוג ההדפסה של המערכת כולל "שמירה כ-PDF").

function sanitizeTitle(title) {
  return (title || 'דף מקורות').replace(/[\\/:*?"<>|]+/g, '').trim() || 'דף מקורות'
}

// מפעיל הדפסה/שמירת-PDF. שם הקובץ המוצע נגזר מכותרת הדף (document.title).
export function exportSheetToPdf(title) {
  return new Promise((resolve) => {
    const safeTitle = sanitizeTitle(title)
    const prevTitle = document.title
    document.title = safeTitle

    const restore = () => {
      document.title = prevTitle
      window.removeEventListener('afterprint', restore)
      resolve({ ok: true })
    }
    window.addEventListener('afterprint', restore)

    // מרווח קטן כדי לאפשר ל-DOM/פונטים להתייצב לפני ההדפסה
    setTimeout(() => {
      window.print()
      // נפילה-לאחור: אם afterprint לא נורה (דפדפנים מסוימים), משחזרים בכל זאת
      setTimeout(() => {
        if (document.title === safeTitle) restore()
      }, 1500)
    }, 60)
  })
}

export const printSheet = exportSheetToPdf
