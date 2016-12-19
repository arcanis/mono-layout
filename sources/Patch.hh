#pragma once

#include <vector>

#ifdef NBIND
# include <string>
#endif

#include "./Line.hh"

struct Patch {

    // The index of the line from which we need to start update
    unsigned startingRow;

    // The number of lines that have to be removed
    unsigned deletedLineCount;

    // The vector of generated lines
    std::vector<Line> addedLines;

    // The vector of generated line strings
    std::vector<std::string> addedLineStrings;

#ifdef NBIND

    unsigned getStartingRow(void) const
    {
        return startingRow;
    }

    unsigned getDeletedLineCount(void) const
    {
        return deletedLineCount;
    }

    std::vector<std::string> getAddedLines(void) const
    {
        return addedLineStrings;
    }

#endif

};
