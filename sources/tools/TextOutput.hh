#pragma once

#include <string>
#include <vector>

#include "../TextOperation.hh"

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

    void apply(TextOperation const & textOperation);

 private:

    std::vector<std::string> m_lines;

};
