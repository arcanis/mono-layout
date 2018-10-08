// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
let setup = false;

module.exports = (readyCallback) => {
  if (setup) return Module;
  setup = true;

  Module.onRuntimeInitialized = () => {
    Module.applyPatch = (textLayout, patch, targetArray) => {
      if (!patch)
        return;

      const strings = [];

      for (let t = 0, T = patch.addedLineCount; t < T; ++t)
        strings.push(textLayout.getLine(patch.startingRow + t));

      targetArray.splice(patch.startingRow, patch.deletedLineCount, ... strings);
    };

    Module.TextLayout.prototype.setConfiguration = function (config) {
      let mustUpdate = false;

      for (const key of Object.keys(config)) {
        const setter = `set${key.charAt(0).toUpperCase()}${key.substr(1)}`;

        if (!this[setter])
          throw new Error(`Invalid configuration option "${key}"`);

        if (this[setter](config[key])) {
          mustUpdate = true;
        }
      }

      return mustUpdate ? this.reset() : null;
    };

    Module.TextLayout.prototype[Symbol.iterator] = function* () {
      for (let t = 0, T = this.getRowCount(); t < T; ++t) {
        yield this.getLine(t);
      }
    };

    if (readyCallback) {
      readyCallback(Module);
    }
  };



// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';

  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
    ret = tryParseAsDataURI(filename);
    if (!ret) {
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    }
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    err('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WEB) {
    if (document.currentScript) {
      scriptDirectory = document.currentScript.src;
    }
  } else { // worker
    scriptDirectory = self.location.href;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }


  Module['read'] = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  assert(STATICTOP < TOTAL_MEMORY, 'not enough memory for static allocation - increase TOTAL_MEMORY');
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    err('warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but is required for the LLVM wasm backend, so it is recommended for full portability.');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;


// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};


// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  function convertReturnValue(ret) {
    if (returnType === 'string') return Pointer_stringify(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

if (!Module['reallocBuffer']) Module['reallocBuffer'] = function(size) {
  var ret;
  try {
    var oldHEAP8 = HEAP8;
    ret = new ArrayBuffer(size);
    var temp = new Int8Array(ret);
    temp.set(oldHEAP8);
  } catch(e) {
    return false;
  }
  var success = _emscripten_replace_memory(ret);
  if (!success) return false;
  return ret;
};

function enlargeMemory() {
  // TOTAL_MEMORY is the current size of the actual array, and DYNAMICTOP is the new top.
  assert(HEAP32[DYNAMICTOP_PTR>>2] > TOTAL_MEMORY); // This function should only ever be called after the ceiling of the dynamic heap has already been bumped to exceed the current total size of the asm.js heap.


  var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
  var LIMIT = 2147483648 - PAGE_MULTIPLE; // We can do one page short of 2GB as theoretical maximum.

  if (HEAP32[DYNAMICTOP_PTR>>2] > LIMIT) {
    err('Cannot enlarge memory, asked to go up to ' + HEAP32[DYNAMICTOP_PTR>>2] + ' bytes, but the limit is ' + LIMIT + ' bytes!');
    return false;
  }

  var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
  TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY); // So the loop below will not be infinite, and minimum asm.js memory size is 16MB.

  while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR>>2]) { // Keep incrementing the heap size as long as it's less than what is requested.
    if (TOTAL_MEMORY <= 536870912) {
      TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE); // Simple heuristic: double until 1GB...
    } else {
      // ..., but after that, add smaller increments towards 2GB, which we cannot reach
      TOTAL_MEMORY = Math.min(alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
      if (TOTAL_MEMORY === OLD_TOTAL_MEMORY) {
        warnOnce('Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only ' + TOTAL_MEMORY);
      }
    }
  }


  var start = Date.now();

  var replacement = Module['reallocBuffer'](TOTAL_MEMORY);
  if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
    err('Failed to grow the heap from ' + OLD_TOTAL_MEMORY + ' bytes to ' + TOTAL_MEMORY + ' bytes, not enough memory!');
    if (replacement) {
      err('Expected to get back a buffer of size ' + TOTAL_MEMORY + ' bytes, but instead got back a buffer of size ' + replacement.byteLength);
    }
    // restore the state to before this call, we failed
    TOTAL_MEMORY = OLD_TOTAL_MEMORY;
    return false;
  }

  // everything worked

  updateGlobalBuffer(replacement);
  updateGlobalBufferViews();

  if (!Module["usingWasm"]) {
    err('Warning: Enlarging memory arrays, this is not fast! ' + [OLD_TOTAL_MEMORY, TOTAL_MEMORY]);
  }


  return true;
}

var byteLength;
try {
  byteLength = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get);
  byteLength(new ArrayBuffer(4)); // can fail on older ie
} catch(e) { // can fail on older node/v8
  byteLength = function(buffer) { return buffer.byteLength; };
}

var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
    assert(TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
    Module['wasmMemory'] = new WebAssembly.Memory({ 'initial': TOTAL_MEMORY / WASM_PAGE_SIZE });
    buffer = Module['wasmMemory'].buffer;
  } else
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




