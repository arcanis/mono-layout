SHELL		= bash

TARGET		= libtformat.a

SRC			= $(shell find sources -name '*.cc' -not -name 'embind.cc' -not -path 'sources/tests/*') uni-algo/src/data.cpp
TESTS		= $(shell find sources -name '*.cc' -not -name 'embind.cc') uni-algo/src/data.cpp

OBJ_SRC		= $(SRC:=.o)
OBJ_TESTS	= $(TESTS:=.o)

DEPS		= $(SRC:=.d) $(TESTS:=.d)

RM			= rm -f
CXX			?= clang++

CXXFLAGS	= -std=c++17 -W -Wall -Werror -MMD -Isources/tests -Iuni-algo/include
EMFLAGS		= -flto --bind

NODEPS		= clean fclean
.PHONY		: all clean fclean re test

EMFLAGS		+= 									\
	-s WASM=1									\
	-s USE_ES6_IMPORT_META=0 					\
	-s ASSERTIONS=0 							\
	-s ALLOW_MEMORY_GROWTH=1 					\
	-s DYNAMIC_EXECUTION=0 						\
	-s TEXTDECODER=0 							\
	-s MODULARIZE=1 							\
	-s ERROR_ON_UNDEFINED_SYMBOLS=0 			\
	-s FILESYSTEM=0 							\
	-s ENVIRONMENT=web							\
	-s MALLOC="emmalloc" 						\
	-s INCOMING_MODULE_JS_API=['wasmBinary'] 	\
	-s EXPORT_NAME="monoLayout"

ifeq ($(DEBUG),1)
CXXFLAGS	+= -g -O0
CPPFLAGS	+= -DDEBUG
else
CXXFLAGS	+= -O3
endif

all: $(TARGET)

ifeq (0, $(words $(findstring $(MAKECMDGOALS), $(NODEPS))))
-include $(DEPS)
endif

clean:
	$(RM) $(shell find . -name '*.o')
	$(RM) $(shell find . -name '*.d')

wasm: $(SRC)
	mkdir -p lib
	em++ $(CXXFLAGS) $(CPPFLAGS) $(EMFLAGS) -s BINARYEN_ASYNC_COMPILATION=0 $(WASM_FLAGS) -o lib/mono-layout-sync.js $(SRC) sources/embind.cc
	em++ $(CXXFLAGS) $(CPPFLAGS) $(EMFLAGS) -s BINARYEN_ASYNC_COMPILATION=1 $(WASM_FLAGS) -o lib/mono-layout-async.js $(SRC) sources/embind.cc
	cp lib/mono-layout-sync.wasm lib/mono-layout.wasm
	rm lib/mono-layout-sync.wasm lib/mono-layout-async.wasm

fclean: clean
	$(RM) $(TARGET)

re:	clean
	$(MAKE) all

%.cc.o: %.cc
	${CXX} ${CPPFLAGS} ${CXXFLAGS} -c -o $@ $<

%.cpp.o: %.cpp
	${CXX} ${CPPFLAGS} ${CXXFLAGS} -c -o $@ $<

$(TARGET): $(OBJ_SRC)
	ar r $(TARGET) $(OBJ_SRC)
	ranlib $(TARGET)

test: $(OBJ_TESTS)
	$(CXX) $(CXXFLAGS) $(CPPFLAGS) -o /tmp/testsuite $(OBJ_TESTS)
	/tmp/testsuite

.PHONY: all clean wasm fclean re test
