#include "./TextProvider.hh"

TextProvider::TextProvider(std::string text)
: m_text(text)
{
}

unsigned TextProvider::getCharacterCount(void) const
{
    return m_text.size();
}

void TextProvider::update(unsigned offset, unsigned removed, std::string const & replacement)
{
    m_text.replace(offset, removed, replacement);
}

std::function<char(unsigned)> TextProvider::getCharacterGetter(void) const
{
    return [this] (unsigned offset) {
        return m_text.at(offset);
    };
}

std::function<unsigned(void)> TextProvider::getCharacterCountGetter(void) const
{
    return [this] (void) {
        return m_text.size();
    };
}