function integrateWasmJS() {
  // wasm.js has several methods for creating the compiled code module here:
  //  * 'native-wasm' : use native WebAssembly support in the browser
  //  * 'interpret-s-expr': load s-expression code from a .wast and interpret
  //  * 'interpret-binary': load binary wasm and interpret
  //  * 'interpret-asm2wasm': load asm.js code, translate to wasm, and interpret
  //  * 'asmjs': no wasm, just load the asm.js code and use that (good for testing)
  // The method is set at compile time (BINARYEN_METHOD)
  // The method can be a comma-separated list, in which case, we will try the
  // options one by one. Some of them can fail gracefully, and then we can try
  // the next.

  // inputs

  var method = 'native-wasm';

  var wasmTextFile = '';
  var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABsAEXYAABf2ABfwF/YAJ/fwF/YAJ/fwBgA39/fwBgBH9/f38AYAV/f39/fwBgA39/fwF/YAAAYAZ/f39/f38AYAR/f39/AX9gBX9/f39/AX9gAX8AYA1/f39/f39/f39/f39/AGAIf39/f39/f38AYAp/f39/f39/f39/AGADfn9/AX9gAn5/AX9gBn98f39/fwF/YAF8AX5gAnx/AXxgBn9/f39/fwF/YAd/f39/f39/AAKmCz0DZW52Bm1lbW9yeQIAgAIDZW52BXRhYmxlAXABoAygDANlbnYKbWVtb3J5QmFzZQN/AANlbnYJdGFibGVCYXNlA38AA2Vudg5EWU5BTUlDVE9QX1BUUgN/AANlbnYNdGVtcERvdWJsZVB0cgN/AANlbnYIU1RBQ0tUT1ADfwADZW52CVNUQUNLX01BWAN/AAZnbG9iYWwDTmFOA3wABmdsb2JhbAhJbmZpbml0eQN8AANlbnYNZW5sYXJnZU1lbW9yeQAAA2Vudg5nZXRUb3RhbE1lbW9yeQAAA2VudhdhYm9ydE9uQ2Fubm90R3Jvd01lbW9yeQAAA2VudhJhYm9ydFN0YWNrT3ZlcmZsb3cADANlbnYKbnVsbEZ1bmNfaQAMA2VudgtudWxsRnVuY19paQAMA2VudgxudWxsRnVuY19paWkADANlbnYNbnVsbEZ1bmNfaWlpaQAMA2Vudg5udWxsRnVuY19paWlpaQAMA2Vudg9udWxsRnVuY19paWlpaWkADANlbnYKbnVsbEZ1bmNfdgAMA2VudgtudWxsRnVuY192aQAMA2VudgxudWxsRnVuY192aWkADANlbnYNbnVsbEZ1bmNfdmlpaQAMA2Vudg5udWxsRnVuY192aWlpaQAMA2Vudg9udWxsRnVuY192aWlpaWkADANlbnYQbnVsbEZ1bmNfdmlpaWlpaQAMA2Vudg5fX19hc3NlcnRfZmFpbAAFA2VudhlfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uAAEDZW52El9fX2N4YV9iZWdpbl9jYXRjaAABA2VudgxfX19jeGFfdGhyb3cABANlbnYHX19fbG9jawAMA2VudgtfX19zZXRFcnJObwAMA2Vudg1fX19zeXNjYWxsMTQwAAIDZW52DV9fX3N5c2NhbGwxNDYAAgNlbnYMX19fc3lzY2FsbDU0AAIDZW52C19fX3N5c2NhbGw2AAIDZW52CV9fX3VubG9jawAMA2Vudh5fX2VtYmluZF9maW5hbGl6ZV92YWx1ZV9vYmplY3QADANlbnYWX19lbWJpbmRfcmVnaXN0ZXJfYm9vbAAGA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9jbGFzcwANA2VudiNfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jb25zdHJ1Y3RvcgAJA2VudiBfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgAOA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9lbXZhbAADA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9mbG9hdAAEA2VudhlfX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAYDZW52HV9fZW1iaW5kX3JlZ2lzdGVyX21lbW9yeV92aWV3AAQDZW52HF9fZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmcAAwNlbnYdX19lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcABANlbnYeX19lbWJpbmRfcmVnaXN0ZXJfdmFsdWVfb2JqZWN0AAkDZW52JF9fZW1iaW5kX3JlZ2lzdGVyX3ZhbHVlX29iamVjdF9maWVsZAAPA2VudhZfX2VtYmluZF9yZWdpc3Rlcl92b2lkAAMDZW52Dl9fZW12YWxfZGVjcmVmAAwDZW52Dl9fZW12YWxfaW5jcmVmAAwDZW52El9fZW12YWxfdGFrZV92YWx1ZQACA2VudgZfYWJvcnQACANlbnYWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwAHA2VudhRfcHRocmVhZF9nZXRzcGVjaWZpYwABA2VudhNfcHRocmVhZF9rZXlfY3JlYXRlAAIDZW52DV9wdGhyZWFkX29uY2UAAgNlbnYUX3B0aHJlYWRfc2V0c3BlY2lmaWMAAgOzA7EDAQEADAMDDAAMAwIDAQwMAwoDBQcBAwwMDAUEAgcDAwEMAwQMBAwMDAwMDAwMAwMDBAMEAQEBAQEBAQEBAgEBAgICAgICAgIBAQMEAwICAQMCBAcGBwQEAgQFBQIHBwIEDAcHBwcCAwYDDAwDAwwCAwIDAgMDDAQFBAUCBQQHDAQCDAIDAwMDBQMDDAMMBAEMBQwICAgICAMICAMIAQwBAAECAQIBBwEHAQIBBwECAQIBBwEHAQoBBwEHAQcBAgEHAQsBAQMBAwEBAQEBAQEBDAECBAAMAQIEAAwBDAEAAwEEBAEFAQECBAEHBwEKAQEBDAMMDAMBAwEBAQQEAwMBDAgICAgICAgICAgICAgICAwMDAwMDAgICAgIAQEMAQcHAQABBwIBAwsABAEEEBERAQIGAhITFBQCAgICBwIEAQEBAAgIAQEIBwEMAwEDCAgDBAMCBQwCBwcODAIFAgcBAwgICAADDAwMDAcJBgUCBAQFAgwJBgUIDAgMAAwMAQEMAQwMBwwHAgwJBgUFCQYABwEIAQcHBwEBAgcKCxUMAwQFBgkWAAECBwoLCAwDBAUGCQZoEn8BIwILfwEjAwt/ASMEC38BIwULfwFBAAt/AUEAC38BQQALfwFBAAt8ASMGC3wBIwcLfwFBAAt/AUEAC38BQQALfwFBAAt8AUQAAAAAAAAAAAt/AUEAC30BQwAAAAALfQFDAAAAAAsHwAQkEF9fZ3Jvd1dhc21NZW1vcnkAMxhfX0dMT0JBTF9fc3ViX0lfYmluZF9jcHAAswIZX19HTE9CQUxfX3N1Yl9JX2VtYmluZF9jYwDFARBfX19jeGFfY2FuX2NhdGNoAMIDFl9fX2N4YV9pc19wb2ludGVyX3R5cGUAwwMRX19fZXJybm9fbG9jYXRpb24A1AIOX19fZ2V0VHlwZU5hbWUAzQIHX2ZmbHVzaAD3AgVfZnJlZQDPAg9fbGx2bV9ic3dhcF9pMzIAxQMHX21hbGxvYwDOAgdfbWVtY3B5AMYDCF9tZW1tb3ZlAMcDB19tZW1zZXQAyAMFX3NicmsAyQMJZHluQ2FsbF9pAMoDCmR5bkNhbGxfaWkAywMLZHluQ2FsbF9paWkAzAMMZHluQ2FsbF9paWlpAM0DDWR5bkNhbGxfaWlpaWkAzgMOZHluQ2FsbF9paWlpaWkAzwMJZHluQ2FsbF92ANADCmR5bkNhbGxfdmkA0QMLZHluQ2FsbF92aWkA0gMMZHluQ2FsbF92aWlpANMDDWR5bkNhbGxfdmlpaWkA1AMOZHluQ2FsbF92aWlpaWkA1QMPZHluQ2FsbF92aWlpaWlpANYDE2VzdGFibGlzaFN0YWNrU3BhY2UANwtnZXRUZW1wUmV0MAA6C3J1blBvc3RTZXRzAMQDC3NldFRlbXBSZXQwADkIc2V0VGhyZXcAOApzdGFja0FsbG9jADQMc3RhY2tSZXN0b3JlADYJc3RhY2tTYXZlADUJrhgBACMBC6AM1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD0gHXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wOQAtcD1wPXA9cD1wPXA9cD1wPXA9cDiwLXA9cD1wOGAtcD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9cD1wPXA9gD0ALYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2AOwA9gD2APYA9gD2APYA9gD2APYA88B2APRAdgDZtgDZ2jYA2lqa2xtbtgD2APYA9gD2APYA9gD2APYA9gD2AN6cHF72APYA9gD2APYA4EB2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2AONAtgDjwLYA9gD2APYA9gDlwLYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9gD2APYA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPUAdkD2QPWAdkD2QPZA9kD2QPZA2/ZA3Jz2QN0dXZ3eHnZA9kD2QPZA9kD3AHZA3/ZA9kD4AHZA+IBgwHZA9kD2QPZA9kD2QPZA9kDjgHZA5EB2QPZA5gB2QPZA/AB2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QOZAtkD2QPZA9kD2QPZA4kC2QPZA9kDhALZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9kD2QPZA9oD2gPRAtIC1gLaA9oD2gPaA9oDnAPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gO2A9oDuAPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2AHaA9oD2gHaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD3gHaA9oD2gPaA9oD5AHaA+YB2gPaA9oD2gPaA9oD6gHaA9oD7AHaA+4B2gPaA9oD8gHaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA5wCnQLaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPaA9oD2gPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA+gB2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sDnwLbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD2wPbA9sD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD9AHcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA90D3QPdA90D3QOVA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QOpA90D3QPdA90D3QPdA90D3QPdA90D3QPdA90D3QPeA94D3gPeA94D3gOYA5kDmgObA94D3gPeA94DpQPeA94D3gOuA68D3gO0A7UD3gO3A94DugPeA94D3gPeA9AB3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94DjgLeA94D3gPeA94D3gPeA94D3gPeA94D3gPeA4wC3gPeA94DhwLeA94D3gOqA94D3gPeA94D3gPeA94D3gPeA94D3gPeA94D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98DfN8Dft8D3wPfA98DggHfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98DmQHfA98D3wPfA98D3wPfA98D3wORAt8D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPfA98D3wPgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+ADiAHgA4kBiwHgA+AD4APgA+AD4AOSAeAD4APgA+AD4APAAeAD4APgA+AD4APgA+AD4AOTApQC4APgA+ADmgLgA+AD4APgA+AD4AOKAuAD4APgA4UC4APgA+AD4APgA+AD4APgA+AD4APgA+AD4APgA+AD4QPhA+ED4QPhA+ED4QPhA+ED4QPhA+ED4QOfA+ED4QPhA6gD4QPhA+ED4QPhA+ED4QPhA+ED4QPhA70D4QPhA+ED4QPhA+ED4QPhA+ED4QPhA+ED4QPhA+ED4QPhA+ED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gAEhDiAOQQxqIQ8gDygCACEQIAwgEEkhESARRQRAICQgCxCAASESIBJBDGohEyATKAIAIRQgAiAUNgIADAMLICIgASACEIQBICJBDGohFSAVKAIAIRYgFkEUaiEXIBcsAAAhGCAYQQFxIRkgGUEYdEEYdUEARiEaIBoEQCAWQQxqIRsgGygCACEcIBZBEGohHSAdKAIAIR4gHkEBdiEfIB8gHGohICAMICBLISEgIQRAIB4gHGohIyACICM2AgAMBAUgAiAcNgIADAQLAAsLCwsgAikCACErIAAgKzcCACAqJAoPC+oDAix/AX4jCiEvIwpBEGokCiMKIwtOBEBBEBADCyAvISIgAUEsaiEpIAFBMGohKiAqKAIAISsgKSgCACEsICsgLGshLSAtQSxtQX9xIQQgLUEARiEFIAUEQEGUJUGnJUHKA0HRLRARCyACQQRqIQYgBigCACEHIAQgB0shCCAIRQRAQdQlQaclQcsDQdEtEBELIANBAEYhCQJAIAlFBEAgBEF/aiEKIAogB2shCyALIANJIQwgDARAIAYgCjYCACApIAoQgAEhDSANQQxqIQ4gDigCACEPIAIgDzYCAAwCCyAHIANqIRAgBiAQNgIAIAIoAgAhESARQQBGIRIgEkUEQCApIBAQgAEhEyATQQxqIRQgFCgCACEVIBEgFUkhFiAWRQRAICkgEBCAASEXIBdBDGohGCAYKAIAIRkgAiAZNgIADAMLICIgASACEIQBICJBDGohGiAaKAIAIRsgG0EUaiEcIBwsAAAhHSAdQQFxIR4gHkEYdEEYdUEARiEfIB8EQCAbQQxqISAgICgCACEhIBtBEGohIyAjKAIAISQgJEEBdiElICUgIWohJiARICZLIScgJwRAICQgIWohKCACICg2AgAMBAUgAiAhNgIADAQLAAsLCwsgAikCACEwIAAgMDcCACAvJAoPC74BARV/IwohFiAAQTBqIQ0gDSgCACEOIABBLGohDyAPKAIAIRAgDiAQRiERIBAhEiARBEBBlCVBpyVB/QNB4i0QEQsgDkFUaiETIBMoAgAhFCAOQVhqIQMgAygCACEEIAQgFGohBSAFIAFJIQYgBgRAQawmQaclQf4DQeItEBEFIBAgDiABEI8BIQcgByAORiEIIAchCSAJIBJrIQogCkEsbUF/cSELIAhBH3RBH3UhDCAL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AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBAgsCQCAARAAAAAAAAAAAYiEEIAQEQCAARAAAAAAAAPBDoiEUIBQgARDpAiEVIAEoAgAhBSAFQUBqIQYgFSESIAYhCAUgACESQQAhCAsgASAINgIAIBIhEQwDAAsACwJAIAAhEQwCAAsACwJAIBCnIQcgB0H/D3EhAiACQYJ4aiEDIAEgAzYCACAPQv////////+HgH+DIQ0gDUKAgICAgICA8D+EIQ4gDr8hEyATIRELCyARDwvPBAE2fyMKITcgAEEARiENAkAgDQRAQQEhAgUgAUGAAUkhGCAYBEAgAUH/AXEhIyAAICM6AABBASECDAILQZjQACgCACEuIC5BAEYhMSAxBEAgAUGAf3EhMiAyQYC/A0YhMyAzBEAgAUH/AXEhNCAAIDQ6AABBASECDAMFQbDQAEHUADYCAEF/IQIMAwsACyABQYAQSSEDIAMEQCABQQZ2IQQgBEHAAXIhBSAFQf8BcSEGIABBAWohByAAIAY6AAAgAUE/cSEIIAhBgAFyIQkgCUH/AXEhCiAHIAo6AABBAiECDAILIAFBgLADSSELIAFBgEBxIQwgDEGAwANGIQ4gCyAOciE1IDUEQCABQQx2IQ8gD0HgAXIhECAQQf8BcSERIABBAWohEiAAIBE6AAAgAUEGdiETIBNBP3EhFCAUQYABciEVIBVB/wFxIRYgAEECaiEXIBIgFjoAACABQT9xIRkgGUGAAXIhGiAaQf8BcSEbIBcgGzoAAEEDIQIMAgsgAUGAgHxqIRwgHEGAgMAASSEdIB0EQCABQRJ2IR4gHkHwAXIhHyAfQf8BcSEgIABBAWohISAAICA6AAAgAUEMdiEiICJBP3EhJCAkQYABciElICVB/wFxISYgAEECaiEnICEgJjoAACABQQZ2ISggKEE/cSEpIClBgAFyISogKkH/AXEhKyAAQQNqISwgJyArOgAAIAFBP3EhLSAtQYABciEvIC9B/wFxITAgLCAwOgAAQQQhAgwCBUGw0ABB1AA2AgBBfyECDAILAAsLIAIPC4sCARd/IwohGEEAIQQDQAJA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EKQDIQIgAkEARyEEIARBAXEhBSAFIQMLIAMPCwMAAQssACAAQf8BcUEYdCAAQQh1Qf8BcUEQdHIgAEEQdUH/AXFBCHRyIABBGHZyDwvkBAEEfyACQYDAAE4EQCAAIAEgAhAuDwsgACEDIAAgAmohBiAAQQNxIAFBA3FGBEADQAJAIABBA3FFBEAMAQsCQCACQQBGBEAgAw8LIAAgASwAADoAACAAQQFqIQAgAUEBaiEBIAJBAWshAgsMAQsLIAZBfHEhBCAEQcAAayEFA0ACQCAAIAVMRQRADAELAkAgACABKAIANgIAIABBBGogAUEEaigCADYCACAAQQhqIAFBCGooAgA2AgAgAEEMaiABQQxqKAIANgIAIABBEGogAUEQaigCADYCACAAQRRqIAFBFGooAgA2AgAgAEEYaiABQRhqKAIANgIAIABBHGogAUEcaigCADYCACAAQSBqIAFBIGooAgA2AgAgAEEkaiABQSRqKAIANgIAIABBKGogAUEoaigCADYCACAAQSxqIAFBLGooAgA2AgAgAEEwaiABQTBqKAIANgIAIABBNGogAUE0aigCADYCACAAQThqIAFBOGooAgA2AgAgAEE8aiABQTxqKAIANgIAIABBwABqIQAgAUHAAGohAQsMAQsLA0ACQCAAIARIRQRADAELAkAgACABKAIANgIAIABBBGohACABQQRqIQELDAELCwUgBkEEayEEA0ACQCAAIARIRQRADAELAkAgACABLAAAOgAAIABBAWogAUEBaiwAADoAACAAQQJqIAFBAmosAAA6AAAgAEEDaiABQQNqLAAAOgAAIABBBGohACABQQRqIQELDAELCwsDQAJAIAAgBkhFBEAMAQsCQCAAIAEsAAA6AAAgAEEBaiEAIAFBAWohAQsMAQsLIAMPC24BAX8gASAASCAAIAEgAmpIcQRAIAAhAyABIAJqIQEgACACaiEAA0ACQCACQQBKRQRADAELAkAgAEEBayEAIAFBAWshASACQQFrIQIgACABLAAAOgAACwwBCwsgAyEABSAAIAEgAhDGAxoLIAAPC/ECAQR/IAAgAmohAyABQf8BcSEBIAJBwwBOBEADQAJAIABBA3FBAEdFBEAMAQsCQCAAIAE6AAAgAEEBaiEACwwBCwsgA0F8cSEEIARBwABrIQUgASABQQh0ciABQRB0ciAB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cHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIGRvd24ASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBCbG9jayBkZXZpY2UgcmVxdWlyZWQATm8gc3VjaCBkZXZpY2UATm90IGEgZGlyZWN0b3J5AElzIGEgZGlyZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABEZXZpY2Ugbm90IGEgc3RyZWFtAE5vIGRhdGEgYXZhaWxhYmxlAERldmljZSB0aW1lb3V0AE91dCBvZiBzdHJlYW1zIHJlc291cmNlcwBMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UARmlsZSBkZXNjcmlwdG9yIGluIGJhZCBzdGF0ZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZv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AABtX2xpbmVzLnNpemUoKSA+IDAAc291cmNlcy9UZXh0TGF5b3V0LmNjAHJvdyA8IG1fbGluZXMuc2l6ZSgpAAoAcG9zaXRpb24ueSA8IG1fbGluZXMuc2l6ZSgpAGZpbmRUb2tlbkxvY2F0b3JGb3JQb3NpdGlvbgBwb3NpdGlvbi54IDw9IGxpbmUub3V0cHV0TGVuZ3RoAGNoYXJhY3RlckluZGV4IDw9IG1fbGluZXMuYmFjaygpLmlucHV0T2Zmc2V0ICsgbV9saW5lcy5iYWNrKCkuaW5wdXRMZW5ndGgAdG9rZW4uY2FuQmVTdWJkaXZpZGVkACAAY3VycmVudExpbmUub3V0cHV0TGVuZ3RoIDw9IGVmZmVjdGl2ZUNvbHVtbnMAb2Zmc2V0ID49IGN1cnJlbnRMaW5lLmlucHV0T2Zmc2V0ICsgY3VycmVudExpbmUuaW5wdXRMZW5ndGgAY3VycmVudExpbmUudG9rZW5zLnNpemUoKSA+IDAAYXBwbHkAYWxsb2NhdG9yPFQ+OjphbGxvY2F0ZShzaXplX3QgbikgJ24nIGV4Y2VlZHMgbWF4aW11bSBzdXBwb3J0ZWQgc2l6ZQBzdGQ6OnZlY3RvcjxjaGFyPgBUZXh0T3BlcmF0aW9uAHN0YXJ0aW5nUm93AGRlbGV0ZWRMaW5lQ291bnQAYWRkZWRMaW5lQ291bnQAUG9zaXRpb24AeAB5AFRleHRMYXlvdXQAZ2V0Q29sdW1ucwBnZXRUYWJXaWR0aABnZXRTb2Z0V3JhcABnZXRDb2xsYXBzZVdoaXRlc3BhY2VzAGdldFByZXNlcnZlTGVhZGluZ1NwYWNlcwBnZXRQcmVzZXJ2ZVRyYWlsaW5nU3BhY2VzAGdldEFsbG93V29yZEJyZWFrcwBnZXREZW1vdGVOZXdsaW5lcwBnZXRKdXN0aWZ5VGV4dABzZXRDb2x1bW5zAHNldFRhYldpZHRoAHNldFNvZnRXcmFwAHNldENvbGxhcHNlV2hpdGVzcGFjZXMAc2V0UHJlc2VydmVMZWFkaW5nU3BhY2VzAHNldFByZXNlcnZlVHJhaWxpbmdTcGFjZXMAc2V0QWxsb3dXb3JkQnJlYWtzAHNldERlbW90ZU5ld2xpbmVzAHNldEp1c3RpZnlUZXh0AGdldFJvd0NvdW50AGdldENvbHVtbkNvdW50AGdldFNvZnRXcmFwQ291bnQAZ2V0TWF4Q2hhcmFjdGVySW5kZXgAZ2V0Rmlyc3RQb3NpdGlvbgBnZXRMYXN0UG9zaXRpb24AZG9lc1NvZnRXcmFwAGdldFNvdXJjZQBnZXRUZXh0AGdldExpbmUAZ2V0Rml4ZWRQb3NpdGlvbgBnZXRQb3NpdGlvbkxlZnQAZ2V0UG9zaXRpb25SaWdodABnZXRQb3NpdGlvbkFib3ZlAGdldFBvc2l0aW9uQmVsb3cAZ2V0Um93Rm9yQ2hhcmFjdGVySW5kZXgAZ2V0Q2hhcmFjdGVySW5kZXhGb3JSb3cAZ2V0UG9zaXRpb25Gb3JDaGFyYWN0ZXJJbmRleABnZXRDaGFyYWN0ZXJJbmRleEZvclBvc2l0aW9uAGNsZWFyU291cmNlAHNldFNvdXJjZQBzcGxpY2VTb3VyY2UAaWlpaWlpAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVOU185YWxsb2NhdG9ySWNFRUVFAE5TdDNfXzIyMV9fYmFzaWNfc3RyaW5nX2NvbW1vbklMYjFFRUUAUDEwVGV4dExheW91dAAxMFRleHRMYXlvdXQAMTNUZXh0T3BlcmF0aW9uADhQb3NpdGlvbgBQSzEwVGV4dExheW91dABpaWlpaQBpaWlpAGlpaQB2aQB2AGlpAHZpaWkAaQBwdXNoX2JhY2sAcmVzaXplAHNpemUAZ2V0AHNldABOU3QzX18yNnZlY3RvcklOU18xMmJhc2ljX3N0cmluZ0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVOU185YWxsb2NhdG9ySWNFRUVFTlM0X0lTNl9FRUVFAE5TdDNfXzIxM19fdmVjdG9yX2Jhc2VJTlNfMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRU5TNF9JUzZfRUVFRQBOU3QzX18yMjBfX3ZlY3Rvcl9iYXNlX2NvbW1vbklMYjFFRUUATjEwZW1zY3JpcHRlbjN2YWxFAFBLTlN0M19fMjZ2ZWN0b3JJTlNfMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRU5TNF9JUzZfRUVFRQB2aWlpaQBQTlN0M19fMjZ2ZWN0b3JJTlNfMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRU5TNF9JUzZfRUVFRQB2b2lkAGJvb2wAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmcgZG91YmxlPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0llRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lkRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWZFRQBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbEVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWpFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJdEVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXNFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJYUVFAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQBOU3QzX18yMTJiYXNpY19zdHJpbmdJd05TXzExY2hhcl90cmFpdHNJd0VFTlNfOWFsbG9jYXRvckl3RUVFRQBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQBkb3VibGUAZmxvYXQAdW5zaWduZWQgbG9uZwBsb25nAHVuc2lnbmVkIGludABpbnQAdW5zaWduZWQgc2hvcnQAc2hvcnQAdW5zaWduZWQgY2hhcgBzaWduZWQgY2hhcgBjaGFyAC0rICAgMFgweAAobnVsbCkALTBYKzBYIDBYLTB4KzB4IDB4AGluZgBJTkYAbmFuAE5BTgAuAHRlcm1pbmF0aW5nIHdpdGggJXMgZXhjZXB0aW9uIG9mIHR5cGUgJXM6ICVzAHRlcm1pbmF0aW5nIHdpdGggJXMgZXhjZXB0aW9uIG9mIHR5cGUgJXMAdGVybWluYXRpbmcgd2l0aCAlcyBmb3JlaWduIGV4Y2VwdGlvbgB0ZXJtaW5hdGluZwB1bmNhdWdodABTdDlleGNlcHRpb24ATjEwX19jeHhhYml2MTE2X19zaGltX3R5cGVfaW5mb0UAU3Q5dHlwZV9pbmZvAE4xMF9fY3h4YWJpdjEyMF9fc2lfY2xhc3NfdHlwZV9pbmZvRQBOMTBfX2N4eGFiaXYxMTdfX2NsYXNzX3R5cGVfaW5mb0UAcHRocmVhZF9vbmNlIGZhaWx1cmUgaW4gX19jeGFfZ2V0X2dsb2JhbHNfZmFzdCgpAGNhbm5vdCBjcmVhdGUgcHRocmVhZCBrZXkgZm9yIF9fY3hhX2dldF9nbG9iYWxzKCkAY2Fubm90IHplcm8gb3V0IHRocmVhZCB2YWx1ZSBmb3IgX19jeGFfZ2V0X2dsb2JhbHMoKQB0ZXJtaW5hdGVfaGFuZGxlciB1bmV4cGVjdGVkbHkgcmV0dXJuZWQAU3QxMWxvZ2ljX2Vycm9yAFN0MTJsZW5ndGhfZXJyb3IATjEwX19jeHhhYml2MTE5X19wb2ludGVyX3R5cGVfaW5mb0UATjEwX19jeHhhYml2MTE3X19wYmFzZV90eXBlX2luZm9FAE4xMF9fY3h4YWJpdjEyM19fZnVuZGFtZW50YWxfdHlwZV9pbmZvRQB2AERuAGIAYwBoAGEAcwB0AGkAagBsAG0AZgBkAE4xMF9fY3h4YWJpdjEyMV9fdm1pX2NsYXNzX3R5cGVfaW5mb0U=';
  var asmjsCodeFile = '';

  if (!isDataURI(wasmTextFile)) {
    wasmTextFile = locateFile(wasmTextFile);
  }
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }
  if (!isDataURI(asmjsCodeFile)) {
    asmjsCodeFile = locateFile(asmjsCodeFile);
  }

  // utilities

  var wasmPageSize = 64*1024;

  var info = {
    'global': null,
    'env': null,
    'asm2wasm': asm2wasmImports,
    'parent': Module // Module inside wasm-js.cpp refers to wasm-js.cpp; this allows access to the outside program.
  };

  var exports = null;


  function mergeMemory(newBuffer) {
    // The wasm instance creates its memory. But static init code might have written to
    // buffer already, including the mem init file, and we must copy it over in a proper merge.
    // TODO: avoid this copy, by avoiding such static init writes
    // TODO: in shorter term, just copy up to the last static init write
    var oldBuffer = Module['buffer'];
    if (newBuffer.byteLength < oldBuffer.byteLength) {
      err('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
    }
    var oldView = new Int8Array(oldBuffer);
    var newView = new Int8Array(newBuffer);


    newView.set(oldView);
    updateGlobalBuffer(newBuffer);
    updateGlobalBufferViews();
  }

  function fixImports(imports) {
    return imports;
  }

  function getBinary() {
    try {
      if (Module['wasmBinary']) {
        return new Uint8Array(Module['wasmBinary']);
      }
      var binary = tryParseAsDataURI(wasmBinaryFile);
      if (binary) {
        return binary;
      }
      if (Module['readBinary']) {
        return Module['readBinary'](wasmBinaryFile);
      } else {
        throw "both async and sync fetching of the wasm failed";
      }
    }
    catch (err) {
      abort(err);
    }
  }

  function getBinaryPromise() {
    // if we don't have the binary yet, and have the Fetch api, use that
    // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
    if (!Module['wasmBinary'] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
        return getBinary();
      });
    }
    // Otherwise, getBinary should be able to get it synchronously
    return new Promise(function(resolve, reject) {
      resolve(getBinary());
    });
  }

  // do-method functions


  function doNativeWasm(global, env, providedBuffer) {
    if (typeof WebAssembly !== 'object') {
      // when the method is just native-wasm, our error message can be very specific
      abort('No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.');
      err('no native wasm support detected');
      return false;
    }
    // prepare memory import
    if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
      err('no native wasm Memory in use');
      return false;
    }
    env['memory'] = Module['wasmMemory'];
    // Load the wasm module and create an instance of using native support in the JS engine.
    info['global'] = {
      'NaN': NaN,
      'Infinity': Infinity
    };
    info['global.Math'] = Math;
    info['env'] = env;
    // handle a generated wasm instance, receiving its exports and
    // performing other necessary setup
    function receiveInstance(instance, module) {
      exports = instance.exports;
      if (exports.memory) mergeMemory(exports.memory);
      Module['asm'] = exports;
      Module["usingWasm"] = true;
      removeRunDependency('wasm-instantiate');
    }
    addRunDependency('wasm-instantiate');

    // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
    // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
    // to any other async startup actions they are performing.
    if (Module['instantiateWasm']) {
      try {
        return Module['instantiateWasm'](info, receiveInstance);
      } catch(e) {
        err('Module.instantiateWasm callback failed with error: ' + e);
        return false;
      }
    }

    // Async compilation can be confusing when an error on the page overwrites Module
    // (for example, if the order of elements is wrong, and the one defining Module is
    // later), so we save Module and check it later.
    var trueModule = Module;
    function receiveInstantiatedSource(output) {
      // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
      // receiveInstance() will swap in the exports (to Module.asm) so they can be called
      assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
      trueModule = null;
      receiveInstance(output['instance'], output['module']);
    }
    function instantiateArrayBuffer(receiver) {
      getBinaryPromise().then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      }).then(receiver).catch(function(reason) {
        err('failed to asynchronously prepare wasm: ' + reason);
        abort(reason);
      });
    }
    // Prefer streaming instantiation if available.
    if (!Module['wasmBinary'] &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, { credentials: 'same-origin' }), info)
        .then(receiveInstantiatedSource)
        .catch(function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err('wasm streaming compile failed: ' + reason);
          err('falling back to ArrayBuffer instantiation');
          instantiateArrayBuffer(receiveInstantiatedSource);
        });
    } else {
      instantiateArrayBuffer(receiveInstantiatedSource);
    }
    return {}; // no exports yet; we'll fill them in later
  }


  // We may have a preloaded value in Module.asm, save it
  Module['asmPreload'] = Module['asm'];

  // Memory growth integration code

  var asmjsReallocBuffer = Module['reallocBuffer'];

  var wasmReallocBuffer = function(size) {
    var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
    size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
    var old = Module['buffer'];
    var oldSize = old.byteLength;
    if (Module["usingWasm"]) {
      // native wasm support
      try {
        var result = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return Module['buffer'] = Module['wasmMemory'].buffer;
        } else {
          return null;
        }
      } catch(e) {
        console.error('Module.reallocBuffer: Attempted to grow from ' + oldSize  + ' bytes to ' + size + ' bytes, but got error: ' + e);
        return null;
      }
    }
  };

  Module['reallocBuffer'] = function(size) {
    if (finalMethod === 'asmjs') {
      return asmjsReallocBuffer(size);
    } else {
      return wasmReallocBuffer(size);
    }
  };

  // we may try more than one; this is the final one, that worked and we are using
  var finalMethod = '';

  // Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
  // the wasm module at that time, and it receives imports and provides exports and so forth, the app
  // doesn't need to care that it is wasm or olyfilled wasm or asm.js.

  Module['asm'] = function(global, env, providedBuffer) {
    env = fixImports(env);

    // import table
    if (!env['table']) {
      var TABLE_SIZE = Module['wasmTableSize'];
      if (TABLE_SIZE === undefined) TABLE_SIZE = 1024; // works in binaryen interpreter at least
      var MAX_TABLE_SIZE = Module['wasmMaxTableSize'];
      if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {
        if (MAX_TABLE_SIZE !== undefined) {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, 'maximum': MAX_TABLE_SIZE, 'element': 'anyfunc' });
        } else {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, element: 'anyfunc' });
        }
      } else {
        env['table'] = new Array(TABLE_SIZE); // works in binaryen interpreter at least
      }
      Module['wasmTable'] = env['table'];
    }

    if (!env['memoryBase']) {
      env['memoryBase'] = Module['STATIC_BASE']; // tell the memory segments where to place themselves
    }
    if (!env['tableBase']) {
      env['tableBase'] = 0; // table starts at 0 by default, in dynamic linking this will change
    }

    // try the methods. each should return the exports if it succeeded

    var exports;
    exports = doNativeWasm(global, env, providedBuffer);

    assert(exports, 'no binaryen method succeeded. consider enabling more options, like interpreting, if you want that: http://kripken.github.io/emscripten-site/docs/compiling/WebAssembly.html#binaryen-methods');


    return exports;
  };

  var methodHandler = Module['asm']; // note our method handler, as we may modify Module['asm'] later
}

