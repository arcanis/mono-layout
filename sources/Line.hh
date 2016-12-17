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

    bool hasNewline;

    std::vector<Token> tokens;
    std::string string;

    Line(void)
    : inputOffset(0)
    , inputLength(0)
    , outputOffset(0)
    , outputLength(0)
    , hasNewline(false)
    , tokens{}
    , string("")
    {
    }

    Line(std::initializer_list<Token> tokens)
    : inputOffset(0)
    , inputLength(0)
    , outputOffset(0)
    , outputLength(0)
    , hasNewline(false)
    , tokens(tokens)
    , string("")
    {
    }

};
