#pragma once

#include <string>
#include <vector>

#include "../Patch.hh"

class TextOutput {

 public:

    TextOutput(void);
    TextOutput(std::vector<std::string> const & lines);

 public:

    unsigned getLineCount(void) const;

 public:

    std::string const & getLineForRow(unsigned row) const;
    std::string getText(void) const;

 public:

    void apply(Patch const & patch);

 private:

    std::vector<std::string> m_lines;

};
