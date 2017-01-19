#include <cassert>

#include <algorithm>
#include <iostream>
#include <sstream>
#include <string>

#ifdef NBIND
# include <nbind/api.h>
#endif

#include "./Line.hh"
#include "./Patch.hh"
#include "./TextLayout.hh"
#include "./Token.hh"

TextLayout::TextLayout(void)
: m_columns(static_cast<unsigned>(-1))
, m_tabWidth(4)
, m_softWrap(false)
, m_collapseWhitespaces(false)
, m_preserveLeadingSpaces(false)
, m_preserveTrailingSpaces(false)
, m_allowWordBreaks(false)
, m_demoteNewlines(false)
, m_justifyText(false)
, m_getCharacter()
, m_getCharacterCount()
, m_lineSizeContainer()
, m_softWrapCount(0)
, m_lines{ Line{ Token(TOKEN_DYNAMIC) } }
{
    assert(m_lines.size() > 0);
}

unsigned TextLayout::getColumns(void) const
{
    return m_columns;
}

unsigned TextLayout::getTabWidth(void) const
{
    return m_tabWidth;
}

bool TextLayout::getSoftWrap(void) const
{
    return m_softWrap;
}

bool TextLayout::getCollapseWhitespaces(void) const
{
    return m_collapseWhitespaces;
}

bool TextLayout::getPreserveLeadingSpaces(void) const
{
    return m_preserveLeadingSpaces;
}

bool TextLayout::getPreserveTrailingSpaces(void) const
{
    return m_preserveTrailingSpaces;
}

bool TextLayout::getAllowWordBreaks(void) const
{
    return m_allowWordBreaks;
}

bool TextLayout::getDemoteNewlines(void) const
{
    return m_demoteNewlines;
}

bool TextLayout::getJustifyText(void) const
{
    return m_justifyText;
}

bool TextLayout::setColumns(unsigned columns)
{
    if (m_columns == columns)
        return false;

    m_columns = columns;

    if (!this->getSoftWrap())
        return false;

    if (this->getSoftWrapCount() == 0 && m_columns >= this->getColumnCount())
        return false;

    return true;
}

bool TextLayout::setTabWidth(unsigned tabWidth)
{
    if (m_tabWidth == tabWidth)
        return false;

    m_tabWidth = tabWidth;

    return true;
}

bool TextLayout::setSoftWrap(bool softWrap)
{
    if (m_softWrap == softWrap)
        return false;

    m_softWrap = softWrap;

    if (m_softWrap) {
        return this->getSoftWrapCount() == 0;
    } else {
        return this->getColumnCount() < this->getColumns();
    }

}

bool TextLayout::setCollapseWhitespaces(bool collapseWhitespaces)
{
    if (m_collapseWhitespaces == collapseWhitespaces)
        return false;

    m_collapseWhitespaces = collapseWhitespaces;

    return true;
}

bool TextLayout::setPreserveLeadingSpaces(bool preserveLeadingSpaces)
{
    if (m_preserveLeadingSpaces == preserveLeadingSpaces)
        return false;

    m_preserveLeadingSpaces = preserveLeadingSpaces;

    return true;
}

bool TextLayout::setPreserveTrailingSpaces(bool preserveTrailingSpaces)
{
    if (m_preserveTrailingSpaces == preserveTrailingSpaces)
        return false;

    m_preserveTrailingSpaces = preserveTrailingSpaces;

    return true;
}

bool TextLayout::setAllowWordBreaks(bool allowWordBreaks)
{
    if (m_allowWordBreaks == allowWordBreaks)
        return false;

    m_allowWordBreaks = allowWordBreaks;

    return true;
}

bool TextLayout::setDemoteNewlines(bool demoteNewlines)
{
    if (m_demoteNewlines == demoteNewlines)
        return false;

    m_demoteNewlines = demoteNewlines;

    return true;
}

bool TextLayout::setJustifyText(bool justifyText)
{
    if (m_justifyText == justifyText)
        return false;

    m_justifyText = justifyText;

    return true;
}

