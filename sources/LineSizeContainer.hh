#pragma once

#include <map>

class LineSizeContainer {

 public:

    LineSizeContainer(void);

 public:

    void increase(unsigned size);
    void decrease(unsigned size);

 public:

    unsigned getMaxSize(void) const;

 private:

    std::map<unsigned, unsigned> m_container;

};
