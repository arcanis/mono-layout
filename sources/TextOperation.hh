#pragma once

#include <string>
#include <vector>

#ifdef NBIND
# include <nbind/api.h>
# include <nbind/BindDefiner.h>
#endif

#include "./Line.hh"

struct TextOperation {

    // The index of the line from which we need to start update
    unsigned startingRow;

    // The number of lines that have to be removed
    unsigned deletedLineCount;

    // The vector of generated lines
    std::vector<Line> addedLines;

    // The vector of generated line strings
    std::vector<std::string> addedLineStrings;

};
