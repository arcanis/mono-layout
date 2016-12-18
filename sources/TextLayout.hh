#pragma once

#include <functional>
#include <memory>
#include <vector>

#ifdef NBIND
# include <nbind/api.h>
#endif

#include "./Line.hh"
#include "./Patch.hh"
#include "./Position.hh"
#include "./TokenLocator.hh"

class TextLayout {

 public:

    TextLayout(void);

 public:

    void setColumns(unsigned columns);
    void setTabWidth(unsigned tabWidth);
    void setCollapseWhitespaces(bool collapseWhitespaces);
    void setPreserveLeadingSpaces(bool preserveLeadingSpaces);
    void setPreserveTrailingSpaces(bool preserveTrailingSpaces);
    void setAllowWordBreaks(bool allowWordBreaks);
    void setDemoteNewlines(bool demoteNewlines);
    void setJustifyText(bool justifyText);

 public:

#ifndef NBIND

    void setCharacterGetter(std::function<char(unsigned)> const & m_getCharacter);
    void setCharacterCountGetter(std::function<unsigned(void)> const & m_getCharacterCount);

#else

    void setCharacterGetter(nbind::cbFunction & m_getCharacter);
    void setCharacterCountGetter(nbind::cbFunction & m_getCharacterCount);

#endif

 public:

    Position getFixedPosition(Position position) const;

    Position getPositionLeft(Position position) const;
    Position getPositionRight(Position position) const;

    Position getPositionAbove(Position position, unsigned amplitude = 1) const;
    Position getPositionBelow(Position position, unsigned amplitude = 1) const;

 public:

    unsigned getRowForCharacterIndex(unsigned characterIndex) const;
    unsigned getCharacterIndexForRow(unsigned row) const;

    Position getPositionForCharacterIndex(unsigned characterIndex) const;
    unsigned getCharacterIndexForPosition(Position position) const;

 public:

    Patch reset(void);
    Patch update(unsigned start, unsigned deleted, unsigned added);

#ifdef DEBUG

 public:

    void dump(std::vector<Line> const & generatedLines) const;
    void dump(void) const;

#endif

 private:

    TokenLocator findTokenLocatorForPosition(Position const & position) const;

 private:

    unsigned m_columns;
    unsigned m_tabWidth;
    bool m_collapseWhitespaces;
    bool m_preserveLeadingSpaces;
    bool m_preserveTrailingSpaces;
    bool m_allowWordBreaks;
    bool m_demoteNewlines;
    bool m_justifyText;

#ifndef NBIND

    std::function<char(unsigned)> m_getCharacter;
    std::function<unsigned(void)> m_getCharacterCount;

#else

    std::unique_ptr<nbind::cbFunction> m_getCharacter;
    std::unique_ptr<nbind::cbFunction> m_getCharacterCount;

#endif

    std::vector<Line> m_lines;

};
