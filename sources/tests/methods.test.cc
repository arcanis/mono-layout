#include "./framework.hh"

TEST_CASE("#positionForCharacterIndex()")
{
    SECTION("it should return the right position for a given character index inside the original text")
    {
        SETUP("Hello World\nFoo Bar!");

        ASSERT_EQ(layout.getPositionForCharacterIndex(4), Position(4, 0));
        ASSERT_EQ(layout.getPositionForCharacterIndex(15), Position(3, 1));
    }

    SECTION("it should work even when the first characters are skipped")
    {
        SETUP("    Hello World!");

        ASSERT_EQ(layout.getPositionForCharacterIndex(5), Position(1, 0));
    }

    SECTION("it should work even for the last character")
    {
        SETUP("Hello World");

        ASSERT_EQ(layout.getPositionForCharacterIndex(11), Position(11, 0));
    }
}

TEST_CASE("#getPositionLeft()")
{
    SECTION("it should be able to move inside subdividable tokens")
    {
        SETUP("Hello");

        ASSERT_EQ(layout.getPositionLeft(Position(3, 0)), PositionRet(2, 0, true));
    }

    SECTION("it should jump over tokens that can't be subdivided")
    {
        SETUP("Hello\tWorld");

        ASSERT_EQ(layout.getPositionLeft(Position(9, 0)), PositionRet(5, 0, true));
    }

    SECTION("should jump to the end of the previous line when already on the left edge of a line")
    {
        SETUP("Hello World\nThis is a test");

        ASSERT_EQ(layout.getPositionLeft(Position(0, 1)), PositionRet(11, 0, true));
    }

    SECTION("shouldn't do anything when already on the topmost position")
    {
        SETUP("Hello World");

        ASSERT_EQ(layout.getPositionLeft(Position(0, 0)), PositionRet(0, 0, true));
    }
}

TEST_CASE("#getPositionRight()")
{
    SECTION("it should be able to move inside subdividable tokens")
    {
        SETUP("Hello");

        ASSERT_EQ(layout.getPositionRight(Position(2, 0)), PositionRet(3, 0, true));
    }

    SECTION("it should jump over tokens that can't be subdivided")
    {
        SETUP("Hello\tWorld");

        ASSERT_EQ(layout.getPositionRight(Position(5, 0)), PositionRet(9, 0, true));
    }

    SECTION("should jump to the beginning of the next line when already on the right edge of a line")
    {
        SETUP("Hello World\nThis is a test");

        ASSERT_EQ(layout.getPositionRight(Position(11, 0)), PositionRet(0, 1, true));
    }

    SECTION("shouldn't do anything when already on the lowest position")
    {
        SETUP("Hello World");

        ASSERT_EQ(layout.getPositionRight(Position(11, 0)), PositionRet(11, 0, true));
    }
}

TEST_CASE("#getPositionAbove()")
{
    SECTION("it should be able to move a cursor inside subdividable tokens")
    {
        SETUP("Hello\nWorld");

        ASSERT_EQ(layout.getPositionAbove(Position(2, 1), 1), PositionRet(2, 0, true));
    }

    SECTION("it should prevent jumping inside tokens that cannot be subdivided")
    {
        SETUP("Hello\tWorld\nThis is a test");

        ASSERT_EQ(layout.getPositionAbove(Position(6, 1), 1), PositionRet(5, 0, true));
        ASSERT_EQ(layout.getPositionAbove(Position(8, 1), 1), PositionRet(9, 0, true));
    }

    SECTION("it should move to the beginning of the line when already on the very first line")
    {
        SETUP("Hello World");

        ASSERT_EQ(layout.getPositionAbove(Position(5, 0), 1), PositionRet(0, 0, true));
    }

    SECTION("it should move to the end of the line when we would jump outside")
    {
        SETUP("Hello\nThis is a test\nWorld");

        ASSERT_EQ(layout.getPositionAbove(Position(10, 1)), PositionRet(5, 0, false));
    }
}

