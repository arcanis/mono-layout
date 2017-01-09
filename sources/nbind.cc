#include "./Patch.hh"
#include "./Position.hh"
#include "./TextLayout.hh"

#include <nbind/nbind.h>

NBIND_CLASS(Patch)
{
    construct<>();
}

NBIND_CLASS(Position)
{
    construct<>();
    construct<unsigned, unsigned>();
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

    method(getRowCount);
    method(getColumnCount);
    method(getSoftWrapCount);

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
