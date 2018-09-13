#pragma once

#include <initializer_list>
#include <string>
#include <vector>

#include "./Token.hh"

struct Line {

    unsigned inputOffset;
    unsigned inputLength;

    unsigned outputOffset;
    unsigned outputLength;

    bool doesSoftWrap;
    bool hasNewline;

    std::vector<Token> tokens;
    std::string string;

    Line(void)
    : inputOffset(0)
    , inputLength(0)
    , outputOffset(0)
    , outputLength(0)
    , doesSoftWrap(false)
    , hasNewline(false)
    , tokens{}
    , string()
    {
    }

    Line(std::initializer_list<Token> tokens)
    : inputOffset(0)
    , inputLength(0)
    , outputOffset(0)
    , outputLength(0)
    , doesSoftWrap(false)
    , hasNewline(false)
    , tokens(tokens)
    , string()
    {
        for (auto const & token : tokens) {
            this->string += token.string;
        }
    }

};
