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
    layout.setSoftWrap(true);
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

TEST_CASE("stress test #4")
{
    SETUP("");

    layout.setColumns(10);
    layout.setSoftWrap(true);
    layout.setCollapseWhitespaces(true);
    layout.setPreserveTrailingSpaces(true);
    layout.setJustifyText(true);
    RESET();

    auto currentPosition = Position(0, 0);

    FOR(c, "a b c d e f g h i j k l m n o p q r s t u v w x y z\nA B C D E F G H I J K L M N O P Q R S T U V W X Y Z") {
        auto characterIndex = layout.getCharacterIndexForPosition(currentPosition);
        SPLICE(characterIndex, 0, c);
        currentPosition = layout.getPositionForCharacterIndex(characterIndex + 1);
    }

    REQUIRE(LINE_COUNT() == 12);
    REQUIRE(TEXT() == "a  b c d e\nf  g h i j\nk  l m n o\np  q r s t\nu  v w x y\nz\nA  B C D E\nF  G H I J\nK  L M N O\nP  Q R S T\nU  V W X Y\nZ");
}
