# דף מקורות — מחולל דפי מקורות יהודיים

אפליקציה מינימליסטית שמקבלת רשימת מקורות טקסט יהודיים (שורה לכל מקור), שואבת את הטקסט
מ‑**ספריא** (וגיבוי מ‑**ויקיטקסט**), ומפיקה דף מקורות נקי בעיצוב משרדי לייצוא **PDF**.
רצה בדפדפן, כ‑**APK** לאנדרואיד, וכפרויקט **iOS/Xcode** מוכן לחתימה רשמית.

## תכונות
- **ניסוח חופשי** — אין צורך לדעת איך המקור מקוטלג. אפשר לכתוב «מי השילוח על פרשת קורח»,
  «שפת אמת חנוכה», «אור החיים על בראשית» והאפליקציה תזהה את המקור הנכון. הפענוח חינמי
  לחלוטין (name API + index TOC של ספריא + נרמול איות מלא/חסר וגרשיים), כולל הצגת מה זוהה
  וחלופות ללחיצה. ראה `src/lib/resolve.js`.
- שליפת מקורות אוטומטית מ‑Sefaria API (תומך רפרנסים בעברית ובאנגלית), עם גיבוי מ‑Wikisource.
- לכל מקור: כותרת המקור + הטקסט העברי המנוקד + שורות ריקות לפרשנות אישית.
- הגדרות עיצוב: בחירת **פונט נפרד לטקסט** ו**פונט נפרד לכותרות**, גודל גופן וריווח שורות.
  הפונטים מובנים מקומית (Google Fonts תומכי‑עברית) — עובדים גם ללא אינטרנט.
- ייצוא PDF דרך מנוע ההדפסה של הדפדפן (`window.print` → "שמירה כ‑PDF"): חלוקה אמיתית
  לעמודים לפי שורות (לא חותך שורה באמצע), טקסט וקטורי חד ובר‑בחירה, RTL תקין. עובד גם
  בדפדפן וגם ב‑WebView של אנדרואיד (דיאלוג ההדפסה של המערכת).

## הרצה בפיתוח (דפדפן)
```bash
npm install
npm run dev          # http://localhost:5175
```

## בניית ה‑APK
דרישות שהותקנו במכונה זו: JDK 17 (`/opt/homebrew/opt/openjdk@17`), Android SDK
(`/opt/homebrew/share/android-commandlinetools`, כולל platform‑tools, platforms;android‑34,
build‑tools;34.0.0).

בנייה מחדש בפקודה אחת:
```bash
npm run build && npx cap sync android
cd android && \
  ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
  JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
  ./gradlew assembleDebug
# הפלט: android/app/build/outputs/apk/debug/app-debug.apk
```

ה‑APK המוכן נמצא גם בשורש הפרויקט: `דף-מקורות.apk`.
התקנה על מכשיר מחובר: `adb install -r דף-מקורות.apk`.

## בניית אפליקציית iPhone / חתימה רשמית ב-Xcode
הפרויקט כולל פלטפורמת iOS של Capacitor תחת `ios/`.

דרישות:
- Xcode מלא מותקן מ-App Store (לא רק Command Line Tools).
- CocoaPods: `sudo gem install cocoapods` או `brew install cocoapods`.
- Apple ID מחובר ב-Xcode. להפצה ב-TestFlight/App Store נדרש Apple Developer Program.

פקודות לאחר התקנת Xcode:
```bash
npm install
npm run ios:sync
npm run ios
```

ב-Xcode:
1. פתח את `ios/App/App.xcworkspace` (לא `App.xcodeproj` אחרי התקנת Pods).
2. בחר Target בשם `App` → `Signing & Capabilities`.
3. סמן `Automatically manage signing`.
4. בחר את ה-Team שלך.
5. שנה Bundle Identifier אם צריך (ברירת מחדל: `com.levitt.sourcesheets`).
6. להרצה על iPhone: בחר מכשיר ולחץ Run.
7. להפצה רשמית: `Product` → `Archive` → `Distribute App`.

הערה: במכונה שבה הפרויקט נוצר חסר Xcode מלא, לכן ה-iOS project נוצר אך `pod install`/Archive
לא יכולים לרוץ עד להתקנת Xcode וכניסה לחשבון Apple.

## מבנה
- `src/lib/sefaria.js`, `src/lib/wikisource.js`, `src/lib/loadSources.js` — שליפת מקורות.
- `src/lib/pdf.js` — ייצוא PDF דרך מנוע ההדפסה של הדפדפן (`window.print`).
- `src/lib/fonts.js`, `src/lib/settings.js` — פונטים והגדרות.
- `src/components/SourceSheet.jsx` — דף המקורות (ה‑DOM שמיוצא ל‑PDF).
