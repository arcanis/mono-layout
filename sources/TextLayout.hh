#pragma once

#include <functional>
#include <memory>
#include <vector>

#include "./LineSizeContainer.hh"
#include "./Line.hh"
#include "./Position.hh"
#include "./TextOperation.hh"
#include "./TokenLocator.hh"

class TextLayout {

 public:

    TextLayout(void);

 public: // options getters

    unsigned getColumns(void) const;
    unsigned getTabWidth(void) const;

    bool getSoftWrap(void) const;
    bool getCollapseWhitespaces(void) const;
    bool getPreserveLeadingSpaces(void) const;
    bool getPreserveTrailingSpaces(void) const;
    bool getAllowWordBreaks(void) const;
    bool getDemoteNewlines(void) const;
    bool getJustifyText(void) const;

 public: // options setters

    bool setColumns(unsigned columns);
    bool setTabWidth(unsigned tabWidth);

    bool setSoftWrap(bool softWrap);
    bool setCollapseWhitespaces(bool collapseWhitespaces);
    bool setPreserveLeadingSpaces(bool preserveLeadingSpaces);
    bool setPreserveTrailingSpaces(bool preserveTrailingSpaces);
    bool setAllowWordBreaks(bool allowWordBreaks);
    bool setDemoteNewlines(bool demoteNewlines);
    bool setJustifyText(bool justifyText);

 public: // state info getters

    unsigned getRowCount(void) const;
    unsigned getColumnCount(void) const;
    unsigned getSoftWrapCount(void) const;
    unsigned getMaxCharacterIndex(void) const;

    Position getFirstPosition(void) const;
    Position getLastPosition(void) const;

    bool doesSoftWrap(unsigned row) const;

    std::string const & getLineString(unsigned row) const;

 public: // cursor management

    Position getFixedPosition(Position position) const;

    Position getPositionLeft(Position position) const;
    Position getPositionRight(Position position) const;

    Position getPositionAbove(Position position, unsigned amplitude = 1) const;
    Position getPositionBelow(Position position, unsigned amplitude = 1) const;

 public: // pointers conversions

    unsigned getRowForCharacterIndex(unsigned characterIndex) const;
    unsigned getCharacterIndexForRow(unsigned row) const;

    Position getPositionForCharacterIndex(unsigned characterIndex) const;
    unsigned getCharacterIndexForPosition(Position position) const;

 public: // state mutators

    TextOperation reset(void);
    TextOperation reset(std::string const & source);

    TextOperation update(unsigned start, unsigned deleted, std::string const & added);

#ifdef DEBUG

 public: // debug only

    void dump(std::vector<Line> const & generatedLines) const;
    void dump(void) const;

#endif

 private:

    void apply(TextOperation const & textOperation);

 private:

    TokenLocator findTokenLocatorForPosition(Position const & position) const;

 private:

    unsigned m_columns;
    unsigned m_tabWidth;

    bool m_softWrap;
    bool m_collapseWhitespaces;
    bool m_preserveLeadingSpaces;
    bool m_preserveTrailingSpaces;
    bool m_allowWordBreaks;
    bool m_demoteNewlines;
    bool m_justifyText;

    std::string m_source;

    LineSizeContainer m_lineSizeContainer;
    unsigned m_softWrapCount;

    std::vector<Line> m_lines;

};
