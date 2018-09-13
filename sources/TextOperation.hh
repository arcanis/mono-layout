#pragma once

#include <string>
#include <vector>

#include "./Line.hh"

struct TextOperation {

    // The index of the line from which we need to start update
    unsigned startingRow;

    // The number of lines that have to be removed
    unsigned deletedLineCount;

    // The number of lines that have been added
    unsigned addedLineCount;

    // The vector of generated lines
    std::vector<Line> addedLines;

};
