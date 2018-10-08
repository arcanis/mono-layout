#include "./framework.hh"

TEST_CASE("it should have a single empty line when parsing an empty string")
{
    SETUP("");

    ASSERT_EQ(LINE_COUNT(), 1);
    ASSERT_EQ(TEXT(), "");
}

TEST_CASE("it should correctly parse a single line")
{
    SETUP("Hello World");

    ASSERT_EQ(LINE_COUNT(), 1);
    ASSERT_EQ(TEXT(), "Hello World");
}

TEST_CASE("it should correctly parse multiple lines")
{
    SETUP("Hello\nWorld");

    ASSERT_EQ(LINE_COUNT(), 2);
    ASSERT_EQ(TEXT(), "Hello\nWorld");
}

TEST_CASE("it should support ending a text with a newline character")
{
    SETUP("Hello World\n");

    ASSERT_EQ(LINE_COUNT(), 2);
    ASSERT_EQ(TEXT(), "Hello World\n");
}

TEST_CASE("it should correctly normalize characters")
{
    SETUP("Hello\tWorld\nThis is a\rtest.");

    ASSERT_EQ(LINE_COUNT(), 3);
    ASSERT_EQ(TEXT(), "Hello    World\nThis is a\ntest.");
}

TEST_CASE("it should correctly wrap text")
{
    SETUP("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

    layout.setColumns(4);
    layout.setSoftWrap(true);
    RESET();

    ASSERT_EQ(LINE_COUNT(), 7);
    ASSERT_EQ(TEXT(), "ABCD\nEFGH\nIJKL\nMNOP\nQRST\nUVWX\nYZ");
}

TEST_CASE("it should avoid breaking words unless allowed to")
{
    SETUP("Horse Tiger Snake Zebra Mouse Sheep Whale Panda");

    layout.setColumns(8);
    layout.setSoftWrap(true);
    RESET();

    ASSERT_EQ(LINE_COUNT(), 8);
    ASSERT_EQ(TEXT(), "Horse\nTiger\nSnake\nZebra\nMouse\nSheep\nWhale\nPanda");

    layout.setAllowWordBreaks(true);
    RESET();

    ASSERT_EQ(LINE_COUNT(), 6);
    ASSERT_EQ(TEXT(), "Horse Ti\nger Snak\ne Zebra\nMouse Sh\neep Whal\ne Panda");
}

TEST_CASE("it should collapse whitespaces if requested")
{
    SETUP("Hello     world     \t   test!");

    layout.setCollapseWhitespaces(true);
    RESET();

    ASSERT_EQ(TEXT(), "Hello world test!");
}

TEST_CASE("it should justify the text if requested")
{
    SETUP("Horse Tiger Snake Zebra Mouse Sheep Whale Panda");

    layout.setColumns(14);
    layout.setSoftWrap(true);
    layout.setCollapseWhitespaces(true);
    layout.setJustifyText(true);
    RESET();

    ASSERT_EQ(TEXT(), "Horse    Tiger\nSnake    Zebra\nMouse    Sheep\nWhale Panda");
}

TEST_CASE("it should support updating a single line")
{
    SETUP("Hello World\nThis is a test");
    SPLICE(6, 5, "Toto");

    ASSERT_EQ(TEXT(), "Hello Toto\nThis is a test");
}

TEST_CASE("it should support updating multiple lines")
{
    SETUP("Horse\nTiger\nSnake\nZebra\nMouse\nSheep\nWhale\nPanda");
    SPLICE(7, 9, "atou\nSwin");

    ASSERT_EQ(TEXT(), "Horse\nTatou\nSwine\nZebra\nMouse\nSheep\nWhale\nPanda");
}

TEST_CASE("it should support adding new lines when updating")
{
    SETUP("Horse\nTiger\nSnake\nZebra\nMouse\nSheep\nWhale\nPanda");
    SPLICE(7, 9, "iger\nTatoo\nSwine\nSnak");

    ASSERT_EQ(TEXT(), "Horse\nTiger\nTatoo\nSwine\nSnake\nZebra\nMouse\nSheep\nWhale\nPanda");
}

TEST_CASE("it should support removing lines when updating")
{
    SETUP("Horse\nTiger\nSnake\nZebra\nMouse\nSheep\nWhale\nPanda");
    SPLICE(13, 18, "");

    ASSERT_EQ(TEXT(), "Horse\nTiger\nSheep\nWhale\nPanda");
}

TEST_CASE("it should support removing the last newline character")
{
    SETUP("Hello World\n");
    SPLICE(11, 1, "");

    ASSERT_EQ(TEXT(), "Hello World");
}

TEST_CASE("it should support removing a newline character among many")
{
    SETUP("Hello World\n\n\n");
    SPLICE(12, 1, "");

    ASSERT_EQ(TEXT(), "Hello World\n\n");
}

TEST_CASE("it should not delete the last newline when removing the only character that immediatly follows it")
{
    SETUP("Hello World\n!");
    SPLICE(12, 1, "");

    ASSERT_EQ(TEXT(), "Hello World\n");
}
