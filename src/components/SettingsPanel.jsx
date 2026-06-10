import React from 'react'
import { BODY_FONTS, HEADING_FONTS } from '../lib/fonts.js'

// פאנל הגדרות עיצוב: פונט טקסט, פונט כותרות, גדלים, ריווח, שורות פרשנות.
export default function SettingsPanel({ settings, onChange }) {
  const set = (patch) => onChange({ ...settings, ...patch })

  return (
    <div className="settings">
      <div className="field">
        <label>פונט הטקסט</label>
        <select
          value={settings.bodyFont}
          onChange={(e) => set({ bodyFont: e.target.value })}
        >
          {BODY_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>פונט הכותרות</label>
        <select
          value={settings.headingFont}
          onChange={(e) => set({ headingFont: e.target.value })}
        >
          {HEADING_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label>גודל טקסט: {settings.bodySize}</label>
          <input
            type="range"
            min="14"
            max="28"
            value={settings.bodySize}
            onChange={(e) => set({ bodySize: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>גודל כותרת: {settings.headingSize}</label>
          <input
            type="range"
            min="16"
            max="34"
            value={settings.headingSize}
            onChange={(e) => set({ headingSize: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="field">
        <label>ריווח שורות: {settings.lineHeight.toFixed(1)}</label>
        <input
          type="range"
          min="14"
          max="26"
          value={Math.round(settings.lineHeight * 10)}
          onChange={(e) => set({ lineHeight: Number(e.target.value) / 10 })}
        />
      </div>

      <div className="field field--check">
        <label>
          <input
            type="checkbox"
            checked={settings.showNoteLines}
            onChange={(e) => set({ showNoteLines: e.target.checked })}
          />
          שורות ריקות לפרשנות אישית
        </label>
      </div>

      {settings.showNoteLines && (
        <div className="field">
          <label>מספר שורות פרשנות: {settings.noteLines}</label>
          <input
            type="range"
            min="1"
            max="8"
            value={settings.noteLines}
            onChange={(e) => set({ noteLines: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="settings__section">
        <h4>חיפוש גוגל (אופציונלי)</h4>
        <p className="settings__help">
          משפר מאוד את מציאת המקורות. דורש מפתח חינמי של Google Programmable Search
          (חינם עד 100 חיפושים ביום). ראו{' '}
          <a
            href="https://developers.google.com/custom-search/v1/overview"
            target="_blank"
            rel="noreferrer"
          >
            הוראות הגדרה
          </a>
          . בלי מפתח, החיפוש מתבצע בספריא + ויקיטקסט בלבד.
        </p>
        <div className="field">
          <label>Google API Key</label>
          <input
            type="password"
            value={settings.googleKey || ''}
            onChange={(e) => set({ googleKey: e.target.value.trim() })}
            placeholder="AIza..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label>Search Engine ID (cx)</label>
          <input
            type="text"
            value={settings.googleCx || ''}
            onChange={(e) => set({ googleCx: e.target.value.trim() })}
            placeholder="0123...:abcd"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