#ifndef NBIND

void TextLayout::setCharacterGetter(std::function<char(unsigned)> const & characterGetter)
{
    m_getCharacter = characterGetter;
}

void TextLayout::setCharacterCountGetter(std::function<unsigned(void)> const & characterCountGetter)
{
    m_getCharacterCount = characterCountGetter;
}

#else

void TextLayout::setCharacterGetter(nbind::cbFunction & characterGetter)
{
    m_getCharacter.reset(new nbind::cbFunction(characterGetter));
}

void TextLayout::setCharacterCountGetter(nbind::cbFunction & characterCountGetter)
{
    m_getCharacterCount.reset(new nbind::cbFunction(characterCountGetter));
}

#endif

unsigned TextLayout::getRowCount(void) const
{
    return m_lines.size();
}

unsigned TextLayout::getColumnCount(void) const
{
    return m_lineSizeContainer.getMaxSize();
}

unsigned TextLayout::getSoftWrapCount(void) const
{
    return m_softWrapCount;
}

TokenLocator TextLayout::findTokenLocatorForPosition(Position const & position) const
{
    assert(position.y < m_lines.size());

    Line const & line = m_lines.at(position.y);

    assert(position.x <= line.outputLength);

    auto tokenIterator = std::lower_bound(line.tokens.begin(), line.tokens.end(), position.x, [] (auto const & token, auto x) {
        return token.outputOffset + token.outputLength <= x;
    });

    if (tokenIterator == line.tokens.end())
        tokenIterator -= 1;

    unsigned tokenIndex = tokenIterator - line.tokens.begin();
    Token const & token = *tokenIterator;

    return TokenLocator(position.y, tokenIndex, line, token);
}

Position TextLayout::getFixedPosition(Position position) const
{
    assert(m_lines.size() > 0);

    position.y = std::min(position.y, static_cast<unsigned>(m_lines.size() - 1));
    position.x = std::min(position.x, m_lines.at(position.y).outputLength);

    auto const & line = m_lines.at(position.y);

    // if we're on the left or right edges of the line, everything's fine
    if (position.x == 0 || position.x == line.outputLength)
        return position;

    auto const & token = this->findTokenLocatorForPosition(position).token;

    if (token.canBeSubdivided) {

        // if we're closer to the left side, we jump to it
        if (position.x <= token.outputOffset + token.outputLength / 2) {
            position.x = token.outputOffset;

        // and if we're closer to right side, same old same old
        } else {
            position.x = token.outputOffset + token.outputLength;
        }

    }

    return position;
}

Position TextLayout::getPositionLeft(Position position) const
{
    assert(m_lines.size() > 0);
    assert(position.y < m_lines.size());

    auto tokenLocator = this->findTokenLocatorForPosition(position);

    auto const & line = tokenLocator.line;
    auto const & token = tokenLocator.token;

    // if we're inside the token or on its right edge
    if (position.x > token.outputOffset) {

        // if our token can be subdivided, we just move inside
        if (token.canBeSubdivided) {
            position.x -= 1;

        // otherwise, we need to teleport ourselves to the beginning of the token
        } else {
            position.x = token.outputOffset;
        }

    // if we're on the left edge of the token
    } else {

        // if we're on the left edge of the first token of the line, we'll need to move to the end of the line above if possible
        if (tokenLocator.tokenIndex == 0) {

            // but only if possible :) otherwise, we don't do anything
            if (position.y > 0) {
                position.y -= 1;
                position.x = m_lines.at(position.y).outputLength;
            }

        // otherwise, try to move inside its left neighbor
        } else {

            auto const & neighbor = line.tokens.at(tokenLocator.tokenIndex - 1);

            // if we can enter inside our left neighbor, we just do it
            if (neighbor.canBeSubdivided) {
                position.x -= 1;

            // otherwise, we just simply jump to its beginning
            } else {
                position.x = neighbor.outputOffset;
            }

        }

    }

    return position;
}

