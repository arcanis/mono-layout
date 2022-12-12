#include <sstream>
#include <string>
#include <utility>

#include <catch.hpp>

#include "./../tools/TextOutput.hh"
#include "./../TextLayout.hh"

#define SETUP_EMPTY()                 \
                                      \
    TextLayout layout = TextLayout(); \

#define SETUP(STR)                       \
                                         \
    TextLayout layout = TextLayout();    \
                                         \
    TextOutput output = TextOutput();    \
    output.apply(layout.setSource(STR)); \

#define SPLICE(OFFSET, LENGTH, REPLACEMENT)                         \
{                                                                   \
    auto offset = (OFFSET);                                         \
    auto length = (LENGTH);                                         \
                                                                    \
    std::ostringstream replacementBuilder;                          \
    replacementBuilder << (REPLACEMENT);                            \
    std::string replacement = replacementBuilder.str();             \
                                                                    \
    output.apply(layout.spliceSource(offset, length, replacement)); \
}                                                                   \

#define APPEND(STRING)                                \
{                                                     \
    SPLICE(layout.getMaxCharacterIndex(), 0, STRING); \
}                                                     \

#define RESET()                                \
{                                              \
    output.apply(layout.applyConfiguration()); \
}                                              \

#define SET_SOURCE(SOURCE)                  \
({                                          \
    output.apply(layout.setSource(SOURCE)); \
})                                          \

#define LINE_SLICE(ROW, START, END)       \
({                                        \
    layout.getLineSlice(ROW, START, END); \
})                                        \

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

#define ASSERT_EQ(LEFT, RIGHT) \
                               \
    REQUIRE(LEFT == RIGHT)

#define PositionRet(X, Y, PERFECT_FIT) std::pair<Position, bool>(Position(X, Y), PERFECT_FIT)