TEST_CASE("#getPositionBelow()")
{
    SECTION("it should be able to move a cursor inside subdividable tokens")
    {
        SETUP("Hello\nWorld");

        ASSERT_EQ(layout.getPositionBelow(Position(2, 0), 1), PositionRet(2, 1, true));
    }

    SECTION("it should prevent jumping inside tokens that cannot be subdivided")
    {
        SETUP("This is a test\nHello\tWorld");

        ASSERT_EQ(layout.getPositionBelow(Position(6, 0), 1), PositionRet(5, 1, true));
        ASSERT_EQ(layout.getPositionBelow(Position(8, 0), 1), PositionRet(9, 1, true));
    }

    SECTION("it should move to the end of the line when already on the very last line")
    {
        SETUP("Hello World");

        ASSERT_EQ(layout.getPositionBelow(Position(5, 0), 1), PositionRet(11, 0, true));
    }

    SECTION("it should move to the end of the line when we would jump outside")
    {
        SETUP("Hello\nThis is a test\nWorld");

        ASSERT_EQ(layout.getPositionBelow(Position(10, 1)), PositionRet(5, 2, false));
    }
}

TEST_CASE("#getRowCount()")
{
    SECTION("it should return the right number of rows in the document")
    {
        SETUP("Hello World\nThis is a test\nFoo Bar\n");

        ASSERT_EQ(layout.getRowCount(), 4);
    }

    SECTION("it should also count soft-wrapped lines")
    {
        SETUP("Horse Tiger Snake Zebra Mouse Sheep Whale Panda");

        layout.setColumns(8);
        layout.setSoftWrap(true);
        RESET();

        ASSERT_EQ(layout.getRowCount(), 8);
    }
}

TEST_CASE("#getColumnCount()")
{
    SECTION("it should return 0 on an uninitialized buffer")
    {
        SETUP_EMPTY();

        ASSERT_EQ(layout.getColumnCount(), 0);
    }

    SECTION("it should return the maximal number of columns in the document")
    {
        SETUP("This is a test\nHello World\nSanctus Dominus Infernus\n");

        ASSERT_EQ(layout.getColumnCount(), 24);
    }

    SECTION("it should be correctly set when the layout has a maximal number of column lower than needed")
    {
        SETUP("Horse Tiger Snake Zebra Mouse Sheep Whale Panda");

        layout.setColumns(8);
        layout.setSoftWrap(true);
        RESET();

        ASSERT_EQ(layout.getColumnCount(), 5);
    }

    SECTION("it should be correctly updated when the layout options are updated")
    {
        SETUP("Horse Tiger Snake Zebra Mouse Sheep Whale Panda");

        layout.setColumns(8);
        layout.setSoftWrap(true);
        RESET();

        ASSERT_EQ(layout.getColumnCount(), 5);

        layout.setAllowWordBreaks(true);
        RESET();

        ASSERT_EQ(layout.getColumnCount(), 8);
    }

    SECTION("it should be correctly updated when lines are removed")
    {
        SETUP("This is a test\nHello World\nSanctus Dominus Infernus\n");

        SPLICE(27, 24, "");

        ASSERT_EQ(layout.getColumnCount(), 14);
    }

    SECTION("it should be correctly updated when lines are added")
    {
        SETUP("This is a test\nHello World\nSanctus Dominus Infernus\n");

        SPLICE(27, 0, "Space 1992: Rise of the Chaos Wizards\n");

        ASSERT_EQ(layout.getColumnCount(), 37);
    }

    SECTION("it should be correctly updated when lines are expanded")
    {
        SETUP("This is a test\nHello World\nSanctus Dominus Infernus\n");

        SPLICE(15, 0, "As Foobar Sayed: ");

        ASSERT_EQ(layout.getColumnCount(), 28);
    }

    SECTION("it should be correctly updated when lines are shrinked")
    {
        SETUP("This is a test\nHello World\nSanctus Dominus Infernus\n");

        SPLICE(27, 16, "");

        ASSERT_EQ(layout.getColumnCount(), 14);
    }
}

TEST_CASE("#getSoftWrapCount()")
{
    SECTION("it should return the number of soft-wrap-generated lines accross the text")
    {
        SETUP("Horse Tiger Snake Zebra Mouse Sheep Whale Panda");

        layout.setColumns(8);
        layout.setSoftWrap(true);
        RESET();

        ASSERT_EQ(layout.getSoftWrapCount(), 7);
    }

    SECTION("it shouldn't count the last line as being soft-wrapped, even when being as large as the maximal size")
    {
        SETUP("Horse Tiger Snake Zebra Mouse Sheep Whale Panda");

        layout.setColumns(5);
        layout.setSoftWrap(true);
        RESET();

        ASSERT_EQ(layout.getSoftWrapCount(), 7);
    }
}