Position TextLayout::getPositionRight(Position position) const
{
    assert(m_lines.size() > 0);
    assert(position.y < m_lines.size());

    auto tokenLocator = this->findTokenLocatorForPosition(position);

    auto const & line = tokenLocator.line;
    auto const & token = tokenLocator.token;

    // if we're inside the token or on its left edge
    if (position.x < token.outputOffset + token.outputLength) {

        // if our token can be subdivided, we just move inside
        if (token.canBeSubdivided) {
            position.x += 1;

        // otherwise, we need to teleport ourselves to the end of the token
        } else {
            position.x = token.outputOffset + token.outputLength;
        }

    // if we're on the right edge of the token
    } else {

        // if we're on the right edge of the last token of the line, we'll need to move to the beginning of the line below if possible
        if (tokenLocator.tokenIndex == line.tokens.size() - 1) {

            // but only if possible :) otherwise, we don't do anything
            if (position.y < m_lines.size() - 1) {
                position.y += 1;
                position.x = 0;
            }

        // otherwise, try to move inside its right neighbor
        } else {

            auto const & neighbor = line.tokens.at(tokenLocator.tokenIndex + 1);

            // if we can enter inside our right neighbor, we just do it
            if (neighbor.canBeSubdivided) {
                position.x += 1;

            // otherwise, we just simply jump to its end
            } else {
                position.x = neighbor.outputOffset + neighbor.outputLength;
            }

        }

    }

    return position;
}

Position TextLayout::getPositionAbove(Position position, unsigned amplitude) const
{
    assert(m_lines.size() > 0);
    assert(position.y < m_lines.size());

    if (amplitude == 0)
        return position;

    // if jumping with the requested amplitude would bring above the very first line, we just go to the beginning of the line (/!\ Careful to underflows /!\)
    if (amplitude > position.y) {
        position.y = 0;
        position.x = 0;

    } else {
        position.y -= amplitude;

        // if we land on the left edge of a line, short-circuit the rest of the procedure, since it will always be a valid positioning
        if (position.x == 0) {
            return position;

        // if we land on the right edge of the line or beyond, same old same old, we can short-circuit the rest of the procedure as long as we stay on the line
        } else if (position.x >= m_lines.at(position.y).outputLength) {
            position.x = m_lines.at(position.y).outputLength;
            return position;

        // otherwise, we have to check the token on which we land, to make sure we stay outside if it can't be subdivided
        } else {

            auto tokenLocator = this->findTokenLocatorForPosition(position);
            auto const & token = tokenLocator.token;

            if (!token.canBeSubdivided) {

                // if we're closer to the left side, we jump to it
                if (position.x <= token.outputOffset + token.outputLength / 2) {
                    position.x = token.outputOffset;

                // and if we're closer to right side, same old same old
                } else {
                    position.x = token.outputOffset + token.outputLength;
                }

            }

        }

    }

    return position;
}

Position TextLayout::getPositionBelow(Position position, unsigned amplitude) const
{
    assert(m_lines.size() > 0);
    assert(position.y < m_lines.size());

    if (amplitude == 0)
        return position;

    // if jumping with the requested amplitude would bring below the very last line, we just go to the end of the line (/!\ Careful to underflows /!\)
    if (amplitude > m_lines.size() - position.y - 1) {
        position.y = m_lines.size() - 1;
        position.x = m_lines.at(position.y).outputLength;

    } else {
        position.y += amplitude;

        // if we land on the left edge of a line, short-circuit the rest of the procedure, since it will always be a valid positioning
        if (position.x == 0) {
            return position;

        // if we land on the right edge of the line or beyond, same old same old, we can short-circuit the rest of the procedure as long as we stay on the line
        } else if (position.x >= m_lines.at(position.y).outputLength) {
            position.x = m_lines.at(position.y).outputLength;
            return position;

        // otherwise, we have to check the token on which we land, to make sure we stay outside if it can't be subdivided
        } else {

            auto tokenLocator = this->findTokenLocatorForPosition(position);
            auto const & token = tokenLocator.token;

            if (!token.canBeSubdivided) {

                // if we're closer to the left side, we jump to it
                if (position.x <= token.outputOffset + token.outputLength / 2) {
                    position.x = token.outputOffset;

                // and if we're closer to right side, same old same old
                } else {
                    position.x = token.outputOffset + token.outputLength;
                }

            }

        }

    }

    return position;
}

