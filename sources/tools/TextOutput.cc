#include <cassert>

#include <sstream>

#include "./../Patch.hh"
#include "./TextOutput.hh"

TextOutput::TextOutput(void)
: m_lines{ "" }
{
}

TextOutput::TextOutput(std::vector<std::string> const & lines)
: m_lines(lines)
{
}

unsigned TextOutput::getLineCount(void) const
{
    return m_lines.size();
}

std::string const & TextOutput::getLineForRow(unsigned row) const
{
    assert(row < m_lines.size());

    return m_lines.at(row);
}

std::string TextOutput::getText(void) const
{
    std::ostringstream stream(m_lines.front(), std::ios_base::out | std::ios_base::ate);

    for (unsigned t = 1; t < m_lines.size(); ++t)
        stream << "\n" << m_lines.at(t);

    return stream.str();
}

void TextOutput::apply(Patch const & patch)
{
    assert(patch.startingRow <= m_lines.size());
    assert(patch.startingRow + patch.deletedLineCount <= m_lines.size());

    m_lines.erase(m_lines.begin() + patch.startingRow, m_lines.begin() + patch.startingRow + patch.deletedLineCount);
    m_lines.insert(m_lines.begin() + patch.startingRow, patch.addedLines.begin(), patch.addedLines.end());
}
