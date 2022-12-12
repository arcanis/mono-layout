#pragma once

#include <string>

class StringContainer {

 public:

    StringContainer()
    : m_internalRepresentation()
    {
    }

    StringContainer(std::string const & str)
    : m_internalRepresentation(str)
    {
    }

 public:
    StringContainer & operator=(std::string const & value)
    {
        m_internalRepresentation = value;

        return *this;
    }

    StringContainer & operator+=(StringContainer const & other)
    {
        m_internalRepresentation += other.m_internalRepresentation;

        return *this;
    }

    StringContainer & operator+=(char c)
    {
        m_internalRepresentation += c;

        return *this;
    }

    char at(unsigned offset)
    {
        return m_internalRepresentation.at(offset);
    }

    void splice(unsigned start, unsigned removed, std::string const & added)
    {
        m_internalRepresentation = m_internalRepresentation.substr(0, start) + added + m_internalRepresentation.substr(start + removed);
    }

    size_t size() const
    {
        return m_internalRepresentation.size();
    }

    StringContainer substr(unsigned start, unsigned end)
    {
        return m_internalRepresentation.substr(start, end);
    }

    StringContainer substr(unsigned start)
    {
        return m_internalRepresentation.substr(start);
    }

    std::string const & toString() const
    {
        return m_internalRepresentation;
    }

 private:

    std::string m_internalRepresentation;

};