unsigned TextLayout::getRowForCharacterIndex(unsigned characterIndex) const
{
    assert(m_lines.size() > 0);
    assert(characterIndex <= m_lines.back().inputOffset + m_lines.back().inputLength);

    auto lineIterator = std::lower_bound(m_lines.begin(), m_lines.end(), characterIndex, [] (auto const & line, auto characterIndex) {
        return line.inputOffset + line.inputLength <= characterIndex;
    });

    if (lineIterator != m_lines.end()) {
        return static_cast<unsigned>(lineIterator - m_lines.begin());
    } else {
        return static_cast<unsigned>(lineIterator - m_lines.begin() - 1);
    }
}

unsigned TextLayout::getCharacterIndexForRow(unsigned row) const
{
    assert(row < m_lines.size());

    return m_lines.at(row).inputOffset;
}

Position TextLayout::getPositionForCharacterIndex(unsigned characterIndex) const
{
    assert(m_lines.size() > 0);
    assert(characterIndex <= m_lines.back().inputOffset + m_lines.back().inputLength);

    Position position;

    auto lineIterator = std::lower_bound(m_lines.begin(), m_lines.end(), characterIndex, [] (auto const & line, auto characterIndex) {
        return line.inputOffset + line.inputLength <= characterIndex;
    });

    if (lineIterator == m_lines.end()) {

        position.y = m_lines.size() - 1;
        position.x = m_lines.at(position.y).outputLength;

    } else {

        position.y = lineIterator - m_lines.begin();

        auto tokenIterator = std::lower_bound(lineIterator->tokens.begin(), lineIterator->tokens.end(), characterIndex - lineIterator->inputOffset, [] (auto const & token, auto characterIndex) {
            return token.inputOffset + token.inputLength <= characterIndex;
        });

        if (tokenIterator->canBeSubdivided) {
            position.x = tokenIterator->outputOffset + (characterIndex - lineIterator->inputOffset - tokenIterator->inputOffset);
        } else if (tokenIterator->inputOffset + tokenIterator->inputLength == characterIndex - lineIterator->inputOffset) {
            position.x = tokenIterator->outputOffset + tokenIterator->outputLength;
        } else {
            position.x = tokenIterator->outputOffset;
        }

    }

    return position;
}

unsigned TextLayout::getCharacterIndexForPosition(Position position) const
{
    assert(m_lines.size() > 0);
    assert(position.y < m_lines.size());

    auto tokenLocator = this->findTokenLocatorForPosition(position);

    auto const & line = tokenLocator.line;
    auto const & token = tokenLocator.token;

    // if the character is located on the left edge of the token, everything's fine
    if (position.x == token.outputOffset) {

        return line.inputOffset + token.inputOffset;

    // same if we're on the right edge of a token
    } else if (position.x == token.outputOffset + token.outputLength) {

        return line.inputOffset + token.inputOffset + token.inputLength;

    // if we reach this case, it means that the character is located inside a token
    } else {

        // we can subdivise static tokens, but we cannot do this for dynamic tokens
        assert(token.canBeSubdivided);

        return line.inputOffset + token.inputOffset + position.x - token.outputOffset;

    }
}

Patch TextLayout::reset(void)
{
    assert(m_lines.size() > 0);

#ifndef NBIND
    auto characterCount = m_getCharacterCount();
#else
    auto characterCount = m_getCharacterCount->call<unsigned>();
#endif

    return this->update(0, m_lines.back().inputOffset + m_lines.back().inputLength, characterCount);
}

