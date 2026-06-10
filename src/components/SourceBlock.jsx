import React from 'react'

// קיצור reference של ספריא לתצוגה: משמיטים את שם הספר (החלק הראשון)
// ומשאירים את החלקים המבחינים (חלק/ספר/פרשה) כדי שחלופות לא יתנגשו.
function shortRef(ref) {
  const parts = ref.split(',').map((p) => p.trim())
  return (parts.length > 1 ? parts.slice(1) : parts).join(' · ')
}

// בלוק של מקור בודד בדף: כותרת-מקור + טקסט עברי + שורות ריקות לפרשנות אישית.
export default function SourceBlock({
  index,
  source,
  settings,
  bodyStack,
  headingStack,
  editMode,
  onSelectCandidate,
  onUpdateSource,
  onDeleteSource,
}) {
  const noteLines = settings.showNoteLines
    ? Array.from({ length: settings.noteLines })
    : []

  const options = source.options || []

  return (
    <div className={'source-block' + (editMode ? ' source-block--editing' : '')}>
      {editMode && (
        <button
          className="block-delete no-print"
          title="מחק מקור זה"
          onClick={() => onDeleteSource(index)}
        >
          ✕
        </button>
      )}

      <div className="source-block__head">
        <span className="source-block__num">{index + 1}</span>
        <h3
          className="source-block__title"
          style={{ fontFamily: headingStack, fontSize: settings.headingSize }}
          contentEditable={editMode}
          suppressContentEditableWarning
          onBlur={(e) => onUpdateSource(index, { heRef: e.currentTarget.innerText })}
        >
          {source.heRef || source.ref}
        </h3>
        {source.source && source.source !== 'ספריא' && (
          <span className="source-block__tag">{source.source}</span>
        )}
      </div>

      {/* כשפוענח מניסוח חופשי — מציגים מה זוהה, כדי שהמשתמש יוכל לוודא */}
      {source.ok && source.resolvedFrom && (
        <div className="source-block__resolved no-print">
          פוענח מתוך: «{source.resolvedFrom}»
          {source.candidates && source.candidates.length > 1 && (
            <span className="source-block__alts">
              {' '}— לא מה שהתכוונת?{' '}
              {source.candidates.map((c) =>
                c === source.ref ? null : (
                  <button
                    key={c}
                    className="link-btn"
                    onClick={() => onSelectCandidate(index, c)}
                  >
                    {shortRef(c)}
                  </button>
                ),
              )}
            </span>
          )}
        </div>
      )}

      {source.ok ? (
        <p
          className="source-block__text"
          style={{
            fontFamily: bodyStack,
            fontSize: settings.bodySize,
            lineHeight: settings.lineHeight,
          }}
          contentEditable={editMode}
          suppressContentEditableWarning
          onBlur={(e) => onUpdateSource(index, { text: e.currentTarget.innerText })}
        >
          {source.text}
        </p>
      ) : source.needsChoice && options.length > 0 ? (
        <div className="chooser no-print">
          <div className="chooser__msg">
            {source.message || 'בחר/י את המקור שהתכוונת אליו:'}
          </div>
          <div className="picker">
            {options.map((o) => (
              <button
                key={o.ref}
                className={'picker__item' + (o.recommended ? ' picker__item--rec' : '')}
                onClick={() => onSelectCandidate(index, o.ref)}
              >
                <span className="picker__he">{o.he}</span>
                <span className="picker__meta">
                  {o.recommended && <span className="picker__badge">מומלץ</span>}
                  {o.source && (
                    <span
                      className={
                        'picker__src' +
                        (o.source === 'ויקיטקסט' ? ' picker__src--ws' : '')
                      }
                    >
                      {o.source}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="source-block__error no-print">
          {source.error || 'לא נמצא טקסט עבור מקור זה.'}
        </div>
      )}

      {source.ok && noteLines.length > 0 && (
        <div className="source-block__notes" aria-hidden="true">
          {noteLines.map((_, i) => (
            <div key={i} className="source-block__note-line" />
          ))}
        </div>
      )}
    </div>
  )
}
