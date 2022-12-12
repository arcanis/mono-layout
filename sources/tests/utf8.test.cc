#include "./framework.hh"

TEST_CASE("it should read graphemes as one")
{
    SETUP("🇫🇷");

    ASSERT_EQ(LINE_COUNT(), 1);
    ASSERT_EQ(LINE_SLICE(0, 0, 1), "🇫🇷");
}

TEST_CASE("it should read grapheme clusters as one")
{
    SETUP("Z̸̞̯̫̬̠̻̲̹̦̖͌̈́̿͒́̈́͛͘͠ạ̶̢͕̺̿̈́̑̈̅̎̈́͌l̵̡̮͉̯͉̘̘̯̖͍̫̖̗͖̩͈͑̄͂̓͗̾̆g̵̛͙̪͙͔͋̊́̉͌̾͌̃́̅̔̊͝o̵̭̗̮̬̪̫̗̊̈́̾̀̏̆̈́");

    ASSERT_EQ(LINE_COUNT(), 1);
    ASSERT_EQ(LINE_SLICE(0, 0, 1), "Z̸̞̯̫̬̠̻̲̹̦̖͌̈́̿͒́̈́͛͘͠");
}
