#pragma once

#include <functional>
#include <string>

class TextProvider {

 public:

    TextProvider(std::string text);

 public:

    unsigned getCharacterCount(void) const;

 public:

    void update(unsigned offset, unsigned removed, std::string const & replacement);

 public:

    std::function<char(unsigned)> getCharacterGetter(void) const;
    std::function<unsigned(void)> getCharacterCountGetter(void) const;

 private:

    std::string m_text;

};
