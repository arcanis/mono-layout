#include <sstream>

#include <catch.hpp>

#include "./../tools/TextOutput.hh"
#include "./../tools/TextProvider.hh"
#include "./../TextLayout.hh"

#define SETUP_EMPTY()                                                   \
                                                                        \
    TextLayout layout = TextLayout();                                   \

#define SETUP(STR)                                                      \
                                                                        \
    TextLayout layout = TextLayout();                                   \
                                                                        \
    TextProvider provider = TextProvider(STR);                          \
    layout.setCharacterGetter(provider.getCharacterGetter());           \
    layout.setCharacterCountGetter(provider.getCharacterCountGetter()); \
                                                                        \
    TextOutput output = TextOutput();                                   \
    output.apply(layout.reset());                                       \

#define SPLICE(OFFSET, LENGTH, REPLACEMENT)                          \
{                                                                    \
    auto offset = (OFFSET);                                          \
    auto length = (LENGTH);                                          \
                                                                     \
    std::ostringstream replacementBuilder;                           \
    replacementBuilder << (REPLACEMENT);                             \
    std::string replacement = replacementBuilder.str();              \
                                                                     \
    provider.update(offset, length, replacement);                    \
    output.apply(layout.update(offset, length, replacement.size())); \
}                                                                    \

#define APPEND(STRING)                               \
{                                                    \
    SPLICE(provider.getCharacterCount(), 0, STRING); \
}                                                    \

#define RESET()                   \
{                                 \
    output.apply(layout.reset()); \
}                                 \

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
    for (auto c : std::string(STR)) \
