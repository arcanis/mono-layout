#include <emscripten/bind.h>

#include "./Position.hh"
#include "./TextLayout.hh"
#include "./TextOperation.hh"

EMSCRIPTEN_BINDINGS(text_layout)
{
    using namespace emscripten;

    register_vector<std::string>("std::vector<char>");

    value_object<TextOperation>("TextOperation")
        .field("startingRow", &TextOperation::startingRow)
        .field("deletedLineCount", &TextOperation::deletedLineCount)
        .field("addedLineCount", &TextOperation::addedLineCount);

    value_object<Position>("Position")
        .field("x", &Position::x)
        .field("y", &Position::y);

    class_<TextLayout>("TextLayout")
        .constructor<>()

        .function("getColumns", &TextLayout::getColumns)
        .function("getTabWidth", &TextLayout::getTabWidth)
        .function("getSoftWrap", &TextLayout::getSoftWrap)
        .function("getCollapseWhitespaces", &TextLayout::getCollapseWhitespaces)
        .function("getPreserveLeadingSpaces", &TextLayout::getPreserveLeadingSpaces)
        .function("getPreserveTrailingSpaces", &TextLayout::getPreserveTrailingSpaces)
        .function("getAllowWordBreaks", &TextLayout::getAllowWordBreaks)
        .function("getDemoteNewlines", &TextLayout::getDemoteNewlines)
        .function("getJustifyText", &TextLayout::getJustifyText)

        .function("setColumns", &TextLayout::setColumns)
        .function("setTabWidth", &TextLayout::setTabWidth)
        .function("setSoftWrap", &TextLayout::setSoftWrap)
        .function("setCollapseWhitespaces", &TextLayout::setCollapseWhitespaces)
        .function("setPreserveLeadingSpaces", &TextLayout::setPreserveLeadingSpaces)
        .function("setPreserveTrailingSpaces", &TextLayout::setPreserveTrailingSpaces)
        .function("setAllowWordBreaks", &TextLayout::setAllowWordBreaks)
        .function("setDemoteNewlines", &TextLayout::setDemoteNewlines)
        .function("setJustifyText", &TextLayout::setJustifyText)

        .function("getRowCount", &TextLayout::getRowCount)
        .function("getColumnCount", &TextLayout::getColumnCount)
        .function("getSoftWrapCount", &TextLayout::getSoftWrapCount)
        .function("getMaxCharacterIndex", &TextLayout::getMaxCharacterIndex)
        .function("getFirstPosition", &TextLayout::getFirstPosition)
        .function("getLastPosition", &TextLayout::getLastPosition)
        .function("doesSoftWrap", &TextLayout::doesSoftWrap)
        .function("getSource", &TextLayout::getSource)
        .function("getText", &TextLayout::getText)
        .function("getLine", &TextLayout::getLine)

        .function("getFixedPosition", &TextLayout::getFixedPosition)
        .function("getPositionLeft", &TextLayout::getPositionLeft)
        .function("getPositionRight", &TextLayout::getPositionRight)
        .function("getPositionAbove", &TextLayout::getPositionAbove)
        .function("getPositionBelow", &TextLayout::getPositionBelow)

        .function("getRowForCharacterIndex", &TextLayout::getRowForCharacterIndex)
        .function("getCharacterIndexForRow", &TextLayout::getCharacterIndexForRow)

        .function("getPositionForCharacterIndex", &TextLayout::getPositionForCharacterIndex)
        .function("getCharacterIndexForPosition", &TextLayout::getCharacterIndexForPosition)

        .function("clearSource", &TextLayout::clearSource)
        .function("setSource", &TextLayout::setSource)
        .function("spliceSource", &TextLayout::spliceSource)
        ;
}
