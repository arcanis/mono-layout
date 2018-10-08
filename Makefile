SHELL		= bash

TARGET		= libtformat.a

SRC		= $(shell find sources -name '*.cc' -a -not -name '*.test.cc' -a -not -name 'embind.cc')
TESTS		= $(shell find sources -name '*.test.cc' -a -not -name 'nbind.cc')

OBJ_SRC		= $(SRC:%.cc=%.o)
OBJ_TESTS	= $(TESTS:%.cc=%.o)

DEPS		= $(SRC:%.cc=%.d) $(TESTS:%.cc=%.d)

RM		= rm -f
CXX		?= clang++

CXXFLAGS	= -std=c++14 -W -Wall -Werror -MMD -Isources/tests
EMFLAGS		= --llvm-opts 3 --llvm-lto 1 -s SINGLE_FILE=1 -s ALLOW_MEMORY_GROWTH=1 --bind --pre-js ./sources/shell.pre.js --post-js ./sources/shell.post.js

NODEPS		= clean fclean
.PHONY		: all clean fclean re test

ifeq (0, $(words $(findstring $(MAKECMDGOALS), $(NODEPS))))
-include $(DEPS)
endif

ifeq ($(DEBUG),1)
CXXFLAGS	+= -g -O0
CPPFLAGS	+= -DDEBUG
endif

all:		$(TARGET)

clean:
		$(RM) $(shell find . -name '*.o')
		$(RM) $(shell find . -name '*.d')

webassembly:	$(SRC)
		mkdir -p lib
		source ~/emsdk-portable/emsdk_env.sh; \
		em++ $(CXXFLAGS) $(CPPFLAGS) $(EMFLAGS) -s BINARYEN_ASYNC_COMPILATION=1 -o lib/text-layout.js $(SRC) sources/embind.cc; \
		em++ $(CXXFLAGS) $(CPPFLAGS) $(EMFLAGS) -s BINARYEN_ASYNC_COMPILATION=0 -o lib/text-layout-sync.js $(SRC) sources/embind.cc; \

fclean:		clean
		$(RM) $(TARGET)

re:		clean
		$(MAKE) all

test:		$(OBJ_SRC) $(OBJ_TESTS)
		$(CXX) $(CXXFLAGS) $(CPPFLAGS) -o /tmp/testsuite $(OBJ_SRC) $(OBJ_TESTS)
		/tmp/testsuite

$(TARGET):	$(OBJ_SRC)
		ar r $(TARGET) $(OBJ_SRC)
		ranlib $(TARGET)

.PHONY:		all clean webassembly fclean re test
