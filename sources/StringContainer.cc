#include <string>
#include <vector>

#include "./StringContainer.hh"

StringContainer & StringContainer::operator=(std::string const & value)
{
    m_internalRepresentation.reserve(value.size());

    for (auto c : uni::views::grapheme::utf8(value))
        m_internalRepresentation.emplace_back(std::string(c));

    return *this;
}

StringContainer & StringContainer::operator+=(StringContainer const & other)
{
    m_internalRepresentation.reserve(m_internalRepresentation.size() + other.size());
    m_internalRepresentation.insert(m_internalRepresentation.end(), other.m_internalRepresentation.begin(), other.m_internalRepresentation.end());

    return *this;
}

StringContainer & StringContainer::operator+=(GraphemeContainer const & c)
{
    m_internalRepresentation.emplace_back(c);

    return *this;
}

GraphemeContainer const & StringContainer::at(unsigned offset) const
{
    return m_internalRepresentation.at(offset);
}

void StringContainer::splice(unsigned start, unsigned removed, std::string const & added)
{
    std::vector<std::string> addedView;
    addedView.reserve(added.size());

    for (auto c : uni::views::grapheme::utf8(added))
        addedView.emplace_back(std::string(c));

    m_internalRepresentation.erase(m_internalRepresentation.begin() + start, m_internalRepresentation.begin() + start + removed);

    m_internalRepresentation.reserve(m_internalRepresentation.size() + addedView.size());
    m_internalRepresentation.insert(m_internalRepresentation.begin() + start, addedView.begin(), addedView.end());
}

size_t StringContainer::size() const
{
    return m_internalRepresentation.size();
}

StringContainer StringContainer::substr(unsigned start, unsigned end) const
{
    StringContainer copy;
    copy.m_internalRepresentation.insert(copy.m_internalRepresentation.end(), m_internalRepresentation.begin() + start, m_internalRepresentation.end() + end);

    return copy;
}

StringContainer StringContainer::substr(unsigned start) const
{
    StringContainer copy;
    copy.m_internalRepresentation.insert(copy.m_internalRepresentation.end(), m_internalRepresentation.begin() + start, m_internalRepresentation.end());

    return copy;
}
