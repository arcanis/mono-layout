#include "./LineSizeContainer.hh"

LineSizeContainer::LineSizeContainer(void)
: m_container{}
{
}

void LineSizeContainer::increase(unsigned size)
{
    m_container[size] += 1;
}

void LineSizeContainer::decrease(unsigned size)
{
    auto it = m_container.find(size);
    it->second -= 1;

    if (it->second == 0) {
        m_container.erase(it);
    }
}

unsigned LineSizeContainer::getMaxSize(void) const
{
    return m_container.rbegin()->first;
}