Patch TextLayout::update(unsigned start, unsigned removed, unsigned added)
{
#ifndef NBIND
    #define GET_CHARACTER_COUNT() m_getCharacterCount()
    #define GET_CHARACTER(OFFSET) m_getCharacter(OFFSET)
#else
    #define GET_CHARACTER_COUNT() m_getCharacterCount->call<unsigned>()
    #define GET_CHARACTER(OFFSET) m_getCharacter->call<char>(OFFSET)
#endif

    #define SET_OFFSET(OFFSET) do { offset = (OFFSET); offsetChar = offset < offsetMax ? GET_CHARACTER(offset) : '?'; } while (0)

    #define IS_NEWLINE() (!IS_END_OF_FILE() && !m_demoteNewlines && (offsetChar == '\r' || offsetChar == '\n'))
    #define IS_WHITESPACE() (!IS_END_OF_FILE() && (offsetChar == ' ' || offsetChar == '\t' || (m_demoteNewlines && (offsetChar == '\r' || offsetChar == '\n'))))
    #define IS_WORD() (!IS_END_OF_FILE() && !IS_WHITESPACE() && !IS_NEWLINE())

    #define SHIFT_CHARACTER() ({ char c = offsetChar; SET_OFFSET(offset + 1); c; })
    #define SHIFT_WHILE(COND, MAX) ({ std::string output; while (output.size() < MAX && COND) output += SHIFT_CHARACTER(); output; })

    #define SHIFT_WHITESPACES() SHIFT_WHILE(IS_WHITESPACE(), static_cast<unsigned>(-1))
    #define SHIFT_WORD() SHIFT_WHILE(IS_WORD(), static_cast<unsigned>(-1))

    #define SHIFT_WHITESPACES_UNTIL(MAX) SHIFT_WHILE(IS_WHITESPACE(), MAX)
    #define SHIFT_WORD_UNTIL(MAX) SHIFT_WHILE(IS_WORD(), MAX)

    #define IS_END_OF_LINE() (IS_NEWLINE() || IS_END_OF_FILE())
    #define IS_END_OF_FILE() (offset >= offsetMax)

    #define NEW_TOKEN(TYPE) ({ Token token = Token(TYPE); token.inputOffset = currentLine.inputLength; token.outputOffset = currentLine.outputLength; token; })
    #define PUSH_TOKEN(TOKEN) do { Token const & _token = (TOKEN); currentLine.tokens.push_back(_token); currentLine.inputLength += _token.inputLength; currentLine.outputLength += _token.outputLength; } while (0)

    // Create a structure that we will use to return a proper layout update (startingRow, removedLineCount & addedLines)
    Patch patch;

    // We only care about the number of columns if the soft wrap feature is enabled
    auto effectiveColumns = m_softWrap ? m_columns : std::numeric_limits<unsigned>::max();

    // We only allow soft wrapping if the soft wrap feature is also enabled
    auto effectiveJustifyText = m_softWrap && m_justifyText;

    // Compute the rows that surround the removed line segment
    auto rowStart = this->getRowForCharacterIndex(start);
    auto rowEnd = this->getRowForCharacterIndex(start + removed) + 1;

    // Use the starting row to round the starting offset to the beginning of the line
    auto offsetStart = this->getCharacterIndexForRow(rowStart), offset = offsetStart;

    // Create a temporary local buffer, so that we don't need to call getCharacter() & getCharacterCount() more than needed (which might get expensive, especially when crossing asmjs boundaries).
    auto offsetMax = GET_CHARACTER_COUNT();
    auto offsetChar = offset < offsetMax ? GET_CHARACTER(offset) : '?';

    // Also compute a tentative position where to stop the formatting process. It will be increased later if our newly generated lines invalidate their successors.
    // the +1 is required so that we actually iterate even when the very last line is empty (for example with "Foobar\n" or even "" - without this extra increment, we wouldn't create the very last empty line)
    auto offsetEnd = offsetMax + 1;

    // Compute the starting point of our modifications
    patch.startingRow = rowStart;

    // Compute the number of rows that we know have been deleted (this number might be increased later if newly generated rows invalidate their successors)
    patch.deletedLineCount = rowEnd - rowStart;

    // Check that the configuration isn't weird, and then start looping over each character
    if (effectiveColumns > 0) while (offset < offsetEnd) {

        // Create a new line that will then be populated with new tokens
        Line currentLine = Line();

        // Find its predecessor
        Line const * previousLine = nullptr;

        if (patch.addedLines.size() > 0)
            previousLine = &(patch.addedLines.back());
        else if (rowStart > 0)
            previousLine = &(m_lines.at(rowStart - 1));

        // Compute the location of the line inside the input string
        currentLine.inputOffset = offset;

        // Compute the location of the line inside the output string
        currentLine.outputOffset = previousLine ? previousLine->outputOffset + previousLine->outputLength : 0;

        // Check if the first characters are whitespaces and if they need to be removed (only if we're on the start of a new hard-line, or on the start of a soft-line but only when collapsing whitespaces)
        if (IS_WHITESPACE() && (!m_preserveLeadingSpaces || (m_collapseWhitespaces && previousLine && !previousLine->doesSoftWrap))) {

            Token token = Token(TOKEN_DYNAMIC);

            token.inputOffset = currentLine.inputLength;
            token.outputOffset = currentLine.outputLength;

            SHIFT_WHITESPACES();

            token.inputLength = offset - token.inputOffset - currentLine.inputOffset;
            token.outputLength = 0;

            PUSH_TOKEN(token);

        }

        // Iterate to find enough tokens to fill the line (until the requested number of columns is reached, or until the next \n, whatever happens first)
        while (!IS_END_OF_LINE()) {

            if (currentLine.outputLength < effectiveColumns && IS_WHITESPACE()) {

                // Add a single space character when collapsing spaces
                if (m_collapseWhitespaces) {

                    Token token = Token(TOKEN_WHITESPACES);

                    token.inputOffset = currentLine.inputLength;
                    token.outputOffset = currentLine.outputLength;

                    SHIFT_WHITESPACES();

                    token.inputLength = offset - token.inputOffset - currentLine.inputOffset;
                    token.outputLength = 1;

                    token.string = " ";

                    PUSH_TOKEN(token);

                // Otherwise, add all those spaces but normalize them first
                } else {

                    Token token = NEW_TOKEN(TOKEN_WHITESPACES);
                    token.canBeSubdivided = true;

                    for (auto c : SHIFT_WHITESPACES_UNTIL(effectiveColumns - currentLine.outputLength)) switch (c) {

                        case '\r':
                        case '\n':
                        case ' ': {

                            token.string += ' ';

                            token.inputLength += 1;
                            token.outputLength += 1;

                        } break;

                        case '\t': {

                            if (token.inputLength > 0 || token.outputLength > 0) {

                                PUSH_TOKEN(token);

                                token = NEW_TOKEN(TOKEN_WHITESPACES);
                                token.canBeSubdivided = false;

                            } else {

                                token.canBeSubdivided = false;

                            }

                            token.string += std::string(m_tabWidth, ' ');

                            token.inputLength += 1;
                            token.outputLength += m_tabWidth;

                            PUSH_TOKEN(token);

                            token = NEW_TOKEN(TOKEN_WHITESPACES);
                            token.canBeSubdivided = true;

                        } break;

                    }

                    if (token.inputLength > 0 || token.outputLength > 0) {
                        PUSH_TOKEN(token);
                    }

                }

                assert(currentLine.outputLength <= effectiveColumns);

            } // end of IS_WHITESPACE check

            if (currentLine.outputLength < effectiveColumns && IS_WORD()) {

                if (m_allowWordBreaks) {

                    Token token = Token(TOKEN_WORD);

                    token.canBeSubdivided = true;

                    token.inputOffset = currentLine.inputLength;
                    token.outputOffset = currentLine.outputLength;

                    token.string = SHIFT_WORD_UNTIL(effectiveColumns - currentLine.outputLength);

                    token.inputLength = offset - token.inputOffset - currentLine.inputOffset;
                    token.outputLength = token.string.size();

                    PUSH_TOKEN(token);

                } else {

                    Token token = Token(TOKEN_WORD);

                    token.canBeSubdivided = true;

                    token.inputOffset = currentLine.inputLength;
                    token.outputOffset = currentLine.outputLength;

                    token.string = SHIFT_WORD_UNTIL(effectiveColumns - currentLine.outputLength);

                    if (!IS_WORD() || currentLine.outputLength == 0) {

                        token.inputLength = offset - token.inputOffset - currentLine.inputOffset;
                        token.outputLength = token.string.size();

                        PUSH_TOKEN(token);

                    } else {

                        SET_OFFSET(currentLine.inputOffset + token.inputOffset);

                        // we need to break manually, otherwise we won't ever leave this loop since the offset will never change
                        break;

                    }

                }

                assert(currentLine.outputLength <= effectiveColumns);

            } // end of IS_WORD check

            if (currentLine.outputLength == effectiveColumns) {
                break;
            }

        } // end of line tokens loop

        assert(offset >= currentLine.inputOffset + currentLine.inputLength);

        currentLine.doesSoftWrap = !IS_END_OF_LINE();

        auto hasNewline = IS_NEWLINE();

        if (hasNewline)
            SHIFT_CHARACTER();

        // if we don't care about trailing and/or if we need to collapse our whitespaces and we're on a soft-wrapping line
        if (!m_preserveTrailingSpaces || ((m_collapseWhitespaces || effectiveJustifyText) && currentLine.doesSoftWrap && !IS_END_OF_FILE())) {

            auto tokenIterator = currentLine.tokens.rbegin();

            while (tokenIterator != currentLine.tokens.rend() && tokenIterator->type == TOKEN_WHITESPACES)
                tokenIterator += 1;

            // if tokenIterator goes to rend(), it means that the whole string is full of whitespaces. If the whole string is full of whitespaces, it means that we're on the first string and that we've already determined that these spaces should not be removed, so we skip this procedure. We also skip it if there's no trailing whitespaces, of course.
            if (tokenIterator != currentLine.tokens.rbegin() && tokenIterator != currentLine.tokens.rend()) {

                // Fix the line properties to account for the soon-to-be-removed tokens
                currentLine.inputLength = tokenIterator->inputOffset + tokenIterator->inputLength;
                currentLine.outputLength = tokenIterator->outputOffset + tokenIterator->outputLength;

                // Remove the extraneous tokens from the line
                auto extraTokenCount = tokenIterator - currentLine.tokens.rbegin();
                currentLine.tokens.resize(currentLine.tokens.size() - extraTokenCount);

            }

        }

        if (offset > currentLine.inputOffset + currentLine.inputLength || currentLine.tokens.size() == 0) {

            Token token = Token(TOKEN_DYNAMIC);

            token.inputOffset = currentLine.inputLength;
            token.outputOffset = currentLine.outputLength;

            token.string = "";

            token.inputLength = offset - token.inputOffset - currentLine.inputOffset;
            token.outputLength = 0;

            PUSH_TOKEN(token);

        }

        // Try to justify the line if needed and requested, except on the last soft-line of the hard-line, if that makes sense
        if (effectiveJustifyText && !IS_END_OF_LINE() && currentLine.outputLength < effectiveColumns) {

            // Hold the number of spaces we've added so far
            auto extraSpaceCount = 0u;

            // Hold the number of spaces that we still need to add
            auto missingSpaceCount = effectiveColumns - currentLine.outputLength;

            // Hold the number of slots where we can actually fit those extra spaces
            auto availableSlotCount = static_cast<unsigned>(std::count_if(currentLine.tokens.begin(), currentLine.tokens.end(), [](auto const & token) {
                return token.type == TOKEN_WHITESPACES && token.outputOffset > 0;
            }));

            if (availableSlotCount > 0) {

                // Hold the number of spaces we will have to add on each slot (=> ceil(missingSpaceCount / availableSlotCount))
                auto spacesPerSlot = 1u + ((missingSpaceCount - 1u) / availableSlotCount);

                for (auto & token : currentLine.tokens) {

                    token.outputOffset += extraSpaceCount;

                    if (missingSpaceCount > 0 && token.type == TOKEN_WHITESPACES && token.outputOffset > 0) {

                        auto localSpaceCount = std::min(spacesPerSlot, missingSpaceCount);

                        token.canBeSubdivided = false;

                        token.outputLength += localSpaceCount;
                        token.string += std::string(localSpaceCount, ' ');

                        extraSpaceCount += localSpaceCount;
                        missingSpaceCount -= localSpaceCount;

                        currentLine.outputLength += localSpaceCount;

                    }

                }

            }

        }

        assert(currentLine.tokens.size() > 0);

        std::string lineString;

        for (auto & token : currentLine.tokens)
            lineString += token.string;

        patch.addedLines.push_back(currentLine);
        patch.addedLineStrings.push_back(lineString);

        while (rowStart + patch.deletedLineCount != m_lines.size() && m_lines.at(rowStart + patch.deletedLineCount).inputOffset + added < offset + removed)
            patch.deletedLineCount += 1;

        if (rowStart + patch.deletedLineCount != m_lines.size() && m_lines.at(rowStart + patch.deletedLineCount).inputOffset + added == offset + removed)
            break;

        if (!hasNewline && IS_END_OF_FILE()) {
            break;
        }

    } // end of line loop

    this->apply(patch);

    return patch;
}

