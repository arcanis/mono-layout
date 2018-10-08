#pragma once

#ifdef DEBUG
# include <iostream>
#endif

struct Position {

    unsigned x;
    unsigned y;

    Position(void)
    : x(0)
    , y(0)
    {
    }

    Position(unsigned x, unsigned y)
    : x(x)
    , y(y)
    {
    }

    bool operator==(Position const & other) const
    {
        return x == other.x && y == other.y;
    }

};

#ifdef DEBUG

inline static std::ostream & operator <<(std::ostream & os, Position const & position)
{
    os << "<Position#x=" << position.x << "; y=" << position.y << ">" << std::endl;

    return os;
}

#endif
