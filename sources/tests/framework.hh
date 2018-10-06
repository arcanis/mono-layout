#include <sstream>

#include <catch.hpp>

#include "./../tools/TextOutput.hh"
#include "./../TextLayout.hh"

#define SETUP_EMPTY()                 \
                                      \
    TextLayout layout = TextLayout(); \

#define SETUP(STR)                     \
                                       \
    TextLayout layout = TextLayout();  \
                                       \
    TextOutput output = TextOutput();  \
    output.apply(layout.setText(STR)); \

#define SPLICE(OFFSET, LENGTH, REPLACEMENT)                   \
{                                                             \
    auto offset = (OFFSET);                                   \
    auto length = (LENGTH);                                   \
                                                              \
    std::ostringstream replacementBuilder;                    \
    replacementBuilder << (REPLACEMENT);                      \
    std::string replacement = replacementBuilder.str();       \
                                                              \
    output.apply(layout.update(offset, length, replacement)); \
}                                                             \

#define APPEND(STRING)                                \
{                                                     \
    SPLICE(layout.getMaxCharacterIndex(), 0, STRING); \
}                                                     \

#define RESET()                       \
{                                     \
    output.apply(layout.clearText()); \
}                                     \

#define TEXT()        \
({                    \
    output.getText(); \
})                    \

#define LINE_COUNT()       \
({                         \
    output.getLineCount(); \
})                         \

#define FOR(C, STR)                 \
                                    \
    for (auto c : std::string(STR))