void TextLayout::apply(Patch const & patch)
{
    for (unsigned t = 0u; t < patch.deletedLineCount; ++t) {

        Line const & line = m_lines.at(patch.startingRow + t);

        m_lineSizeContainer.decrease(line.outputLength);

        if (line.doesSoftWrap) {
            m_softWrapCount -= 1;
        }

    }

    m_lines.erase(m_lines.begin() + patch.startingRow, m_lines.begin() + patch.startingRow + patch.deletedLineCount);
    m_lines.insert(m_lines.begin() + patch.startingRow, patch.addedLines.begin(), patch.addedLines.end());

    assert(m_lines.size() > 0);

    for (unsigned t = 0u; t < patch.addedLines.size(); ++t) {

        Line const & line = m_lines.at(patch.startingRow + t);

        m_lineSizeContainer.increase(line.outputLength);

        if (line.doesSoftWrap) {
            m_softWrapCount += 1;
        }

    }

    for (unsigned t = std::max(1u, static_cast<unsigned>(patch.startingRow + patch.addedLines.size())); t < m_lines.size(); ++t) {
        m_lines.at(t).inputOffset = m_lines.at(t - 1).inputOffset + m_lines.at(t - 1).inputLength;
        m_lines.at(t).outputOffset = m_lines.at(t - 1).outputOffset + m_lines.at(t - 1).outputLength;
    }
}

#ifdef DEBUG

#include <iostream>

void TextLayout::dump(std::vector<Line> const & lines) const
{
    std::cout << "========================================================" << std::endl;
    std::cout << "LINE COUNT: " << lines.size() << std::endl;
    std::cout << "========================================================" << std::endl;

    for (auto s = 0u; s < lines.size(); ++s) {

        auto const & line = lines.at(s);

        std::cout
            << "Line #" << s << std::endl
            << "    inputOffset  = " << line.inputOffset << std::endl
            << "    inputLength  = " << line.inputLength << std::endl
            << "    outputOffset = " << line.outputOffset << std::endl
            << "    outputLength = " << line.outputLength << std::endl
        ;

        for (auto t = 0u; t < line.tokens.size(); ++t) {

            auto const & token = line.tokens.at(t);

            std::cout
                << "    Token #" << t << std::endl
                << "        inputOffset  = " << token.inputOffset << std::endl
                << "        inputLength  = " << token.inputLength << std::endl
                << "        outputOffset = " << token.outputOffset << std::endl
                << "        outputLength = " << token.outputLength << std::endl
                << "        string       = '" << token.string << "'" << std::endl
            ;

        }

    }
}

void TextLayout::dump(void) const
{
    this->dump(m_lines);
}

#endif
