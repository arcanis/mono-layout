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

    method(getColumns);
    method(getTabWidth);
    method(getSoftWrap);
    method(getCollapseWhitespaces);
    method(getPreserveLeadingSpaces);
    method(getPreserveTrailingSpaces);
    method(getAllowWordBreaks);
    method(getDemoteNewlines);
    method(getJustifyText);

    method(setColumns);
    method(setTabWidth);
    method(setSoftWrap);
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
    method(getMaxCharacterIndex);
    method(getFirstPosition);
    method(getLastPosition);
    method(doesSoftWrap);

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
