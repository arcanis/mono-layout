#pragma once

#include <string>

#include "./StringContainer.hh"

enum TokenType {

    TOKEN_DYNAMIC,
    TOKEN_WHITESPACES,
    TOKEN_WORD

};

struct Token {

    TokenType type;

    unsigned inputOffset;
    unsigned inputLength;

    unsigned outputOffset;
    unsigned outputLength;

    bool canBeSubdivided;

    StringContainer string;

    Token(void)
    : type(TOKEN_DYNAMIC)
    , inputOffset(0)
    , inputLength(0)
    , outputOffset(0)
    , outputLength(0)
    , canBeSubdivided(false)
    {
    }

    Token(TokenType type)
    : type(type)
    , inputOffset(0)
    , inputLength(0)
    , outputOffset(0)
    , outputLength(0)
    , canBeSubdivided(false)
    {
    }

};
