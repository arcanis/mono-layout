#pragma once

#include "./Line.hh"
#include "./Token.hh"

struct TokenLocator {

    unsigned row;
    unsigned tokenIndex;

    Line const & line;
    Token const & token;

    TokenLocator(unsigned row, unsigned tokenIndex, Line const & line, Token const & token)
    : row(row)
    , tokenIndex(tokenIndex)
    , line(line)
    , token(token)
    {
    }

};
