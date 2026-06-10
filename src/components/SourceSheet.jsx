import React, { forwardRef } from 'react'
import SourceBlock from './SourceBlock.jsx'
import { BODY_FONTS, HEADING_FONTS, fontStackById } from '../lib/fonts.js'

// דף המקורות עצמו — A4, RTL. זהו ה-DOM שמיוצא ל-PDF.
const SourceSheet = forwardRef(function SourceSheet(
  {
    title,
    subtitle,
    sources,
    settings,
    editMode,
    onSelectCandidate,
    onUpdateSource,
    onDeleteSource,
  },
  ref,
) {
  const bodyStack = fontStackById(BODY_FONTS, settings.bodyFont)
  const headingStack = fontStackById(HEADING_FONTS, settings.headingFont)

  return (
    <div className="sheet" ref={ref}>
      <header className="sheet__header">
        <h1 className="sheet__title" style={{ fontFamily: headingStack }}>
          {title || 'דף מקורות'}
        </h1>
        {subtitle && (
          <p className="sheet__subtitle" style={{ fontFamily: bodyStack }}>
            {subtitle}
          </p>
        )}
        <div className="sheet__rule" />
      </header>

      {sources.length === 0 ? (
        <div className="sheet__empty" style={{ fontFamily: bodyStack }}>
          הזינו רשימת מקורות ולחצו «צור דף» כדי לראות כאן תצוגה מקדימה.
        </div>
      ) : (
        <div className="sheet__body">
          {sources.map((s, i) => (
            <SourceBlock
              key={i}
              index={i}
              source={s}
              settings={settings}
              bodyStack={bodyStack}
              headingStack={headingStack}
              editMode={editMode}
              onSelectCandidate={onSelectCandidate}
              onUpdateSource={onUpdateSource}
              onDeleteSource={onDeleteSource}
            />
          ))}
        </div>
      )}
    </div>
  )
})

export default SourceSheet