integrateWasmJS();

// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 10336;
/* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_embind_cc() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });







var STATIC_BUMP = 10336;
Module["STATIC_BASE"] = STATIC_BASE;
Module["STATIC_BUMP"] = STATIC_BUMP;

/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function']);
    }

  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var key in EXCEPTIONS.infos) {
          var ptr = +key; // the iteration key is a string, and if we throw this, it must be an integer as that is what we look for
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }
      if (info) info.rethrown = false;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((setTempRet0(0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((setTempRet0(0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((setTempRet0(typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((setTempRet0(throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }

  function ___gxx_personality_v0() {
    }

  function ___lock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  
  var structRegistrations={};
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function __embind_finalize_value_object(structType) {
      var reg = structRegistrations[structType];
      delete structRegistrations[structType];
  
      var rawConstructor = reg.rawConstructor;
      var rawDestructor = reg.rawDestructor;
      var fieldRecords = reg.fields;
      var fieldTypes = fieldRecords.map(function(field) { return field.getterReturnType; }).
                concat(fieldRecords.map(function(field) { return field.setterArgumentType; }));
      whenDependentTypesAreResolved([structType], fieldTypes, function(fieldTypes) {
          var fields = {};
          fieldRecords.forEach(function(field, i) {
              var fieldName = field.fieldName;
              var getterReturnType = fieldTypes[i];
              var getter = field.getter;
              var getterContext = field.getterContext;
              var setterArgumentType = fieldTypes[i + fieldRecords.length];
              var setter = field.setter;
              var setterContext = field.setterContext;
              fields[fieldName] = {
                  read: function(ptr) {
                      return getterReturnType['fromWireType'](
                          getter(getterContext, ptr));
                  },
                  write: function(ptr, o) {
                      var destructors = [];
                      setter(setterContext, ptr, setterArgumentType['toWireType'](destructors, o));
                      runDestructors(destructors);
                  }
              };
          });
  
          return [{
              name: reg.name,
              'fromWireType': function(ptr) {
                  var rv = {};
                  for (var i in fields) {
                      rv[i] = fields[i].read(ptr);
                  }
                  rawDestructor(ptr);
                  return rv;
              },
              'toWireType': function(destructors, o) {
                  // todo: Here we have an opportunity for -O3 level "unsafe" optimizations:
                  // assume all fields are present without checking.
                  for (var fieldName in fields) {
                      if (!(fieldName in o)) {
                          throw new TypeError('Missing field');
                      }
                  }
                  var ptr = rawConstructor();
                  for (fieldName in fields) {
                      fields[fieldName].write(ptr, o[fieldName]);
                  }
                  if (destructors !== null) {
                      destructors.push(rawDestructor, ptr);
                  }
                  return ptr;
              },
              'argPackAdvance': 8,
              'readValueFromPointer': simpleReadValueFromPointer,
              destructorFunction: rawDestructor,
          }];
      });
    }

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }
  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  
  var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          });
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  
  function runDestructor(handle) {
      var $$ = handle.$$;
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;
      if (toDelete) {
          runDestructor(this);
      }
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      var ptr;
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return Object.create(prototype, {
          $$: {
              value: record,
          },
      });
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  
  function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = Module["asm"]['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = Module["asm"]['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = embind__requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = embind__requireFunction(downcastSignature, downcast);
      }
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  var destructors = [];
                  var args = new Array(argCount);
                  args[0] = rawConstructor;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      var returns = (argTypes[0].name !== "void");
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }function __embind_register_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
      invokerSignature,
      rawInvoker,
      context,
      isPureVirtual
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
          }
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
              // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
  
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
  
              // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
              // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.
              if (undefined === proto[methodName].overloadTable) {
                  // Set argCount in case an overload is registered later
                  memberFunction.argCount = argCount - 2;
                  proto[methodName] = memberFunction;
              } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
  
              return [];
          });
          return [];
      });
    }

  
  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }
  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
  
      var fromWireType = function(value) {
          return value;
      };
  
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      var isUnsignedType = (name.indexOf('unsigned') != -1);
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return isUnsignedType ? (value >>> 0) : (value | 0);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

  function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      var stdStringIsUTF8
      //process only std::string bindings with UTF8 support, in contrast to e.g. std::basic_string<unsigned char>
      = (name === "std::string");
  
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
  
              var str;
              if(stdStringIsUTF8) {
                  //ensure null termination at one-past-end byte if not present yet
                  var endChar = HEAPU8[value + 4 + length];
                  var endCharSwap = 0;
                  if(endChar != 0)
                  {
                    endCharSwap = endChar;
                    HEAPU8[value + 4 + length] = 0;
                  }
  
                  var decodeStartPtr = value + 4;
                  //looping here to support possible embedded '0' bytes
                  for (var i = 0; i <= length; ++i) {
                    var currentBytePtr = value + 4 + i;
                    if(HEAPU8[currentBytePtr] == 0)
                    {
                      var stringSegment = UTF8ToString(decodeStartPtr);
                      if(str === undefined)
                        str = stringSegment;
                      else
                      {
                        str += String.fromCharCode(0);
                        str += stringSegment;
                      }
                      decodeStartPtr = currentBytePtr + 1;
                    }
                  }
  
                  if(endCharSwap != 0)
                    HEAPU8[value + 4 + length] = endCharSwap;
              } else {
                  var a = new Array(length);
                  for (var i = 0; i < length; ++i) {
                      a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
                  }
                  str = a.join('');
              }
  
              _free(value);
              
              return str;
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
              
              var getLength;
              var valueIsOfTypeString = (typeof value === 'string');
  
              if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                  throwBindingError('Cannot pass non-string to std::string');
              }
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  getLength = function() {return lengthBytesUTF8(value);};
              } else {
                  getLength = function() {return value.length;};
              }
              
              // assumes 4-byte alignment
              var length = getLength();
              var ptr = _malloc(4 + length + 1);
              HEAPU32[ptr >> 2] = length;
  
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  stringToUTF8(value, ptr + 4, length + 1);
              } else {
                  if(valueIsOfTypeString) {
                      for (var i = 0; i < length; ++i) {
                          var charCode = value.charCodeAt(i);
                          if (charCode > 255) {
                              _free(ptr);
                              throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                          }
                          HEAPU8[ptr + 4 + i] = charCode;
                      }
                  } else {
                      for (var i = 0; i < length; ++i) {
                          HEAPU8[ptr + 4 + i] = value[i];
                      }
                  }
              }
  
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by enlargeMemory().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_value_object(
      rawType,
      name,
      constructorSignature,
      rawConstructor,
      destructorSignature,
      rawDestructor
    ) {
      structRegistrations[rawType] = {
          name: readLatin1String(name),
          rawConstructor: embind__requireFunction(constructorSignature, rawConstructor),
          rawDestructor: embind__requireFunction(destructorSignature, rawDestructor),
          fields: [],
      };
    }

  function __embind_register_value_object_field(
      structType,
      fieldName,
      getterReturnType,
      getterSignature,
      getter,
      getterContext,
      setterArgumentType,
      setterSignature,
      setter,
      setterContext
    ) {
      structRegistrations[structType].fields.push({
          fieldName: readLatin1String(fieldName),
          getterReturnType: getterReturnType,
          getter: embind__requireFunction(getterSignature, getter),
          getterContext: getterContext,
          setterArgumentType: setterArgumentType,
          setter: embind__requireFunction(setterSignature, setter),
          setterContext: setterContext,
      });
    }

  function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }


  function __emval_incref(handle) {
      if (handle > 4) {
          emval_handle_array[handle].refcount += 1;
      }
    }

  
  function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }

  function _abort() {
      Module['abort']();
    }

   

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

   

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Module['dynCall_v'](func);
      _pthread_once.seen[ptr] = 1;
    }

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    } 
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}



function nullFunc_i(x) { err("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iii(x) { err("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiii(x) { err("Invalid function pointer called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiii(x) { err("Invalid function pointer called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { err("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { err("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { err("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viii(x) { err("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { err("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { err("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { err("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

Module['wasmTableSize'] = 1568;

Module['wasmMaxTableSize'] = 1568;

function invoke_i(index) {
  var sp = stackSave();
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  var sp = stackSave();
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  var sp = stackSave();
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  var sp = stackSave();
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = {};

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_i": nullFunc_i, "nullFunc_ii": nullFunc_ii, "nullFunc_iii": nullFunc_iii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_iiiiii": nullFunc_iiiiii, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_viii": nullFunc_viii, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "invoke_i": invoke_i, "invoke_ii": invoke_ii, "invoke_iii": invoke_iii, "invoke_iiii": invoke_iiii, "invoke_iiiii": invoke_iiiii, "invoke_iiiiii": invoke_iiiiii, "invoke_v": invoke_v, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_viii": invoke_viii, "invoke_viiii": invoke_viiii, "invoke_viiiii": invoke_viiiii, "invoke_viiiiii": invoke_viiiiii, "ClassHandle": ClassHandle, "ClassHandle_clone": ClassHandle_clone, "ClassHandle_delete": ClassHandle_delete, "ClassHandle_deleteLater": ClassHandle_deleteLater, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "ClassHandle_isDeleted": ClassHandle_isDeleted, "RegisteredClass": RegisteredClass, "RegisteredPointer": RegisteredPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "RegisteredPointer_destructor": RegisteredPointer_destructor, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "___assert_fail": ___assert_fail, "___cxa_allocate_exception": ___cxa_allocate_exception, "___cxa_begin_catch": ___cxa_begin_catch, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___cxa_throw": ___cxa_throw, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___resumeException": ___resumeException, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "__embind_finalize_value_object": __embind_finalize_value_object, "__embind_register_bool": __embind_register_bool, "__embind_register_class": __embind_register_class, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_register_class_function": __embind_register_class_function, "__embind_register_emval": __embind_register_emval, "__embind_register_float": __embind_register_float, "__embind_register_integer": __embind_register_integer, "__embind_register_memory_view": __embind_register_memory_view, "__embind_register_std_string": __embind_register_std_string, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_value_object": __embind_register_value_object, "__embind_register_value_object_field": __embind_register_value_object_field, "__embind_register_void": __embind_register_void, "__emval_decref": __emval_decref, "__emval_incref": __emval_incref, "__emval_register": __emval_register, "__emval_take_value": __emval_take_value, "_abort": _abort, "_embind_repr": _embind_repr, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_pthread_getspecific": _pthread_getspecific, "_pthread_key_create": _pthread_key_create, "_pthread_once": _pthread_once, "_pthread_setspecific": _pthread_setspecific, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "count_emval_handles": count_emval_handles, "craftInvokerFunction": craftInvokerFunction, "createNamedFunction": createNamedFunction, "downcastPointer": downcastPointer, "embind__requireFunction": embind__requireFunction, "embind_init_charCodes": embind_init_charCodes, "ensureOverloadTable": ensureOverloadTable, "exposePublicSymbol": exposePublicSymbol, "extendError": extendError, "floatReadValueFromPointer": floatReadValueFromPointer, "flushPendingDeletes": flushPendingDeletes, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "genericPointerToWireType": genericPointerToWireType, "getBasestPointer": getBasestPointer, "getInheritedInstance": getInheritedInstance, "getInheritedInstanceCount": getInheritedInstanceCount, "getLiveInheritedInstances": getLiveInheritedInstances, "getShiftFromSize": getShiftFromSize, "getTypeName": getTypeName, "get_first_emval": get_first_emval, "heap32VectorToArray": heap32VectorToArray, "init_ClassHandle": init_ClassHandle, "init_RegisteredPointer": init_RegisteredPointer, "init_embind": init_embind, "init_emval": init_emval, "integerReadValueFromPointer": integerReadValueFromPointer, "makeClassHandle": makeClassHandle, "makeLegalFunctionName": makeLegalFunctionName, "new_": new_, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "readLatin1String": readLatin1String, "registerType": registerType, "replacePublicSymbol": replacePublicSymbol, "requireRegisteredType": requireRegisteredType, "runDestructor": runDestructor, "runDestructors": runDestructors, "setDelayFunction": setDelayFunction, "shallowCopyInternalPointer": shallowCopyInternalPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwBindingError": throwBindingError, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "throwInternalError": throwInternalError, "throwUnboundTypeError": throwUnboundTypeError, "upcastPointer": upcastPointer, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm =Module["asm"]// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real___GLOBAL__sub_I_bind_cpp = asm["__GLOBAL__sub_I_bind_cpp"]; asm["__GLOBAL__sub_I_bind_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_bind_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_embind_cc = asm["__GLOBAL__sub_I_embind_cc"]; asm["__GLOBAL__sub_I_embind_cc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_embind_cc.apply(null, arguments);
};

var real____cxa_can_catch = asm["___cxa_can_catch"]; asm["___cxa_can_catch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____cxa_can_catch.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"]; asm["___cxa_is_pointer_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____cxa_is_pointer_type.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____getTypeName = asm["___getTypeName"]; asm["___getTypeName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____getTypeName.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__memmove = asm["_memmove"]; asm["_memmove"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__memmove.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
Module["asm"] = asm;
var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_bind_cpp"].apply(null, arguments) };
var __GLOBAL__sub_I_embind_cc = Module["__GLOBAL__sub_I_embind_cc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_embind_cc"].apply(null, arguments) };
var ___cxa_can_catch = Module["___cxa_can_catch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_can_catch"].apply(null, arguments) };
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_is_pointer_type"].apply(null, arguments) };
var ___errno_location = Module["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___errno_location"].apply(null, arguments) };
var ___getTypeName = Module["___getTypeName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___getTypeName"].apply(null, arguments) };
var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments) };
var _fflush = Module["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fflush"].apply(null, arguments) };
var _free = Module["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_free"].apply(null, arguments) };
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments) };
var _malloc = Module["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_malloc"].apply(null, arguments) };
var _memcpy = Module["_memcpy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memcpy"].apply(null, arguments) };
var _memmove = Module["_memmove"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memmove"].apply(null, arguments) };
var _memset = Module["_memset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memset"].apply(null, arguments) };
var _sbrk = Module["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sbrk"].apply(null, arguments) };
var establishStackSpace = Module["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["establishStackSpace"].apply(null, arguments) };
var getTempRet0 = Module["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["getTempRet0"].apply(null, arguments) };
var runPostSets = Module["runPostSets"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["runPostSets"].apply(null, arguments) };
var setTempRet0 = Module["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setTempRet0"].apply(null, arguments) };
var setThrew = Module["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["setThrew"].apply(null, arguments) };
var stackAlloc = Module["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackAlloc"].apply(null, arguments) };
var stackRestore = Module["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackRestore"].apply(null, arguments) };
var stackSave = Module["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackSave"].apply(null, arguments) };
var dynCall_i = Module["dynCall_i"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_i"].apply(null, arguments) };
var dynCall_ii = Module["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ii"].apply(null, arguments) };
var dynCall_iii = Module["dynCall_iii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iii"].apply(null, arguments) };
var dynCall_iiii = Module["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiii"].apply(null, arguments) };
var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiii"].apply(null, arguments) };
var dynCall_iiiiii = Module["dynCall_iiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiiii"].apply(null, arguments) };
var dynCall_v = Module["dynCall_v"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_v"].apply(null, arguments) };
var dynCall_vi = Module["dynCall_vi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vi"].apply(null, arguments) };
var dynCall_vii = Module["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vii"].apply(null, arguments) };
var dynCall_viii = Module["dynCall_viii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viii"].apply(null, arguments) };
var dynCall_viiii = Module["dynCall_viiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiii"].apply(null, arguments) };
var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiii"].apply(null, arguments) };
var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiii"].apply(null, arguments) };
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["ccall"]) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["cwrap"]) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["ENV"]) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["print"]) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["printErr"]) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayFromBase64"]) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["tryParseAsDataURI"]) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });




/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();





// {{MODULE_ADDITIONS}}



  return Module;
};

