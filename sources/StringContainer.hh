#pragma once

#include <string>
#include <vector>

#include "uni_algo/break_grapheme.h"

class GraphemeContainer {

 public:

    GraphemeContainer(std::string view)
    : m_view(view)
    {
    }

 public:

    size_t size() const
    {
        return m_view.size();
    }

    char operator*() const
    {
        return m_view.at(0);
    }

    std::string view() const
    {
        return m_view;
    }

 private:

    std::string m_view;

};

class StringContainer {

 public:

    StringContainer()
    : m_internalRepresentation()
    {
    }

    StringContainer(std::string const & str)
    : m_internalRepresentation()
    {
        *this = str;
    }

 public:

    auto begin() const
    {
        return m_internalRepresentation.begin();
    }

    auto end() const
    {
        return m_internalRepresentation.end();
    }

 public:

    GraphemeContainer const & at(unsigned offset) const;

    size_t size() const;

 public:

    StringContainer & operator=(std::string const & value);

    StringContainer & operator+=(StringContainer const & other);
    StringContainer & operator+=(GraphemeContainer const & c);

    void splice(unsigned start, unsigned removed, std::string const & added);

    StringContainer substr(unsigned start, unsigned end) const;
    StringContainer substr(unsigned start) const;

    std::string toString() const
    {
        std::string finalString;

        unsigned size = 0;
        for (auto & c : m_internalRepresentation)
            size += c.size();

        finalString.reserve(size);
        for (auto & c : m_internalRepresentation)
            finalString += c.view();

        return finalString;
    }

 private:

    std::vector<GraphemeContainer> m_internalRepresentation;

};
