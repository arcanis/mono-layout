#include "./framework.hh"

TEST_CASE("stress test #1")
{
    SETUP("");

    for (auto t = 0u; t < 30; ++t)
        APPEND("Foo\n");

    REQUIRE(LINE_COUNT() == 31);
    REQUIRE(TEXT() == "Foo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\nFoo\n");
}

TEST_CASE("stress test #2")
{
    SETUP("");

    for (auto t = 0u; t < 30; ++t) {
        APPEND("a");
        APPEND(" ");
    }

    REQUIRE(LINE_COUNT() == 1);
    REQUIRE(TEXT() == "a a a a a a a a a a a a a a a a a a a a a a a a a a a a a a");
}

TEST_CASE("stress test #3")
{
    SETUP("");

    layout.setColumns(10);
    layout.setCollapseWhitespaces(true);
    layout.setJustifyText(true);
    RESET();

    for (auto t = 0u; t < 30; ++t) {
        APPEND("a");
        APPEND(" ");
    }

    REQUIRE(LINE_COUNT() == 6);
    REQUIRE(TEXT() == "a  a a a a\na  a a a a\na  a a a a\na  a a a a\na  a a a a\na a a a a");
}
