import React, { useEffect, useRef, useState } from 'react'
import SourceSheet from './components/SourceSheet.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import { loadAllSources, parseRefs, loadByRef } from './lib/loadSources.js'
import { exportSheetToPdf } from './lib/pdf.js'
import { loadSettings, saveSettings } from './lib/settings.js'

const SAMPLE = `בראשית א, א
מי השילוח על פרשת קורח
ברכות ב.`

export default function App() {
  const [raw, setRaw] = useState(SAMPLE)
  const [title, setTitle] = useState('דף מקורות')
  const [subtitle, setSubtitle] = useState('')
  const [sources, setSources] = useState([])
  const [settings, setSettings] = useState(loadSettings())
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const sheetRef = useRef(null)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  async function handleGenerate() {
    const refs = parseRefs(raw)
    if (refs.length === 0) return
    setLoading(true)
    setProgress({ done: 0, total: refs.length })
    const results = await loadAllSources(
      raw,
      (i, total) => setProgress({ done: i, total }),
      { googleKey: settings.googleKey, googleCx: settings.googleCx },
    )
    setSources(results)
    setLoading(false)
    setProgress(null)
  }

  async function handleSelectCandidate(index, ref) {
    const original = sources[index]
    const updated = await loadByRef(
      ref,
      original.resolvedFrom || original.ref,
      original.candidates,
    )
    setSources((prev) => prev.map((s, i) => (i === index ? updated : s)))
  }

  // עריכה ידנית בתצוגה המקדימה
  function updateSource(index, patch) {
    setSources((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }
  function deleteSource(index) {
    setSources((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleExport() {
    if (sources.length === 0) return
    setExporting(true)
    try {
      await exportSheetToPdf(title)
    } catch (err) {
      alert('שגיאה בייצוא ה-PDF: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const foundCount = sources.filter((s) => s.ok).length
  const pendingCount = sources.filter((s) => s.needsChoice).length

  return (
    <div className="app">
      <aside className="panel">
        <div className="panel__brand">
          <div className="panel__brandtext">
            <h2>דף מקורות</h2>
            <p>מחולל דפי מקורות יהודיים</p>
          </div>
        </div>

        <div className="field">
          <label>כותרת הדף</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת הדף"
          />
        </div>

        <div className="field">
          <label>כותרת משנה (אופציונלי)</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="לדוגמה: שיעור פרשת השבוע"
          />
        </div>

        <div className="field">
          <label>רשימת מקורות — מקור לכל שורה</label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={'בראשית א, א\nמשנה אבות א, א\nברכות ב.'}
          />
          <small className="hint">
            אפשר רפרנס מדויק («בראשית א, א», «ברכות ב.») או ניסוח חופשי — והאפליקציה
            תזהה את המקור: «מי השילוח על פרשת קורח», «שפת אמת חנוכה», «אור החיים על בראשית».
          </small>
        </div>

        <div className="actions">
          <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
            {loading
              ? `טוען… ${progress ? `${progress.done}/${progress.total}` : ''}`
              : 'צור דף'}
          </button>
          <button
            className="btn"
            onClick={handleExport}
            disabled={exporting || sources.length === 0}
          >
            {exporting ? 'מייצא…' : 'ייצוא PDF'}
          </button>
        </div>
        <div className="actions">
          <button
            className={'btn ' + (editMode ? 'btn--primary' : 'btn--ghost')}
            onClick={() => setEditMode((v) => !v)}
            disabled={sources.length === 0}
          >
            {editMode ? '✓ סיים עריכה' : '✎ ערוך'}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => setShowSettings((v) => !v)}
          >
            {showSettings ? 'הסתר הגדרות' : 'הגדרות עיצוב'}
          </button>
        </div>

        {sources.length > 0 && (
          <p className="status">
            נטענו {foundCount} מתוך {sources.length} מקורות.
            {pendingCount > 0 && ` ${pendingCount} ממתינים לבחירה בתצוגה.`}
          </p>
        )}

        {showSettings && (
          <SettingsPanel settings={settings} onChange={setSettings} />
        )}
      </aside>

      <main className="preview">
        <div className="preview__scroll">
          <SourceSheet
            ref={sheetRef}
            title={title}
            subtitle={subtitle}
            sources={sources}
            settings={settings}
            editMode={editMode}
            onSelectCandidate={handleSelectCandidate}
            onUpdateSource={updateSource}
            onDeleteSource={deleteSource}
          />
        </div>
      </main>
    </div>
  )
}
