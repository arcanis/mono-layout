#include "./Patch.hh"
#include "./Position.hh"
#include "./TextLayout.hh"

#include <nbind/nbind.h>

NBIND_CLASS(Patch)
{
    getter(getStartingRow);
    getter(getDeletedLineCount);
    getter(getAddedLines);
}

NBIND_CLASS(Position)
{
    construct<>();
    construct<unsigned, unsigned>();

    getter(getX);
    getter(getY);
}

NBIND_CLASS(TextLayout)
{
    construct<>();

    method(setColumns);
    method(setTabWidth);
    method(setCollapseWhitespaces);
    method(setPreserveLeadingSpaces);
    method(setPreserveTrailingSpaces);
    method(setAllowWordBreaks);
    method(setDemoteNewlines);
    method(setJustifyText);

    method(setCharacterGetter);
    method(setCharacterCountGetter);

    method(getFixedPosition);
    method(getPositionLeft);
    method(getPositionRight);
    method(getPositionAbove);
    method(getPositionBelow);

    method(getRowForCharacterIndex);
    method(getCharacterIndexForRow);

    method(getPositionForCharacterIndex);
    method(getCharacterIndexForPosition);

    method(reset);
    method(update);
}
