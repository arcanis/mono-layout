#pragma once

#include <string>
#include <vector>

struct Patch {

    // The index of the line from which we need to start update
    unsigned startingRow;

    // The number of lines that have to be removed
    unsigned deletedLineCount;

    // The vector of generated lines
    std::vector<std::string> addedLines;

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
        return addedLines;
    }

};
