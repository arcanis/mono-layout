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

      return mustUpdate ? this.applyConfiguration() : null;
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
  var wasmBinaryFile = 'data:application/octet-stream;base64,AGFzbQEAAAABvAEYYAABf2ABfwF/YAJ/fwF/YAJ/fwBgA39/fwBgBH9/f38AYAV/f39/fwBgA39/fwF/YAAAYAZ/f39/f38AYAR/f39/AX9gBX9/f39/AX9gAX8AYA1/f39/f39/f39/f39/AGAIf39/f39/f38AYAl/f39/f39/f38AYAp/f39/f39/f39/AGADfn9/AX9gAn5/AX9gBn98f39/fwF/YAF8AX5gAnx/AXxgBn9/f39/fwF/YAd/f39/f39/AAKaDEADZW52Bm1lbW9yeQIAgAIDZW52BXRhYmxlAXABoAygDANlbnYKbWVtb3J5QmFzZQN/AANlbnYJdGFibGVCYXNlA38AA2Vudg5EWU5BTUlDVE9QX1BUUgN/AANlbnYNdGVtcERvdWJsZVB0cgN/AANlbnYIU1RBQ0tUT1ADfwADZW52CVNUQUNLX01BWAN/AAZnbG9iYWwDTmFOA3wABmdsb2JhbAhJbmZpbml0eQN8AANlbnYNZW5sYXJnZU1lbW9yeQAAA2Vudg5nZXRUb3RhbE1lbW9yeQAAA2VudhdhYm9ydE9uQ2Fubm90R3Jvd01lbW9yeQAAA2VudhJhYm9ydFN0YWNrT3ZlcmZsb3cADANlbnYKbnVsbEZ1bmNfaQAMA2VudgtudWxsRnVuY19paQAMA2VudgxudWxsRnVuY19paWkADANlbnYNbnVsbEZ1bmNfaWlpaQAMA2Vudg5udWxsRnVuY19paWlpaQAMA2Vudg9udWxsRnVuY19paWlpaWkADANlbnYKbnVsbEZ1bmNfdgAMA2VudgtudWxsRnVuY192aQAMA2VudgxudWxsRnVuY192aWkADANlbnYNbnVsbEZ1bmNfdmlpaQAMA2Vudg5udWxsRnVuY192aWlpaQAMA2Vudg9udWxsRnVuY192aWlpaWkADANlbnYQbnVsbEZ1bmNfdmlpaWlpaQAMA2Vudg5fX19hc3NlcnRfZmFpbAAFA2VudhlfX19jeGFfYWxsb2NhdGVfZXhjZXB0aW9uAAEDZW52El9fX2N4YV9iZWdpbl9jYXRjaAABA2VudgxfX19jeGFfdGhyb3cABANlbnYHX19fbG9jawAMA2VudgtfX19zZXRFcnJObwAMA2Vudg1fX19zeXNjYWxsMTQwAAIDZW52DV9fX3N5c2NhbGwxNDYAAgNlbnYMX19fc3lzY2FsbDU0AAIDZW52C19fX3N5c2NhbGw2AAIDZW52CV9fX3VubG9jawAMA2Vudh1fX2VtYmluZF9maW5hbGl6ZV92YWx1ZV9hcnJheQAMA2Vudh5fX2VtYmluZF9maW5hbGl6ZV92YWx1ZV9vYmplY3QADANlbnYWX19lbWJpbmRfcmVnaXN0ZXJfYm9vbAAGA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9jbGFzcwANA2VudiNfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19jb25zdHJ1Y3RvcgAJA2VudiBfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgAOA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9lbXZhbAADA2VudhdfX2VtYmluZF9yZWdpc3Rlcl9mbG9hdAAEA2VudhlfX2VtYmluZF9yZWdpc3Rlcl9pbnRlZ2VyAAYDZW52HV9fZW1iaW5kX3JlZ2lzdGVyX21lbW9yeV92aWV3AAQDZW52HF9fZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmcAAwNlbnYdX19lbWJpbmRfcmVnaXN0ZXJfc3RkX3dzdHJpbmcABANlbnYdX19lbWJpbmRfcmVnaXN0ZXJfdmFsdWVfYXJyYXkACQNlbnYlX19lbWJpbmRfcmVnaXN0ZXJfdmFsdWVfYXJyYXlfZWxlbWVudAAPA2Vudh5fX2VtYmluZF9yZWdpc3Rlcl92YWx1ZV9vYmplY3QACQNlbnYkX19lbWJpbmRfcmVnaXN0ZXJfdmFsdWVfb2JqZWN0X2ZpZWxkABADZW52Fl9fZW1iaW5kX3JlZ2lzdGVyX3ZvaWQAAwNlbnYOX19lbXZhbF9kZWNyZWYADANlbnYOX19lbXZhbF9pbmNyZWYADANlbnYSX19lbXZhbF90YWtlX3ZhbHVlAAIDZW52Bl9hYm9ydAAIA2VudhZfZW1zY3JpcHRlbl9tZW1jcHlfYmlnAAcDZW52FF9wdGhyZWFkX2dldHNwZWNpZmljAAEDZW52E19wdGhyZWFkX2tleV9jcmVhdGUAAgNlbnYNX3B0aHJlYWRfb25jZQACA2VudhRfcHRocmVhZF9zZXRzcGVjaWZpYwACA8gDxgMBAQAMAwMMAAwDAgMBDAwDCgMFBwEDDAwMBQQCBwMDAQwDBAwEDAwMDAwMDAwDAwMEAwQBAQEBAQEBAQECAQECAgICAgICAgEBAwQDAgIBAwIEBwYHBAQCBAQFBAUCBwcCBAwHBwcHAgMGAwwMAwMMAgMCAwIDAwwEBQQFAgUEBwwEAgwCAwMDAwUDAwwDDAMBBAwFDAgICAgICAgICAMICAMIAQwBAAECAQIBBwEHAQIBBwECAQIBBwEHAQcEBAEKAQcBBwEHAQIBBwELAQEDAQMBAQEBAQEBAQEMAQIEAAwBAgQADAECBAECBAEADAEMAQADAQQEAQUBAQIEAQcHAQoBAQEMAwwMAwEDAQEBBAQDAwEMCAgICAgICAgICAgICAgIDAwMDAwMCAgICAgBAQwBBwcBAAEHAgEDCwAEAQQREhIBAgYCExQVFQICAgIHAgQBAQEACAgBAQgHAQwDAQMICAMEAwIFDAIHBw4MAgUCBwEDCAgIAAMMDAwMBwkGBQIEBAUCDAkGBQgMCAwADAwBAQwBDAwHDAcCDAkGBQUJBgAHAQgBBwcHAQECBwoLFgwDBAUGCRcAAQIHCgsIDAMEBQYJBmgSfwEjAgt/ASMDC38BIwQLfwEjBQt/AUEAC38BQQALfwFBAAt/AUEAC3wBIwYLfAEjBwt/AUEAC38BQQALfwFBAAt/AUEAC3wBRAAAAAAAAAAAC38BQQALfQFDAAAAAAt9AUMAAAAACwfABCQQX19ncm93V2FzbU1lbW9yeQA2GF9fR0xPQkFMX19zdWJfSV9iaW5kX2NwcADLAhlfX0dMT0JBTF9fc3ViX0lfZW1iaW5kX2NjAMsBEF9fX2N4YV9jYW5fY2F0Y2gA2gMWX19fY3hhX2lzX3BvaW50ZXJfdHlwZQDbAxFfX19lcnJub19sb2NhdGlvbgDsAg5fX19nZXRUeXBlTmFtZQDlAgdfZmZsdXNoAI8DBV9mcmVlAOcCD19sbHZtX2Jzd2FwX2kzMgDdAwdfbWFsbG9jAOYCB19tZW1jcHkA3gMIX21lbW1vdmUA3wMHX21lbXNldADgAwVfc2JyawDhAwlkeW5DYWxsX2kA4gMKZHluQ2FsbF9paQDjAwtkeW5DYWxsX2lpaQDkAwxkeW5DYWxsX2lpaWkA5QMNZHluQ2FsbF9paWlpaQDmAw5keW5DYWxsX2lpaWlpaQDnAwlkeW5DYWxsX3YA6AMKZHluQ2FsbF92aQDpAwtkeW5DYWxsX3ZpaQDqAwxkeW5DYWxsX3ZpaWkA6wMNZHluQ2FsbF92aWlpaQDsAw5keW5DYWxsX3ZpaWlpaQDtAw9keW5DYWxsX3ZpaWlpaWkA7gMTZXN0YWJsaXNoU3RhY2tTcGFjZQA6C2dldFRlbXBSZXQwAD0LcnVuUG9zdFNldHMA3AMLc2V0VGVtcFJldDAAPAhzZXRUaHJldwA7CnN0YWNrQWxsb2MANwxzdGFja1Jlc3RvcmUAOQlzdGFja1NhdmUAOAmwGAEAIwELoAzvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPcAe8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8D7wPvA+8DqALvA+8D7wPvA+8D7wPvA+8D7wPvA6MC7wPvA+8D7wPvA5oC7wPvA+8DlQLvA+8D7wPvA+8D7wPvA+8D8APoAvAD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA8gD8APwA/AD8APwA/AD8APwA/AD2QHwA9sB8ANp8ANqa/ADbG1ub3Bx8APwA/AD8APwA/AD8APwA/AD8APwA31zdH7wA/AD8APwA/ADhAHwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/ADpQLwA6cC8APwA/AD8APwA68C8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8APwA/AD8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA94B8QPxA+AB8QPxA/ED8QPxA/EDcvEDdXbxA3d4eXp7fPED8QPxA/ED8QPmAfEDggHxA/ED6gHxA+wBhgHxA/ED8QPxA/ED8QPxA/ED8QPxA/EDkwHxA5YB8QPxA50B8QPxA/4B8QPxA/ED8QPxA/ED8QPxA/ED8QPxA/ED8QPxA7EC8QPxA/ED8QPxA/EDoALxA50C8QPxA/EDmALxA/ED8QOTAvED8QPxA/ED8QPxA/ID8gPpAuoC7gLyA/ID8gPyA/IDtAPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPOA/ID0APyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID4gHyA/ID5AHyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID6AHyA/ID8gPyA/ID7gHyA/AB8gPyAfID8gPyA/ID8gPyA/ID+AHyA/ID+gHyA/wB8gPyA/ID8gOAAvID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/IDtAK1AvID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPyA/ID8gPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wP2AfMD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wO3AvMD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD8wPzA/MD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AOCAvQD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/QD9AP0A/UD9QP1A/UD9QOtA/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A/UD9QP1A8ED9QP1A/UD9QP2A/YD9gP2A/YD9gOwA7EDsgOzA/YD9gP2A/YDvQP2A/YD9gPGA8cD9gPMA80D9gPPA/YD0gP2A/YD9gP2A9oB9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YD9gOmAvYD9gP2A/YD9gP2A/YD9gP2A/YD9gP2A/YDpAL2A/YD9gP2A/YDmwL2A/YD9gOWAvYD9gP2A8ID9gP2A/YD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cDf/cDgQH3A/cD9wP3A4UB9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A54B9wPFAfcD9wP3A/cD9wP3A/cD9wOpAvcD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD9wP3A/cD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A4sB+AOMAfgDjgGPAfgD+AORAfgD+AP4A/gDlwH4A/gD+AP4A/gD+APHAfgD+AP4A/gD+AP4A/gD+AOrAqwC+AP4A/gDsgL4A/gD+AP4A/gD+AOhAvgDngL4A/gD+AOZAvgD+AP4A5QC+AP4A/gD+AP4A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kDtwP5A/kD+QPAA/kD+QP5A/kD+QP5A/kD+QP5A/kD+QPVA/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QOQAfkD+QOSAfkD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A64C+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP5A/kD+QP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gO2A/oD+gP6A78D+gP6A/oD+gP6A/oD+gP6A/oD+gP6A9QD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gOfAfoD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+gP6A/oD+wP7A/sD+wP7A/sD+wP7A/sD+wP7A7UD+wP7A/sDvgP7A/sD+wP7A/sD+wP7A/sD+wP7A/sD0wP7A/sD+wP7Awr+jgbGAwYAIABAAAsoAQF/IwohASMKIABqJAojCkEPakFwcSQKIwojC04EQCAAEAMLIAEPCwUAIwoPCwYAIAAkCgsKACAAJAogASQLCxIAIwxBAEYEQCAAJAwgASQNCwsGACAAJBcLBQAjFw8LGgEDfyMKIQMgABBDIABBBGohASAAIAEQRQ8LSAEGfyMKIQcjCkEQaiQKIwojC04EQEEQEAMLIAchAiACIAE2AgAgACACEEAhAyADKAIAIQQgBEEBaiEFIAMgBTYCACAHJAoPC1MBB38jCiEIIwpBEGokCiMKIwtOBEBBEBADCyAIQQhqIQMgCCEEIAQgATYCACABKAIAIQIgAyAAIAIgBBBPIAMoAgAhBSAFQRRqIQYgCCQKIAYPC0EBB38jCiEIIAAgARBRIQIgAkEUaiEDIAMoAgAhBCAEQX9qIQUgAyAFNgIAIAVBAEYhBiAGRQRADwsgACACEFMPC50BARF/IwohESAAQQRqIQQgBCgCACEIIAhBAEYhCSAJBEAgBCEDA0ACQCADQQhqIQ0gDSgCACEOIA4oAgAhDyAPIANGIQUgBQRAIA4hAwUMAQsMAQsLIA4hAgUgCCEBA0ACQCABQQRqIQogCigCACELIAtBAEYhDCAMBEAgASECDAEFIAshAQsMAQsLCyACQRBqIQYgBigCACEHIAcPCywBBH8jCiEEIABBBGohASABQQA2AgAgAEEIaiECIAJBADYCACAAIAE2AgAPCxsBBH8jCiEEIABBBGohASABKAIAIQIgAhBODwt8AQp/IwohCyMKQSBqJAojCiMLTgRAQSAQAwsgC0EQaiECIAtBDGohAyALIQQgACABIAIgAxBGIQUgBSgCACEGIAZBAEYhByAHRQRAIAskCg8LIAQgABBHIAIoAgAhCCAEKAIAIQkgACAIIAUgCRBIIARBADYCACALJAoPC4UCARl/IwohHCAAQQRqIRMgEyABRiEUIAEhFSAURQRAIAFBEGohFiAWKAIAIRcgF0EARiEYIBgEQCACIAE2AgAgAyAVNgIAIAMhBiAGDwsLIAAoAgAhGSAZIAFGIQggASgCACEHIAdBAEYhCSAIBEAgAiABNgIAIAFBBGohESAJBH8gAQUgEQshGiAaDwsgCQRAIAEhBQNAAkAgBUEIaiENIA0oAgAhDiAOKAIAIQ8gDyAFRiEQIBAEQCAOIQUFDAELDAELCwUgByEEA0ACQCAEQQRqIQogCigCACELIAtBAEYhDCAMBEAMAQUgCyEECwwBCwsLIAAgAkEAEEkhEiASIQYgBg8LTAEHfyMKIQggAUEEaiEDQRgQkwMhBCAAIAQ2AgAgAEEEaiEFIAUgAzYCACAAQQhqIQIgBEEQaiEGIAZCgICAgBA3AgAgAkEBOgAADwuUAQEOfyMKIREgA0EANgIAIANBBGohCiAKQQA2AgAgA0EIaiELIAsgATYCACACIAM2AgAgACgCACEMIAwoAgAhDSANQQBGIQ4gDgRAIAMhBgUgACANNgIAIAIoAgAhBCAEIQYLIABBBGohDyAPKAIAIQUgBSAGEEsgAEEIaiEHIAcoAgAhCCAIQQFqIQkgByAJNgIADwuHAgEVfyMKIRcgAEEEaiEOIA4oAgAhDyAPQQBGIRACQCAQBEAgDiEFIA4hCAUgABBKIREgESEDIA8hBANAAkAgBEEQaiESIBIoAgAhEyATIAJLIRQgFARAIAQoAgAhFSAVQQBGIQkgCQRAQQUhFgwCBSAEIQYgFSEHCwUgEyACSSEKIApFBEBBCSEWDAILIARBBGohCyALKAIAIQwgDEEARiENIA0EQEEIIRYMAgUgCyEGIAwhBwsLIAYhAyAHIQQMAQsLIBZBBUYEQCAEIQUgBCEIDAIFIBZBCEYEQCALIQUgBCEIDAMFIBZBCUYEQCADIQUgBCEIDAQLCwsLCyABIAg2AgAgBQ8LEgEDfyMKIQMgAEEEaiEBIAEPC7sEATJ/IwohMyABIABGIRggAUEMaiEjIBhBAXEhLCAjICw6AAAgGARADwsgASECA0ACQCACQQhqIS0gLSgCACEuIC5BDGohLyAvLAAAITAgMEEBcSExIDFBGHRBGHVBAEYhDiAORQRAQRAhMgwBCyAuQQhqIQ8gDygCACEQIBAoAgAhESAuIBFGIRIgEgRAIBBBBGohEyATKAIAIRQgFEEARiEVIBUEQEEHITIMAgsgFEEMaiEWIBYsAAAhFyAXQQFxIRkgGUEYdEEYdUEARiEaIBoEQCAWIQ0FQQchMgwCCwUgEUEARiEfIB8EQEEMITIMAgsgEUEMaiEgICAsAAAhISAhQQFxISIgIkEYdEEYdUEARiEkICQEQCAgIQ0FQQwhMgwCCwsgL0EBOgAAIBAgAEYhKSAQQQxqISogKUEBcSErICogKzoAACANQQE6AAAgKQRAQRAhMgwBBSAQIQILDAELCyAyQQdGBEAgLigCACEbIAIgG0YhHCAcBEAgLyEGIBAhHgUgLhBMIA8oAgAhCSAJQQhqIQQgBCgCACEKIAlBDGohCyALIQYgCiEeCyAGQQE6AAAgHkEMaiEdIB1BADoAACAeEE0PBSAyQQxGBEAgLigCACElIAIgJUYhJiAmBEAgLhBNIA8oAgAhBSAFQQhqIQMgAygCACEIIAVBDGohDCAMIQcgCCEoBSAvIQcgECEoCyAHQQE6AAAgKEEMaiEnICdBADoAACAoEEwPBSAyQRBGBEAPCwsLC5kBAQ9/IwohDyAAQQRqIQIgAigCACEGIAYoAgAhByACIAc2AgAgB0EARiEIIAhFBEAgB0EIaiEJIAkgADYCAAsgAEEIaiEKIAooAgAhCyAGQQhqIQwgDCALNgIAIAooAgAhDSANKAIAIQMgAyAARiEEIA1BBGohBSAEBH8gDQUgBQshASABIAY2AgAgBiAANgIAIAogBjYCAA8LmQEBD38jCiEPIAAoAgAhAiACQQRqIQYgBigCACEHIAAgBzYCACAHQQBGIQggCEUEQCAHQQhqIQkgCSAANgIACyAAQQhqIQogCigCACELIAJBCGohDCAMIAs2AgAgCigCACENIA0oAgAhAyADIABGIQQgDUEEaiEFIAQEfyANBSAFCyEBIAEgAjYCACAGIAA2AgAgCiACNgIADws6AQZ/IwohBiAAQQBGIQEgAQRADwUgACgCACECIAIQTiAAQQRqIQMgAygCACEEIAQQTiAAEJQDDwsAC68BAQx/IwohDyMKQRBqJAojCiMLTgRAQRAQAwsgD0EMaiEHIA8hCCABIAcgAhBJIQkgCSgCACEKIApBAEYhCyALRQRAIAohBEEAIQUgACAENgIAIABBBGohBiAGIAU6AAAgDyQKDwsgCCABIAMQUCAHKAIAIQwgCCgCACENIAEgDCAJIA0QSCAIQQA2AgAgDSEEQQEhBSAAIAQ2AgAgAEEEaiEGIAYgBToAACAPJAoPC2QBCn8jCiEMIAFBBGohBUEYEJMDIQYgACAGNgIAIABBBGohByAHIAU2AgAgAEEIaiEEIAIoAgAhAyAGQRBqIQggAygCACEJIAggCTYCACAGQRRqIQogCkEANgIAIARBAToAAA8LVgEKfyMKIQsgAEEEaiEDIAMoAgAhBCABIAQgAxBSIQUgBSADRiEGIAZFBEAgBUEQaiEHIAcoAgAhCCAIIAFLIQkgCUUEQCAFIQIgAg8LCyADIQIgAg8LhAEBDn8jCiEQIAFBAEYhCSAJBEAgAiEDIAMPCyABIQQgAiEFA0ACQCAEQRBqIQogCigCACELIAsgAEkhDCAEQQRqIQ0gDAR/IA0FIAQLIQggDAR/IAUFIAQLIQYgCCgCACEHIAdBAEYhDiAOBEAgBiEDDAEFIAchBCAGIQULDAELCyADDwvVAQEVfyMKIRYgAUEEaiEFIAUoAgAhDSANQQBGIQ4gDgRAIAEhBANAAkAgBEEIaiERIBEoAgAhEiASKAIAIRMgEyAERiEUIBQEQCASIQMMAQUgEiEECwwBCwsFIA0hAgNAAkAgAigCACEPIA9BAEYhECAQBEAMAQUgDyECCwwBCwsgAiEDCyAAKAIAIQYgBiABRiEHIAcEQCAAIAM2AgALIABBCGohCCAIKAIAIQkgCUF/aiEKIAggCjYCACAAQQRqIQsgCygCACEMIAwgARBUIAEQlAMPC68SAccBfyMKIcgBIAEoAgAhaCBoQQBGIXMCQCBzBEAgASEZIAEhJiABIWFBBiHHAQUgAUEEaiF+IH4oAgAhiQEgiQFBAEYhlAEglAEEQCABIRggASFSIAEhYiBoIWVBCCHHAQwCBSABEFUhnwEgnwEoAgAhEiASQQBGIaoBIKoBBEAgnwEhGSCfASEmIJ8BIWFBBiHHAQwDBSCfASEYIJ8BIVIgnwEhYiASIWVBCCHHAQwDCwALAAsLIMcBQQZGBEAgJkEEaiG1ASC1ASgCACExIDFBAEYhPCA8BEAgJkEIaiEfIB8hFSAZIRdBACFjICYhaUEAIWsgYSGBAQUgGSEYICYhUiBhIWIgMSFlQQghxwELCyDHAUEIRgRAIFJBCGohRyBHKAIAIV0gZUEIaiFkIGQgXTYCACBHIRUgGCEXQQEhYyBSIWkgZSFrIGIhgQELIBUoAgAhZiBmKAIAIWcgaSBnRiFqIGoEQCBmIGs2AgAgaSAARiFsIGwEQCBrIQJBACEDBSAVKAIAIW0gbUEEaiFuIG4hJEENIccBCwUgZkEEaiFvIG8gazYCACAVKAIAIXAgcCEkQQ0hxwELIMcBQQ1GBEAgJCgCACFxIAAhAiBxIQMLIGlBDGohciByLAAAIXQgdEEBcSF1IHVBGHRBGHVBAEchdiBpIAFGIXcgdwRAIAIhBAUgAUEIaiF4IHgoAgAheSAVIHk2AgAgeCgCACF6IHooAgAheyB7IAFHIXwgfEEBcSElIHkgJUECdGohfSB9IGk2AgAgASgCACF/IBcgfzYCACB/QQhqIYABIIABIIEBNgIAIAFBBGohggEgggEoAgAhgwEgaUEEaiGEASCEASCDATYCACCDAUEARiGFASCFAUUEQCCDAUEIaiGGASCGASCBATYCAAsgAUEMaiGHASCHASwAACGIASCIAUEBcSGKASByIIoBOgAAIAIgAUYhiwEgiwEEfyBpBSACCyHEASDEASEECyAEQQBHIYwBIHYgjAFxIcABIMABRQRADwsgYwRAIGtBDGohjQEgjQFBAToAAA8LIAMhBSAEIQcDQAJAIAVBCGohjgEgjgEoAgAhjwEgjwEoAgAhkAEgBSCQAUYhkQEgBUEMaiGSASCSASwAACGTASCTAUEBcSGVASCVAUEYdEEYdUEARyGWASCRAQRAIJYBBEAgBSEMIAchDgUgkgFBAToAACCPAUEMaiEvIC9BADoAACCOASgCACEwIDAQTSAFQQRqITIgMigCACEzIAcgM0YhNCA0BH8gBQUgBwshxgEgMygCACE1IDUhDCDGASEOCyAMKAIAITYgNkEARiE3IDdFBEAgNkEMaiE4IDgsAAAhOSA5QQFxITogOkEYdEEYdUEARiE7IDsEQCAMIQ0gDCETQTYhxwEMAwsLIAxBBGohPSA9KAIAIT4gPkEARiE/ID9FBEAgPkEMaiFAIEAsAAAhQSBBQQFxIUIgQkEYdEEYdUEARiFDIEMEQEEzIccBDAMLCyAMQQxqIUQgREEAOgAAIAxBCGohRSBFKAIAIUYgRkEMaiFIIEgsAAAhSSBJQQFxIUogSkEYdEEYdUEARiFLIEYgDkYhTCBMIEtyIcEBIMEBBEBBLyHHAQwCCyBGQQhqIU0gTSgCACFOIE4oAgAhTyBGIE9GIVAgUARAIE5BBGohUSBRKAIAIVMgUyEGIA4hCAUgTyEGIA4hCAsFIJYBBEAgBSEJIAchCwUgkgFBAToAACCPAUEMaiGXASCXAUEAOgAAII4BKAIAIZgBIJgBEEwgBSgCACGZASAHIJkBRiGaASCaAQR/IAUFIAcLIcUBIJkBQQRqIZsBIJsBKAIAIZwBIJwBIQkgxQEhCwsgCSgCACGdASCdAUEARiGeASCeAUUEQCCdAUEMaiGgASCgASwAACGhASChAUEBcSGiASCiAUEYdEEYdUEARiGjASCjAQRAQSMhxwEMAwsLIAlBBGohpAEgpAEoAgAhpQEgpQFBAEYhpgEgpgFFBEAgpQFBDGohpwEgpwEsAAAhqAEgqAFBAXEhqQEgqQFBGHRBGHVBAEYhqwEgqwEEQCAJIQogpAEhFEEnIccBDAMLCyAJQQxqIawBIKwBQQA6AAAgCUEIaiGtASCtASgCACGuASCuASALRiGvASCvAQRAQR4hxwEMAgsgrgFBDGohsAEgsAEsAAAhsQEgsQFBAXEhsgEgsgFBGHRBGHVBAEYhswEgswEEQCCwASEWQSAhxwEMAgsgrgFBCGohtAEgtAEoAgAhtgEgtgEoAgAhtwEgrgEgtwFGIbgBILgBBEAgtgFBBGohuQEguQEoAgAhugEgugEhBiALIQgFILcBIQYgCyEICwsgBiEFIAghBwwBCwsCQCDHAUEeRgRAIAtBDGohIiAiIRZBICHHAQUgxwFBI0YEQCAJQQRqIQ8gDygCACEbIBtBAEYhuwEguwEEQCCgASEaBSAbQQxqIREgESwAACEgICBBAXEhISAhQRh0QRh1QQBGIcMBIMMBBEAgCSEKIA8hFEEnIccBDAQLIJ0BQQxqISMgIyEaCyAaQQE6AAAgCUEMaiG8ASC8AUEAOgAAIAkQTSAJQQhqIb0BIL0BKAIAIb4BIL4BQQRqIR4gvgEhCiAeIRRBJyHHAQUgxwFBL0YEQCBIQQE6AAAPBSDHAUEzRgRAIDdFBEAgNkEMaiEQIBAsAAAhHCAcQQFxIR0gHUEYdEEYdUEARiHCASDCAQRAIAwhDSAMIRNBNiHHAQwGCwsgQEEBOgAAIAxBDGohVCBUQQA6AAAgDBBMIAxBCGohVSBVKAIAIVYgViENIFYhE0E2IccBCwsLCwsgxwFBIEYEQCAWQQE6AAAPBSDHAUEnRgRAIApBCGohvwEgvwEoAgAhJyAnQQxqISggKCwAACEpIClBAXEhKiAKQQxqISsgKyAqOgAAIChBAToAACAUKAIAISwgLEEMaiEtIC1BAToAACC/ASgCACEuIC4QTA8FIMcBQTZGBEAgDUEIaiFXIFcoAgAhWCBYQQxqIVkgWSwAACFaIFpBAXEhWyANQQxqIVwgXCBbOgAAIFlBAToAACATKAIAIV4gXkEMaiFfIF9BAToAACBXKAIAIWAgYBBNDwsLCwuPAQEOfyMKIQ4gAEEEaiEEIAQoAgAhBSAFQQBGIQYgBgRAIAAhAQNAAkAgAUEIaiEJIAkoAgAhCiAKKAIAIQsgASALRiEMIAwEQCAKIQIMAQUgCiEBCwwBCwsgAg8FIAUhAwNAAkAgAygCACEHIAdBAEYhCCAIBEAgAyECDAEFIAchAwsMAQsLIAIPCwBBAA8LkAIBEH8jCiEQIwpB0ABqJAojCiMLTgRAQdAAEAMLIBBBJGohASAQIQcgAEF/NgIAIABBBGohCCAIQQQ2AgAgAEEIaiEJIABBEGohCiAAQRxqIQsgCUEANgIAIAlBBGpBADsBACAJQQZqQQA6AAAgCkIANwIAIApBCGpBADYCACALED4gAEEoaiEMIAxBADYCACAAQSxqIQ0gB0EAEFcgASAHQQEQWCANQQA2AgAgAEEwaiEOIA5BADYCACAAQTRqIQIgAkEANgIAIA0QWSABQSxqIQMgDSABIAMQWiABEFwgBxBdIA4oAgAhBCANKAIAIQUgBCAFRiEGIAYEQEGoJUG7JUEbQeYpEBEFIBAkCg8LC0oBBH8jCiEFIAAgATYCACAAQQRqIQIgAEEYaiEDIAJCADcCACACQQhqQgA3AgAgAkEQakEAOgAAIANCADcCACADQQhqQQA2AgAPC8QCARl/IwohGyAAQRRqIQQgAEIANwIAIABBCGpCADcCACAAQRBqQQA7AQAgBEEANgIAIABBGGohDyAPQQA2AgAgAEEcaiERIBFBADYCACACQQBGIRIgEgRAIABBIGohGSAZQgA3AgAgGUEIakEANgIADwsgBCACEGUgASACQSRsaiETIAQgASATEGggAEEgaiEUIABBIGohGCAYQgA3AgAgGEEIakEANgIAIAEhAwNAAkAgA0EYaiEVIBVBC2ohFiAWLAAAIRcgF0EYdEEYdUEASCEFIAUEQCAVKAIAIQYgBiEMBSAVIQwLIBdB/wFxIQcgB0GAAXEhCCAIQQBGIQkgCQRAIAchDQUgA0EcaiEKIAooAgAhCyALIQ0LIBQgDCANEKgDGiADQSRqIQ4gDiATRiEQIBAEQAwBBSAOIQMLDAELCw8LOgEGfyMKIQZBLBCTAyEBIABBBGohAiACIAE2AgAgACABNgIAIAFBLGohAyAAQQhqIQQgBCADNgIADwttAQt/IwohDSAAQQRqIQUgASACRiEGIAYEQA8LIAUoAgAhBCABIQMgBCEHA0ACQCAHIAMQYyADQSxqIQggBSgCACEJIAlBLGohCiAFIAo2AgAgCCACRiELIAsEQAwBBSAIIQMgCiEHCwwBCwsPC30BDH8jCiEMIAAoAgAhAyADQQBGIQQgBARADwsgAEEEaiEFIAUoAgAhBiADIAZGIQcgBwRAIAMhCgUgBiEBA0ACQCABQVRqIQggCBBcIAMgCEYhCSAJBEAMAQUgCCEBCwwBCwsgACgCACECIAIhCgsgBSADNgIAIAoQlAMPCyABBH8jCiEEIABBIGohASABEJ8DIABBFGohAiACEGEPCxUBA38jCiEDIABBGGohASABEJ8DDwsNAQJ/IwohAiAAEFsPCw0BAn8jCiECIAAQYA8LDQECfyMKIQIgABBEDwsNAQJ/IwohAiAAEGIPC30BDH8jCiEMIAAoAgAhAyADQQBGIQQgBARADwsgAEEEaiEFIAUoAgAhBiADIAZGIQcgBwRAIAMhCgUgBiEBA0ACQCABQVxqIQggCBBdIAMgCEYhCSAJBEAMAQUgCCEBCwwBCwsgACgCACECIAIhCgsgBSADNgIAIAoQlAMPC1wBBn8jCiEHIAAgASkCADcCACAAQQhqIAFBCGopAgA3AgAgAEEQaiABQRBqLgEAOwEAIABBFGohAiABQRRqIQMgAiADEGQgAEEgaiEEIAFBIGohBSAEIAUQmgMPC3sBDH8jCiENIABBADYCACAAQQRqIQQgBEEANgIAIABBCGohBSAFQQA2AgAgAUEEaiEGIAYoAgAhByABKAIAIQggByAIayEJIAlBAEYhCiAKBEAPCyAJQSRtQX9xIQsgACALEGUgASgCACECIAYoAgAhAyAAIAIgAxBmDwtXAQh/IwohCSABQcfj8ThLIQIgAgRAEKsDBSABQSRsIQMgAxCTAyEEIABBBGohBSAFIAQ2AgAgACAENgIAIAQgAUEkbGohBiAAQQhqIQcgByAGNgIADwsLbQELfyMKIQ0gAEEEaiEFIAEgAkYhBiAGBEAPCyAFKAIAIQQgASEDIAQhBwNAAkAgByADEGcgA0EkaiEIIAUoAgAhCSAJQSRqIQogBSAKNgIAIAggAkYhCyALBEAMAQUgCCEDIAohBwsMAQsLDwtYAQR/IwohBSAAIAEpAgA3AgAgAEEIaiABQQhqKQIANwIAIABBEGogAUEQaigCADYCACAAQRRqIAFBFGosAAA6AAAgAEEYaiECIAFBGGohAyACIAMQmgMPC20BC38jCiENIABBBGohBSABIAJGIQYgBgRADwsgBSgCACEEIAEhAyAEIQcDQAJAIAcgAxBnIANBJGohCCAFKAIAIQkgCUEkaiEKIAUgCjYCACAIIAJGIQsgCwRADAEFIAghAyAKIQcLDAELCw8LEgEDfyMKIQMgACgCACEBIAEPCxkBBH8jCiEEIABBBGohASABKAIAIQIgAg8LLQEGfyMKIQYgAEEIaiEBIAEsAAAhAiACQQFxIQMgA0EYdEEYdUEARyEEIAQPCy0BBn8jCiEGIABBCWohASABLAAAIQIgAkEBcSEDIANBGHRBGHVBAEchBCAEDwstAQZ/IwohBiAAQQpqIQEgASwAACECIAJBAXEhAyADQRh0QRh1QQBHIQQgBA8LLQEGfyMKIQYgAEELaiEBIAEsAAAhAiACQQFxIQMgA0EYdEEYdUEARyEEIAQPCy0BBn8jCiEGIABBDGohASABLAAAIQIgAkEBcSEDIANBGHRBGHVBAEchBCAEDwstAQZ/IwohBiAAQQ1qIQEgASwAACECIAJBAXEhAyADQRh0QRh1QQBHIQQgBA8LLQEGfyMKIQYgAEEOaiEBIAEsAAAhAiACQQFxIQMgA0EYdEEYdUEARyEEIAQPC5ABAQ5/IwohDyAAKAIAIQYgBiABRiEHIAcEQEEAIQIgAg8LIAAgATYCACAAQQhqIQggCCwAACEJIAlBAXEhCiAKQRh0QRh1QQBGIQsgCwRAQQAhAiACDwsgABBzIQwgDEF/aiENIA0gAUkhAyADBEAgABB0IQQgBEEARiEFIAUEQEEAIQIgAg8LC0EBIQIgAg8LGAEEfyMKIQQgAEEcaiEBIAEQQiECIAIPCxkBBH8jCiEEIABBKGohASABKAIAIQIgAg8LNwEGfyMKIQcgAEEEaiEDIAMoAgAhBCAEIAFGIQUgBQRAQQAhAiACDwsgAyABNgIAQQEhAiACDwuUAQEPfyMKIRAgAEEIaiEHIAcsAAAhCCAIQQFxIQkgCUH/AXEhCiABQQFxIQsgCiALRiEMIAwEQEEAIQIgAg8LIAFBAXEhDSAHIA06AAAgAQRAIAAQcyEOIAAoAgAhAyAOIANLIQQgBEUEQEEAIQIgAg8LBSAAEHQhBSAFQQBGIQYgBgRAQQAhAiACDwsLQQEhAiACDwtUAQp/IwohCyAAQQlqIQMgAywAACEEIARBAXEhBSAFQf8BcSEGIAFBAXEhByAGIAdGIQggCARAQQAhAiACDwsgAUEBcSEJIAMgCToAAEEBIQIgAg8LVAEKfyMKIQsgAEEKaiEDIAMsAAAhBCAEQQFxIQUgBUH/AXEhBiABQQFxIQcgBiAHRiEIIAgEQEEAIQIgAg8LIAFBAXEhCSADIAk6AABBASECIAIPC1QBCn8jCiELIABBC2ohAyADLAAAIQQgBEEBcSEFIAVB/wFxIQYgAUEBcSEHIAYgB0YhCCAIBEBBACECIAIPCyABQQFxIQkgAyAJOgAAQQEhAiACDwtUAQp/IwohCyAAQQxqIQMgAywAACEEIARBAXEhBSAFQf8BcSEGIAFBAXEhByAGIAdGIQggCARAQQAhAiACDwsgAUEBcSEJIAMgCToAAEEBIQIgAg8LVAEKfyMKIQsgAEENaiEDIAMsAAAhBCAEQQFxIQUgBUH/AXEhBiABQQFxIQcgBiAHRiEIIAgEQEEAIQIgAg8LIAFBAXEhCSADIAk6AABBASECIAIPC1QBCn8jCiELIABBDmohAyADLAAAIQQgBEEBcSEFIAVB/wFxIQYgAUEBcSEHIAYgB0YhCCAIBEBBACECIAIPCyABQQFxIQkgAyAJOgAAQQEhAiACDws4AQh/IwohCCAAQTBqIQEgASgCACECIABBLGohAyADKAIAIQQgAiAEayEFIAVBLG1Bf3EhBiAGDwtVAQt/IwohCyAAQRBqIQEgAUELaiECIAIsAAAhAyADQf8BcSEEIARBgAFxIQUgBUEARiEGIAYEQCAEIQkgCQ8LIABBFGohByAHKAIAIQggCCEJIAkPCxIBAn8jCiEDIABBAEEAEIABDwseAQN/IwohBSAAIAE2AgAgAEEEaiEDIAMgAjYCAA8LWAEMfyMKIQ0gAUEwaiEEIAQoAgAhBSAFQWBqIQYgBigCACEHIAFBLGohCCAIKAIAIQkgBSEKIAogCWshCyALQSxtQX9xIQIgAkF/aiEDIAAgByADEIABDwuBAQEOfyMKIQ8gAEEsaiEGIABBMGohByAHKAIAIQggBigCACEJIAggCWshCiAKQSxtQX9xIQsgCyABSyEMIAwEQCAGIAEQgwEhDSANQRBqIQIgAiwAACEDIANBAXEhBCAEQRh0QRh1QQBHIQUgBQ8FQdElQbslQdYBQZUtEBELQQAPC1IBCn8jCiELIABBBGohAiACKAIAIQMgACgCACEEIAQhBSADIAVrIQYgBkEsbUF/cSEHIAcgAUshCCAIBEAgBCABQSxsaiEJIAkPBRCsAwtBAA8LEgEDfyMKIQMgAEEQaiEBIAEPC50CAR9/IwohICABQSxqIQ0gDSgCACEYIBhBIGohGSAAIBkQmgMgAUEwaiEaIBooAgAhGyANKAIAIRwgGyAcayEdIB1BLG1Bf3EhHiAeQQFLIQMgA0UEQA8LQQEhAgNAAkAgABCpAxogDSACEIMBIQQgBEEgaiEFIAVBC2ohBiAGLAAAIQcgB0EYdEEYdUEASCEIIAUoAgAhCSAIBH8gCQUgBQshCiAHQf8BcSELIAtBgAFxIQwgDEEARiEOIARBJGohDyAPKAIAIRAgDgR/IAsFIBALIREgACAKIBEQqAMaIAJBAWohEiAaKAIAIRMgDSgCACEUIBMgFGshFSAVQSxtQX9xIRYgEiAWSSEXIBcEQCASIQIFDAELDAELCw8LZgELfyMKIQwgAEEsaiEDIABBMGohBCAEKAIAIQUgAygCACEGIAUgBmshByAHQSxtQX9xIQggCCABSyEJIAkEQCADIAEQgwEhCiAKQSBqIQIgAg8FQdElQbslQe4BQbQtEBELQQAPC4YCAR1/IwohHyACQQRqIRYgFigCACEXIAFBLGohGCABQTBqIRkgGSgCACEaIBgoAgAhGyAaIBtrIRwgHEEsbUF/cSEDIBcgA0khBCAERQRAQeglQbslQfUBQYQmEBELIBggFxCDASEFIAIoAgAhBiAFQQxqIQcgBygCACEIIAYgCEshCSAJBEBBoCZBuyVB+QFBhCYQEQUgBUEUaiEKIAooAgAhCyAFQRhqIQwgDCgCACENIAsgDSAGEIgBIQ4gDiANRiEPIA5BXGohECAPBH8gEAUgDgshHSALIREgHSESIBIgEWshEyATQSRtQX9xIRQgFigCACEVIAAgFSAUIAUgHRCJAQ8LC+YBARp/IwohHCABIQsgACEMIAsgDGshESARQQBGIRIgEgRAIAwhCSAJIRAgEA8LIBFBJG1Bf3EhEyATIQMgDCEKA0ACQCADQQJtQX9xIRQgCiEVIBUgFEEkbGohFiAVIBRBJGxqQQxqIQQgBCgCACEFIBUgFEEkbGpBEGohBiAGKAIAIQcgBSAHIAIQigEhFyAWQSRqIRggGCENIANBf2ohCCAIIBRrIQ4gFwR/IA0FIAoLIRkgFwR/IA4FIBQLIRogGkEARiEPIA8EQCAZIQkMAQUgGiEDIBkhCgsMAQsLIAkhECAQDws6AQV/IwohCSAAIAE2AgAgAEEEaiEFIAUgAjYCACAAQQhqIQYgBiADNgIAIABBDGohByAHIAQ2AgAPCxkBBH8jCiEGIAEgAGohAyADIAJNIQQgBA8L0wMCKX8BfiMKISsjCkEQaiQKIwojC04EQEEQEAMLICshGSABQSxqISQgAUEwaiElICUoAgAhJiAkKAIAIScgJiAnayEoIChBAEYhKSApBEBBqCVBuyVBigJBvC0QEQsgKEEsbUF/cSEFIAJBBGohBiAFQX9qIQcgBigCACEIIAcgCEkhCSAJBH8gBwUgCAshBCAGIAQ2AgAgJCAEEIMBIQogCkEMaiELIAsoAgAhDCACKAIAIQ0gDCANSSEOIA4EfyAMBSANCyEPIAIgDzYCACAkIAQQgwEhECAPQQBGIREgEQRAIAIpAgAhLCAAICw3AgAgKyQKDwsgEEEMaiESIBIoAgAhEyAPIBNGIRQgFARAIAIpAgAhLCAAICw3AgAgKyQKDwsgGSABIAIQhwEgGUEMaiEVIBUoAgAhFiAWQRRqIRcgFywAACEYIBhBAXEhGiAaQRh0QRh1QQBGIRsgGwRAIAIpAgAhLCAAICw3AgAgKyQKDwsgFkEMaiEcIBwoAgAhHSAWQRBqIR4gHigCACEfIB9BAXYhICAgIB1qISEgDyAhSyEiICIEfyAfBUEACyEjIB0gI2ohAyACIAM2AgAgAikCACEsIAAgLDcCACArJAoPC5MEAi9/AX4jCiExIwpBEGokCiMKIwtOBEBBEBADCyAxIRggAUEsaiEjIAFBMGohKiAqKAIAISsgIygCACEsICsgLGshLSAtQQBGIS4gLgRAQaglQbslQakCQc0tEBELIC1BLG1Bf3EhBCACQQRqIQUgBSgCACEGIAYgBEkhByAHRQRAQeglQbslQaoCQc0tEBELIBggASACEIcBIBhBCGohCCAIKAIAIQkgGEEMaiEKIAooAgAhCyACKAIAIQwgC0EMaiENIA0oAgAhDiAMIA5LIQ8CQCAPBEAgC0EUaiEQIBAsAAAhESARQQFxIRIgEkEYdEEYdUEARiETIAxBf2ohFCATBH8gDgUgFAshLyAvIQMFIBhBBGohFSAVKAIAIRYgFkEARiEXIBcEQCAGQQBGIRkgGQRAIAIpAgAhMiAAIDI3AgAgAEEIaiEpIClBAToAACAxJAoPBSAGQX9qIRogBSAaNgIAICMgGhCDASEbIBtBDGohHCAcKAIAIR0gHSEDDAMLAAUgCUEUaiEeIBZBf2ohHyAeIB8QjQEhICAgQRRqISEgISwAACEiICJBAXEhJCAkQRh0QRh1QQBGISUgJQRAICBBDGohJyAnKAIAISggKCEDDAMFIAxBf2ohJiAmIQMMAwsACwALCyACIAM2AgAgAikCACEyIAAgMjcCACAAQQhqISkgKUEBOgAAIDEkCg8LUgEKfyMKIQsgAEEEaiECIAIoAgAhAyAAKAIAIQQgBCEFIAMgBWshBiAGQSRtQX9xIQcgByABSyEIIAgEQCAEIAFBJGxqIQkgCQ8FEKwDC0EADwv5BAI9fwF+IwohPyMKQRBqJAojCiMLTgRAQRAQAwsgPyEYIAFBMGohIyAjKAIAIS4gAUEsaiE4IDgoAgAhOiAuIDprITsgO0EARiE8IDwEQEGoJUG7JUHgAkHdLRARCyA7QSxtQX9xIQQgAkEEaiEFIAUoAgAhBiAGIARJIQcgB0UEQEHoJUG7JUHhAkHdLRARCyAYIAEgAhCHASAYQQxqIQggCCgCACEJIAIoAgAhCiAJQQxqIQsgCygCACEMIAlBEGohDSANKAIAIQ4gDiAMaiEPIAogD0khEAJAIBAEQCAJQRRqIREgESwAACESIBJBAXEhEyATQRh0QRh1QQBGIRQgCkEBaiEVIBQEfyAPBSAVCyE9ID0hAwUgGEEIaiEWIBYoAgAhFyAYQQRqIRkgGSgCACEaIBdBFGohGyAXQRhqIRwgHCgCACEdIBsoAgAhHiAdIB5rIR8gH0EkbUF/cSEgICBBf2ohISAaICFGISIgIgRAICMoAgAhJCA4KAIAISUgJCAlayEmICZBLG1Bf3EhJyAnQX9qISggBiAoSSEpICkEQCAGQQFqISogBSAqNgIAQQAhAwwDBSACKQIAIUAgACBANwIAIABBCGohOSA5QQE6AAAgPyQKDwsABSAaQQFqISsgGyArEI0BISwgLEEUaiEtIC0sAAAhLyAvQQFxITAgMEEYdEEYdUEARiExIDEEQCAsQQxqITMgMygCACE0ICxBEGohNSA1KAIAITYgNiA0aiE3IDchAwwDBSAKQQFqITIgMiEDDAMLAAsACwsgAiADNgIAIAIpAgAhQCAAIEA3AgAgAEEIaiE5IDlBAToAACA/JAoPC1ACBH8BfiMKIQYjCkEQaiQKIwojC04EQEEQEAMLIAZBCGohBCAGIQMgAikCACEHIAMgBzcDACAEIAMpAgA3AgAgACABIARBARCQASAGJAoPC5UEAi5/AX4jCiExIwpBEGokCiMKIwtOBEBBEBADCyAxISMgAUEsaiErIAFBMGohLCAsKAIAIS0gKygCACEuIC0gLmshLyAvQQBGIQUgBQRAQaglQbslQZwDQe4tEBELIC9BLG1Bf3EhBiACQQRqIQcgBygCACEIIAggBkkhCSAJRQRAQeglQbslQZ0DQe4tEBELIANBAEYhCgJAIAoEQEEBIQQFIAggA0khCyALBEAgB0EANgIAIAJBADYCAEEBIQQMAgsgCCADayEMIAcgDDYCACACKAIAIQ0gDUEARiEOIA4EQEEBIQQFICsgDBCDASEPIA9BDGohECAQKAIAIREgDSARSSESIBJFBEAgKyAMEIMBIRMgE0EMaiEUIBQoAgAhFSANIBVGIRYgFkEBcSEXICsgDBCDASEYIBhBDGohGSAZKAIAIRogAiAaNgIAIBchBAwDCyAjIAEgAhCHASAjQQxqIRsgGygCACEcIBxBFGohHSAdLAAAIR4gHkEBcSEfIB9BGHRBGHVBAEYhICAgBEAgHEEMaiEhICEoAgAhIiAcQRBqISQgJCgCACElICVBAXYhJiAmICJqIScgDSAnSyEoICgEQCAlICJqISkgAiApNgIAQQEhBAwEBSACICI2AgBBASEEDAQLAAVBASEECwsLCyACKQIAITIgACAyNwIAIABBCGohKiAqIAQ6AAAgMSQKDwtQAgR/AX4jCiEGIwpBEGokCiMKIwtOBEBBEBADCyAGQQhqIQQgBiEDIAIpAgAhByADIAc3AwAgBCADKQIANwIAIAAgASAEQQEQkgEgBiQKDwu6BAIzfwF+IwohNiMKQRBqJAojCiMLTgRAQRAQAwsgNiEjIAFBLGohLiABQTBqITEgMSgCACEyIC4oAgAhMyAyIDNrITQgNEEsbUF/cSEFIDRBAEYhBiAGBEBBqCVBuyVB2wNB/y0QEQsgAkEEaiEHIAcoAgAhCCAFIAhLIQkgCUUEQEHoJUG7JUHcA0H/LRARCyADQQBGIQoCQCAKBEBBASEEBSAFQX9qIQsgCyAIayEMIAwgA0khDSANBEAgByALNgIAIC4gCxCDASEOIA5BDGohDyAPKAIAIRAgAiAQNgIAQQEhBAwCCyAIIANqIREgByARNgIAIAIoAgAhEiASQQBGIRMgEwRAQQEhBAUgLiAREIMBIRQgFEEMaiEVIBUoAgAhFiASIBZJIRcgF0UEQCAuIBEQgwEhGCAYQQxqIRkgGSgCACEaIBIgGkYhGyAbQQFxIRwgLiAREIMBIR0gHUEMaiEeIB4oAgAhHyACIB82AgAgHCEEDAMLICMgASACEIcBICNBDGohICAgKAIAISEgIUEUaiEiICIsAAAhJCAkQQFxISUgJUEYdEEYdUEARiEmICYEQCAhQQxqIScgJygCACEoICFBEGohKSApKAIAISogKkEBdiErICsgKGohLCASICxLIS0gLQRAICogKGohLyACIC82AgBBASEEDAQFIAIgKDYCAEEBIQQMBAsABUEBIQQLCwsLIAIpAgAhNyAAIDc3AgAgAEEIaiEwIDAgBDoAACA2JAoPC74BARV/IwohFiAAQTBqIQ0gDSgCACEOIABBLGohDyAPKAIAIRAgDiAQRiERIBAhEiARBEBBqCVBuyVBlgRBkC4QEQsgDkFUaiETIBMoAgAhFCAOQVhqIQMgAygCACEEIAQgFGohBSAFIAFJIQYgBgRAQcAmQbslQZcEQZAuEBEFIBAgDiABEJQBIQcgByAORiEIIAchCSAJIBJrIQogCkEsbUF/cSELIAhBH3RBH3UhDCALIAxqIQIgAg8LQQAPC9kBARl/IwohGyABIQogACELIAogC2shECAQQQBGIREgEQRAIAshCCAIIQ8gDw8LIBBBLG1Bf3EhEiASIQMgCyEJA0ACQCADQQJtQX9xIRMgCSEUIBQgE0EsbGohFSAVKAIAIQQgFCATQSxsakEEaiEFIAUoAgAhBiAEIAYgAhCVASEWIBVBLGohFyAXIQwgA0F/aiEHIAcgE2shDSAWBH8gDAUgCQshGCAWBH8gDQUgEwshGSAZQQBGIQ4gDgRAIBghCAwBBSAZIQMgGCEJCwwBCwsgCCEPIA8PCxkBBH8jCiEGIAEgAGohAyADIAJNIQQgBA8LZgELfyMKIQwgAEEsaiEDIABBMGohBCAEKAIAIQUgAygCACEGIAUgBmshByAHQSxtQX9xIQggCCABSyEJIAkEQCADIAEQgwEhCiAKKAIAIQIgAg8FQdElQbslQaYEQaguEBELQQAPC40EATp/IwohPCABQSxqIRkgAUEwaiEkICQoAgAhLyAZKAIAITcgLyE4IDcgOEYhOSA5BEBBqCVBuyVBrQRBwC4QEQsgL0FUaiE6IDooAgAhBSAvQVhqIQYgBigCACEHIAcgBWohCCAIIAJJIQkgCQRAQcAmQbslQa4EQcAuEBELIAAQmAEgGSgCACEKICQoAgAhCyAKIAsgAhCZASEMIAwgC0YhDSAKIQMgDCEOIA4gA2shDyAPQSxtQX9xIRAgDQRAIBBBf2ohESAAQQRqIRIgEiARNgIAIBkgERCDASETIBNBDGohFCAUKAIAIRUgFSEEIAAgBDYCAA8LIABBBGohFiAWIBA2AgAgDEEUaiEXIBcoAgAhGCAMQRhqIRogGigCACEbIAwoAgAhHCACIBxrIR0gGCAbIB0QmgEhHiAeQRRqIR8gHywAACEgICBBAXEhISAhQRh0QRh1QQBGISIgIkUEQCAeQQxqISMgIygCACElIB5BBGohJiAmKAIAIScgJSACaiEoICggHGshKSApICdrISogKiEEIAAgBDYCAA8LIB5BBGohKyArKAIAISwgHkEIaiEtIC0oAgAhLiAuICxqITAgMCAdRiExIB5BDGohMiAyKAIAITMgMUUEQCAzIQQgACAENgIADwsgHkEQaiE0IDQoAgAhNSA1IDNqITYgNiEEIAAgBDYCAA8LHgEDfyMKIQMgAEEANgIAIABBBGohASABQQA2AgAPC9kBARl/IwohGyABIQogACELIAogC2shECAQQQBGIREgEQRAIAshCCAIIQ8gDw8LIBBBLG1Bf3EhEiASIQMgCyEJA0ACQCADQQJtQX9xIRMgCSEUIBQgE0EsbGohFSAVKAIAIQQgFCATQSxsakEEaiEFIAUoAgAhBiAEIAYgAhCcASEWIBVBLGohFyAXIQwgA0F/aiEHIAcgE2shDSAWBH8gDAUgCQshGCAWBH8gDQUgEwshGSAZQQBGIQ4gDgRAIBghCAwBBSAZIQMgGCEJCwwBCwsgCCEPIA8PC+YBARp/IwohHCABIQsgACEMIAsgDGshESARQQBGIRIgEgRAIAwhCSAJIRAgEA8LIBFBJG1Bf3EhEyATIQMgDCEKA0ACQCADQQJtQX9xIRQgCiEVIBUgFEEkbGohFiAVIBRBJGxqQQRqIQQgBCgCACEFIBUgFEEkbGpBCGohBiAGKAIAIQcgBSAHIAIQmwEhFyAWQSRqIRggGCENIANBf2ohCCAIIBRrIQ4gFwR/IA0FIAoLIRkgFwR/IA4FIBQLIRogGkEARiEPIA8EQCAZIQkMAQUgGiEDIBkhCgsMAQsLIAkhECAQDwsZAQR/IwohBiABIABqIQMgAyACTSEEIAQPCxkBBH8jCiEGIAEgAGohAyADIAJNIQQgBA8LwwMBL38jCiEwIwpBEGokCiMKIwtOBEBBEBADCyAwIQ0gAEEwaiEYIBgoAgAhIyAAQSxqISogKigCACErICMgK2shLCAsQQBGIS0gLQRAQaglQbslQdIEQd0uEBELICxBLG1Bf3EhLiABQQRqIQMgAygCACEEIAQgLkkhBSAFRQRAQeglQbslQdMEQd0uEBELIA0gACABEIcBIA1BCGohBiAGKAIAIQcgDUEMaiEIIAgoAgAhCSABKAIAIQogCUEMaiELIAsoAgAhDCAKIAxGIQ4gDgRAIAcoAgAhDyAJQQRqIRAgECgCACERIBEgD2ohEiASIQIgMCQKIAIPCyAJQRBqIRMgEygCACEUIBQgDGohFSAKIBVGIRYgFgRAIAcoAgAhFyAJQQRqIRkgGSgCACEaIBogF2ohGyAJQQhqIRwgHCgCACEdIBsgHWohHiAeIQIgMCQKIAIPCyAJQRRqIR8gHywAACEgICBBAXEhISAhQRh0QRh1QQBGISIgIgRAQYonQbslQegEQd0uEBELIAcoAgAhJCAJQQRqISUgJSgCACEmIAogDGshJyAnICRqISggKCAmaiEpICkhAiAwJAogAg8LlAEBEH8jCiERIAFBMGohCCAIKAIAIQkgAUEsaiEKIAooAgAhCyAJIAtGIQwgDARAQaglQbslQfEEQfouEBELIAFBEGohDSANQQtqIQ4gDiwAACEPIA9B/wFxIQIgAkGAAXEhAyADQQBGIQQgBARAIAIhBwUgAUEUaiEFIAUoAgAhBiAGIQcLIAAgAUEAIAcgDRCfAQ8LiVgB+gV/Iwoh/gUjCkHQBWokCiMKIwtOBEBB0AUQAwsg/gVBvAVqIf0DIP4FQbAFaiHsBCD+BUGkBWohyQUg/gVBmAVqIdQFIP4FQewEaiHfBSD+BUHIBGohRSD+BUGcBGohUCD+BUH4A2ohWyD+BUHsA2ohZiD+BUHgA2ohcSD+BUG8A2ohfCD+BUGwA2ohhwEg/gVBpANqIZIBIP4FQYADaiGdASD+BUHcAmohqAEg/gVB0AJqIbMBIP4FQcQCaiG+ASD+BUGgAmohyQEg/gVB/AFqIdQBIP4FQfABaiHfASD+BUHMAWoh6gEg/gVBqAFqIfUBIP4FQYQBaiGAAiD+BUH4AGohiwIg/gVB7ABqIZYCIP4FQcgAaiGhAiD+BUE8aiGsAiD+BUEwaiG3AiD+BUEMaiHCAiD+BSHNAiABQRBqIdgCINgCIARHIeMCIAJBAEch7gIg7gIg4wJyIesFIARBC2ohOyDrBQRAQQUh/QUFIDssAAAh+QIg+QJB/wFxIYQDIIQDQYABcSGPAyCPA0EARiGaAyCaAwRAIIQDIbsDBSABQRRqIaUDIKUDKAIAIbADILADIbsDCyC7AyADRiHGAyDGA0UEQEEFIf0FCwsg/QVBBUYEQCDJBSDYAkEAIAIQngMgOywAACHRAyDRA0EYdEEYdUEASCHcAyAEKAIAIecDINwDBH8g5wMFIAQLIfIDINEDQf8BcSH+AyD+A0GAAXEhiQQgiQRBAEYhlAQgBEEEaiGfBCCfBCgCACGqBCCUBAR/IP4DBSCqBAshtQQgyQUg8gMgtQQQqAMhwAQg7AQgyQUpAgA3AgAg7ARBCGogyQVBCGooAgA2AgAgyQVCADcCACDJBUEIakEANgIAIAMgAmohywQg1AUg2AIgywRBfxCeAyDUBUELaiHWBCDWBCwAACHhBCDhBEEYdEEYdUEASCHtBCDUBSgCACH4BCDtBAR/IPgEBSDUBQshgwUg4QRB/wFxIY4FII4FQYABcSGZBSCZBUEARiGkBSDUBUEEaiGvBSCvBSgCACG6BSCkBQR/II4FBSC6BQshxQUg7AQggwUgxQUQqAMhyAUg/QMg7AQpAgA3AgAg/QNBCGog7ARBCGooAgA2AgAg7ARCADcCACDsBEEIakEANgIAINgCQQtqIcoFIMoFLAAAIcsFIMsFQRh0QRh1QQBIIcwFIMwFBEAg2AIoAgAhzQUgzQVBABCgASABQRRqIc4FIM4FQQA2AgAg2AIhNQUg2AJBABCgASDKBUEAOgAAINgCITULINgCEKQDIDUg/QMpAgA3AgAgNUEIaiD9A0EIaigCADYCACD9A0IANwIAIP0DQQhqQQA2AgAg/QMQnwMg1AUQnwMg7AQQnwMgyQUQnwMLIAAQogEgAUEIaiHPBSDPBSwAACHQBSDQBUEBcSHRBSDRBUEYdEEYdUEARiHSBSDSBQRAQX8hSkEAIaABBSABKAIAIdMFIAFBDmoh1QUg1QUsAAAh1gUg1gVBAXEh1wUg1wVBGHRBGHVBAEch2AUg0wUhSiDYBSGgAQsgASACEJMBIdkFIAMgAmoh2gUgASDaBRCTASHbBSABINkFEJYBIdwFINgCQQtqId0FIN0FLAAAId4FIN4FQf8BcSHgBSDgBUGAAXEh4QUg4QVBAEYh4gUg4gUEQCDgBSHmBQUgAUEUaiHjBSDjBSgCACHkBSDkBSHmBQsg3AUg5gVJIeUFIOUFBEAg2AIg3AUQpwMh5wUg5wUsAAAh6AUg6AUhwQUFQT8hwQULIOYFQQFqIekFIAAg2QU2AgBBASDZBWshRiBGINsFaiFHIABBBGohSCBIIEc2AgAgAEEIaiFJIElBADYCACBKQQBGIUsgSwRAIElBATYCACBFQQAQVyDfBSBFQQEQWCAAQRBqIUwgTCgCACFNIABBFGohTiBOKAIAIU8gTSBPSSFRIFEEQCBNIN8FEKMBIEwoAgAhUiBSQSxqIVMgTCBTNgIABSAAQQxqIVQgVCDfBRCkAQsg3wUQXCBFEF0gASAAEKwBIP4FJAoPCyDcBSDpBUkhVSBVRQRAIAEgABCsASD+BSQKDwsg2QVBAEYhViBQQQhqIVcgAEEQaiFYIAFBLGohWSDZBUF/aiFaIAFBDWohXCABQQpqIV0gUEEEaiFeIFBBDGohXyABQQlqIWAgqAFBBGohYSCoAUEMaiFiIHxBBGohYyB8QQxqIWQgAUEMaiFlIJ0BQRRqIWcgoQJBFGohaCChAkEEaiFpIKECQQxqIWoggAJBFGohayCAAkEEaiFsIIACQQxqIW0gkgFBC2ohbiCSAUEEaiFvIL4BQQtqIXAgvgFBBGohciC3AkELaiFzILcCQQRqIXQglgJBC2ohdSCWAkEEaiF2IHxBCGohdyB8QRBqIXggfEEYaiF5ILMBQQtqIXogswFBBGoheyBQQRhqIX0gUEEcaiF+IKECQRhqIX8gf0ELaiGAASCAAkEYaiGBASCBAUELaiGCASCdAUEIaiGDASCdAUEYaiGEASCdAUEQaiGFASABQQRqIYYBIN8BQQtqIYgBIN8BQQRqIYkBIFBBFGohigEg1AFBBGohiwEg1AFBDGohjAEg9QFBBGohjQEg9QFBDGohjgEgoQJBHGohjwEggAJBHGohkAEggAJBCGohkQEggAJBEGohkwEgoQJBCGohlAEgoQJBEGohlQEgW0EEaiGWASBbQQxqIZcBIFBBEGohmAEgAUELaiGZASBxQQtqIZoBIHFBBGohmwEgwgJBBGohnAEgwgJBDGohngEgwgJBGGohnwEgoAFBAXMhMyBQQRRqIaEBIFtBCGohogEgW0EQaiGjASDCAkEIaiGkASDCAkEQaiGlASAAQRRqIaYBIFBBIGohpwEgAEEMaiGpASABQTBqIaoBIARBBGohqwEgzQJBC2ohrAEgzQJBBGohrQEg3AUhBiDBBSEHA0ACQCBQEKUBIEkoAgAhrgEgrgFBAEYhrwECQCCvAQRAIFYEQCBQIAY2AgBBACEJQQAhuQFBACHFAQwCBSBZIFoQpgEhsgEgsgEhCEEbIf0FDAILAAUgWCgCACGwASCwAUFUaiGxASCxASEIQRsh/QULCyD9BUEbRgRAQQAh/QUgUCAGNgIAIAhBCGohtAEgtAEoAgAhtQEgCEEMaiG2ASC2ASgCACG3ASC3ASC1AWohuAEgCCEJILgBIbkBQQEhxQELIFcguQE2AgAgBiDmBUkhugECQCC6AQRAAkACQAJAAkAgB0EYdEEYdUEJaw4YAAICAgICAgICAgICAgICAgICAgICAgIBAgsBCwwBCwJAIFwsAAAhuwEguwFBAXEhvAEgvAFBGHRBGHVBAEYhvQEgvQEEQCAGIRsgByEcDAQLAkACQAJAAkAgB0EYdEEYdUEKaw4EAAICAQILAQsMAQsCQCAGIRsgByEcDAUACwALCwsgXSwAACG/ASC/AUEBcSHAASDAAUEYdEEYdUEARiHBASDBAUUEQCBgLAAAIcIBIMIBQQFxIcMBIMMBQRh0QRh1QQBHIcQBIMUBIMQBcSH6BSD6BUUEQCAGIRsgByEcDAMLIAlBEGohxgEgxgEsAAAhxwEgxwFBAXEhyAEgyAFBGHRBGHVBAEYhygEgygFFBEAgBiEbIAchHAwDCwsgW0EAEFcgXigCACHLASCWASDLATYCACBfKAIAIcwBIJcBIMwBNgIAIHFCADcCACBxQQhqQQA2AgAgBiERIAchEwNAAkACQAJAAkACQCATQRh0QRh1QQlrDhgAAgICAgICAgICAgICAgICAgICAgICAgECCwELDAELAkAgXCwAACHNASDNAUEBcSHOASDOAUEYdEEYdUEARiHPASDPAQRAIBEhECATIRIMAwsCQAJAAkACQCATQRh0QRh1QQprDgQAAgIBAgsBCwwBCwJAIBEhECATIRIMBAALAAsLCyARQQFqIdABINABIOYFSSHRASDRAQRAINgCINABEKcDIdIBINIBLAAAIdMBINMBIcIFBUE/IcIFCyBxIBMQqgMgmgEsAAAh1QEg1QFB/wFxIdYBINYBQYABcSHXASDXAUEARiHYASCbASgCACHZASDYAQR/INYBBSDZAQsh2gEg2gFBf0ch2wEg0QEg2wFxIewFIOwFBEAg0AEhESDCBSETBSDQASEQIMIFIRIMAQsMAQsLIGYgcRCaAyBxEJ8DIGYQnwMgECDLAWsh3AEgUCgCACHdASDcASDdAWsh3gEgogEg3gE2AgAgowFBADYCACB9KAIAIeABIH4oAgAh4QEg4AEg4QFGIeIBIOIBBEAgigEgWxCnAQUg4AEgWxBnIH0oAgAh4wEg4wFBJGoh5AEgfSDkATYCAAsgXigCACHlASDlASDeAWoh5gEgXiDmATYCACBbEF0gECEbIBIhHAUgBiEbIAchHAsLIBsg5gVJIecBAkAg5wEEQCAbIR0gHCEeA0ACQCBcLAAAIegBIOgBQQFxIekBIOkBQRh0QRh1QQBGIesBIOsBBEACQAJAAkACQCAeQRh0QRh1QQprDgQAAgIBAgsBCwJAIB0hFyAeIRgMBwwCAAsACwELCyBfKAIAIewBIOwBIEpJIe0BAkAg7QEEQAJAAkACQAJAIB5BGHRBGHVBCWsOGAACAgICAgICAgICAgICAgICAgICAgICAQILAQsMAQsCQCDrAQRAIB0hKSAeISog7AEhhQMMBAsCQAJAAkACQCAeQRh0QRh1QQprDgQAAgIBAgsBCwwBCwJAIB0hKSAeISog7AEhhQMMBQALAAsLCyBgLAAAIe4BIO4BQQFxIe8BIO8BQRh0QRh1QQBGIfABIPABBEAgqAFBARBXIF4oAgAhlAIgYSCUAjYCACBfKAIAIZUCIGIglQI2AgAgnQEgqAEQZyCoARBdIGdBAToAACC+AUIANwIAIL4BQQhqQQA2AgAgXygCACGXAiBKIJcCRyGYAiAdIOYFSSGZAiCZAiCYAnEh7wUCQCDvBQRAIB0hJCAeISYDQAJAAkACQAJAICZBGHRBGHVBCWsOGAACAgICAgICAgICAgICAgICAgICAgICAQILAQsMAQsCQCBcLAAAIZoCIJoCQQFxIZsCIJsCQRh0QRh1QQBGIZwCIJwCBEAgJCEjICYhJQwFCwJAAkACQAJAICZBGHRBGHVBCmsOBAACAgECCwELDAELAkAgJCEjICYhJQwGAAsACwsLICRBAWohnQIgnQIg5gVJIZ4CIJ4CBEAg2AIgnQIQpwMhnwIgnwIsAAAhoAIgoAIhxAUFQT8hxAULIL4BICYQqgMgcCwAACGiAiCiAkH/AXEhowIgowJBgAFxIaQCIKQCQQBGIaUCIHIoAgAhpgIgpQIEfyCjAgUgpgILIacCIF8oAgAhqAIgSiCoAmshqQIgpwIgqQJJIaoCIJ4CIKoCcSHuBSDuBQRAIJ0CISQgxAUhJgUgnQIhIyDEBSElDAMLDAAACwAFIB0hIyAeISULCyCzASC+ARCaAyC+ARCfAyB6LAAAIasCIKsCQRh0QRh1QQBIIa0CILMBKAIAIa4CIK0CBH8grgIFILMBCyGvAiCrAkH/AXEhsAIgsAJBgAFxIbECILECQQBGIbICIHsoAgAhswIgsgIEfyCwAgUgswILIbQCIK8CILQCaiG1AiC0AkEARiG2AgJAILYCRQRAIK8CIUIDQCBCLAAAIbwCILwCQRh0QRh1Ib0CAkACQAJAAkACQAJAIL0CQQlrDhgDAQQEAgQEBAQEBAQEBAQEBAQEBAQEBAAECwELAQsCQCCEAUEgEKoDIIMBKAIAIb4CIL4CQQFqIb8CIIMBIL8CNgIAIIUBKAIAIcACIMACQQFqIcECIIUBIMECNgIADAMACwALAkAggwEoAgAhwwIghQEoAgAhxAIgwwIgxAJyIcUCIMUCQQBGIcYCIMYCRQRAIH0oAgAhxwIgfigCACHIAiDHAiDIAkYhyQIgyQIEQCCKASCdARCnAQUgxwIgnQEQZyB9KAIAIcoCIMoCQSRqIcsCIH0gywI2AgALIIMBKAIAIcwCIF4oAgAhzgIgzgIgzAJqIc8CIF4gzwI2AgAghQEoAgAh0AIgXygCACHRAiDRAiDQAmoh0gIgXyDSAjYCACDUAUEBEFcgXigCACHTAiCLASDTAjYCACBfKAIAIdQCIIwBINQCNgIAIMkBINQBEGcg1AEQXSCdASDJARCoARogyQEQXQsgZ0EAOgAAIIYBKAIAIdUCIN8BQgA3AgAg3wFBCGpBADYCACDfASDVAhCcAyCIASwAACHWAiDWAkEYdEEYdUEASCHXAiDfASgCACHZAiDXAgR/INkCBSDfAQsh2gIg1gJB/wFxIdsCINsCQYABcSHcAiDcAkEARiHdAiCJASgCACHeAiDdAgR/INsCBSDeAgsh3wIghAEg2gIg3wIQqAMaIN8BEJ8DIIMBKAIAIeACIOACQQFqIeECIIMBIOECNgIAIIYBKAIAIeICIIUBKAIAIeQCIOQCIOICaiHlAiCFASDlAjYCACB9KAIAIeYCIH4oAgAh5wIg5gIg5wJGIegCIOgCBEAgigEgnQEQpwEFIOYCIJ0BEGcgfSgCACHpAiDpAkEkaiHqAiB9IOoCNgIACyCDASgCACHrAiBeKAIAIewCIOwCIOsCaiHtAiBeIO0CNgIAIIUBKAIAIe8CIF8oAgAh8AIg8AIg7wJqIfECIF8g8QI2AgAg9QFBARBXIF4oAgAh8gIgjQEg8gI2AgAgXygCACHzAiCOASDzAjYCACDqASD1ARBnIPUBEF0gnQEg6gEQqAEaIOoBEF0gZ0EBOgAADAIACwALAQsgQkEBaiH0AiD0AiC1AkYh9QIg9QIEQAwDBSD0AiFCCwwAAAsACwsgswEQnwMggwEoAgAhuAIghQEoAgAhuQIguAIguQJyIboCILoCQQBGIbsCILsCRQRAIH0oAgAh9gIgfigCACH3AiD2AiD3AkYh+AIg+AIEQCCKASCdARCnAQUg9gIgnQEQZyB9KAIAIfoCIPoCQSRqIfsCIH0g+wI2AgALIIMBKAIAIfwCIF4oAgAh/QIg/QIg/AJqIf4CIF4g/gI2AgAghQEoAgAh/wIgXygCACGAAyCAAyD/AmohgQMgXyCBAzYCAAsgnQEQXSAjIScgJSEoBSB8QQEQVyBeKAIAIfEBIGMg8QE2AgAgXygCACHyASBkIPIBNgIAIB0g5gVJIfMBIJIBQgA3AgAgkgFBCGpBADYCAAJAIPMBBEAgHSEgIB4hIgNAAkACQAJAAkAgIkEYdEEYdUEJaw4YAAICAgICAgICAgICAgICAgICAgICAgIBAgsBCwwBCwJAIFwsAAAh9AEg9AFBAXEh9gEg9gFBGHRBGHVBAEYh9wEg9wEEQCAgIR8gIiEhDAULAkACQAJAAkAgIkEYdEEYdUEKaw4EAAICAQILAQsMAQsCQCAgIR8gIiEhDAYACwALCwsgIEEBaiH4ASD4ASDmBUkh+QEg+QEEQCDYAiD4ARCnAyH6ASD6ASwAACH7ASD7ASHDBQVBPyHDBQsgkgEgIhCqAyBuLAAAIfwBIPwBQf8BcSH9ASD9AUGAAXEh/gEg/gFBAEYh/wEgbygCACGBAiD/AQR/IP0BBSCBAgshggIgggJBf0chgwIg+QEggwJxIe0FIO0FBEAg+AEhICDDBSEiBSD4ASEfIMMFISEMAwsMAAALAAUgHSEfIB4hIQsLIIcBIJIBEJoDIJIBEJ8DIIcBEJ8DIGMoAgAhhAIgHyCEAmshhQIgUCgCACGGAiCFAiCGAmshhwIgdyCHAjYCACB4QQE2AgAgeUGgJxClAxogfSgCACGIAiB+KAIAIYkCIIgCIIkCRiGKAiCKAgRAIIoBIHwQpwEFIIgCIHwQZyB9KAIAIYwCIIwCQSRqIY0CIH0gjQI2AgALIHcoAgAhjgIgXigCACGPAiCPAiCOAmohkAIgXiCQAjYCACB4KAIAIZECIF8oAgAhkgIgkgIgkQJqIZMCIF8gkwI2AgAgfBBdIB8hJyAhISgLIF8oAgAhggMgggMgSkshgwMggwMEQEHgACH9BQwHBSAnISkgKCEqIIIDIYUDCwUgHSEpIB4hKiDsASGFAwsLIIUDIEpPIYYDICkg5gVPIYcDIIcDIIYDciHwBQJAIPAFBEAgKSEVICohFiCFAyHxAwUCQAJAAkACQAJAAkAgKkEYdEEYdUEJaw4YAgAEBAEEBAQEBAQEBAQEBAQEBAQEBAQDBAsBCwELAQsCQCApIRUgKiEWIIUDIfEDDAQMAgALAAsBCyBlLAAAIYgDIIgDQQFxIYkDIIkDQRh0QRh1QQBGIYoDIIoDBEAgoQJBAhBXIGhBAToAACBeKAIAIbgDIGkguAM2AgAgXygCACG5AyBqILkDNgIAIEoguQNGIboDILcCQgA3AgAgtwJBCGpBADYCAAJAILoDBEAgKSEvICohMQUgKSEwICohMgNAAkACQAJAAkACQAJAIDJBGHRBGHVBCWsOGAIABAQBBAQEBAQEBAQEBAQEBAQEBAQEAwQLAQsBCwELAkAgMCEvIDIhMQwFDAIACwALAQsgMEEBaiG8AyC8AyDmBUkhvQMgvQMEQCDYAiC8AxCnAyG+AyC+AywAACG/AyC/AyHHBQVBPyHHBQsgtwIgMhCqAyBzLAAAIcADIMADQf8BcSHBAyDBA0GAAXEhwgMgwgNBAEYhwwMgdCgCACHEAyDDAwR/IMEDBSDEAwshxQMgXygCACHHAyBKIMcDayHIAyDFAyDIA08hyQMgvAMg5gVPIcoDIMoDIMkDciHyBSDyBQRAILwDIS8gxwUhMQwDBSC8AyEwIMcFITILDAAACwALCyCsAiC3AhCaAyC3AhCfAyCAASwAACHLAyDLA0EYdEEYdUEASCHMAyDMAwRAIH8oAgAhzQMgzQNBABCgASCPAUEANgIABSB/QQAQoAEggAFBADoAAAsgfxCkAyB/IKwCKQIANwIAIH9BCGogrAJBCGooAgA2AgAgrAJCADcCACCsAkEIakEANgIAIKwCEJ8DIC8g5gVJIc4DAkAgzgMEQAJAAkACQAJAAkACQCAxQRh0QRh1QQlrDhgCAAQEAQQEBAQEBAQEBAQEBAQEBAQEBAMECwELAQsBCwJADAQMAgALAAsBCyBfKAIAIc8DIM8DQQBGIdADINADRQRADAYLCwsgaSgCACHSAyAvINIDayHTAyBQKAIAIdQDINMDINQDayHVAyCUASDVAzYCACCAASwAACHWAyDWA0H/AXEh1wMg1wNBgAFxIdgDINgDQQBGIdkDII8BKAIAIdoDINkDBH8g1wMFINoDCyHbAyCVASDbAzYCACB9KAIAId0DIH4oAgAh3gMg3QMg3gNGId8DIN8DBEAgigEgoQIQpwEFIN0DIKECEGcgfSgCACHgAyDgA0EkaiHhAyB9IOEDNgIACyCUASgCACHpAyBeKAIAIeoDIOoDIOkDaiHrAyBeIOsDNgIAIJUBKAIAIewDIF8oAgAh7QMg7QMg7ANqIe4DIF8g7gM2AgAgoQIQXSAvIQ0gMSEOBSCAAkECEFcga0EBOgAAIF4oAgAhiwMgbCCLAzYCACBfKAIAIYwDIG0gjAM2AgAgSiCMA0YhjQMglgJCADcCACCWAkEIakEANgIAAkAgjQMEQCApISsgKiEtBSApISwgKiEuA0ACQAJAAkACQAJAAkAgLkEYdEEYdUEJaw4YAgAEBAEEBAQEBAQEBAQEBAQEBAQEBAQDBAsBCwELAQsCQCAsISsgLiEtDAUMAgALAAsBCyAsQQFqIY4DII4DIOYFSSGQAyCQAwRAINgCII4DEKcDIZEDIJEDLAAAIZIDIJIDIcYFBUE/IcYFCyCWAiAuEKoDIHUsAAAhkwMgkwNB/wFxIZQDIJQDQYABcSGVAyCVA0EARiGWAyB2KAIAIZcDIJYDBH8glAMFIJcDCyGYAyBfKAIAIZkDIEogmQNrIZsDIJgDIJsDTyGcAyCOAyDmBU8hnQMgnQMgnANyIfEFIPEFBEAgjgMhKyDGBSEtDAMFII4DISwgxgUhLgsMAAALAAsLIIsCIJYCEJoDIJYCEJ8DIIIBLAAAIZ4DIJ4DQRh0QRh1QQBIIZ8DIJ8DBEAggQEoAgAhoAMgoANBABCgASCQAUEANgIABSCBAUEAEKABIIIBQQA6AAALIIEBEKQDIIEBIIsCKQIANwIAIIEBQQhqIIsCQQhqKAIANgIAIIsCQgA3AgAgiwJBCGpBADYCACCLAhCfAyBsKAIAIaEDICsgoQNrIaIDIFAoAgAhowMgogMgowNrIaQDIJEBIKQDNgIAIIIBLAAAIaYDIKYDQf8BcSGnAyCnA0GAAXEhqAMgqANBAEYhqQMgkAEoAgAhqgMgqQMEfyCnAwUgqgMLIasDIJMBIKsDNgIAIH0oAgAhrAMgfigCACGtAyCsAyCtA0YhrgMgrgMEQCCKASCAAhCnAQUgrAMggAIQZyB9KAIAIa8DIK8DQSRqIbEDIH0gsQM2AgALIJEBKAIAIbIDIF4oAgAhswMgswMgsgNqIbQDIF4gtAM2AgAgkwEoAgAhtQMgXygCACG2AyC2AyC1A2ohtwMgXyC3AzYCACCAAhBdICshDSAtIQ4LIF8oAgAh7wMg7wMgSksh8AMg8AMEQEGFASH9BQwHBSANIRUgDiEWIO8DIfEDCwsLIPEDIEpHIfMDIBUg5gVJIfQDIPMDIPQDcSH5BSD5BQRAIBUhHSAWIR4FIBUhFyAWIRgMBAsMAQsLIFAoAgAh4gMgaSgCACHjAyDjAyDiA2oh5AMg5AMg5gVJIeUDIOUDBEAg2AIg5AMQpwMh5gMg5gMsAAAh6AMg6AMhDAVBPyEMCyChAhBdIOQDIRcgDCEYBSAbIRcgHCEYCwsgUCgCACH1AyBeKAIAIfYDIPYDIPUDaiH3AyAXIPcDSSH4AyD4AwRAQYgBIf0FDAELIBcg5gVJIfkDAkAg+QMEQCBcLAAAIfoDIPoDQQFxIfsDIPsDQRh0QRh1QQBGIfwDIPwDRQRAIJgBQQE6AAAgFyEZIBghGkEAIb8FDAILAkACQAJAAkAgGEEYdEEYdUEKaw4EAAICAQILAQsCQEEAIfwFDAIACwALQQEh/AULIJgBIPwFOgAAAkACQAJAAkAgGEEYdEEYdUEKaw4EAAICAQILAQsMAQsCQCAXIRkgGCEaQQAhvwUMAwALAAsgF0EBaiH/AyD/AyDmBUkhgAQggAQEQCDYAiD/AxCnAyGBBCCBBCwAACGCBCD/AyEZIIIEIRpBASG/BQUg/wMhGUE/IRpBASG/BQsFIJgBQQA6AAAgFyEZIBghGkEAIb8FCwsgmQEsAAAhgwQggwRBAXEhhAQghARBGHRBGHVBAEYhhQQghQQEQEGVASH9BQUgYCwAACGGBCCGBEEBcSGHBCCHBEEYdEEYdUEARyGIBCCgASCIBHIh6gUg6gUEQCCYASwAACGKBCCKBEEBcSGLBCCLBEEYdEEYdUEARyGMBCAZIOYFSSGNBCCNBCCMBHEh8wUg8wUEQEGVASH9BQsLCwJAIP0FQZUBRgRAQQAh/QUgfSgCACGOBCCKASgCACGPBCCOBCCPBEYhkAQgjgQhkQQgjwQhkgQgkARFBEAgjgQhQwNAAkAgQ0FcaiGTBCCTBCgCACGWBCCWBEEBRiGXBCCXBEUEQAwBCyCTBCCPBEYhlQQglQQEQAwFBSCTBCFDCwwBCwsgQyCOBEYhmAQgmARFBEAgQ0FgaiGZBCCZBCgCACGaBCBDQWRqIZsEIJsEKAIAIZwEIJwEIJoEaiGdBCBeIJ0ENgIAIENBaGohngQgngQoAgAhoAQgQ0FsaiGhBCChBCgCACGiBCCiBCCgBGohowQgXyCjBDYCACBDIaQEIJEEIKQEayGlBCClBEEkbUF/cSGmBCCRBCCSBGshpwQgpwRBJG1Bf3EhqAQgqAQgpgRrIakEIIoBIKkEEKkBCwsLCyBQKAIAIasEIF4oAgAhrAQgrAQgqwRqIa0EIBkgrQRLIa4EIK4EBEBBnQEh/QUFIH0oAgAhrwQgoQEoAgAhsAQgrwQgsARGIbEEILEEBEBBnQEh/QULCyD9BUGdAUYEQEEAIf0FIMICQQAQVyBeKAIAIbIEIJwBILIENgIAIF8oAgAhswQgngEgswQ2AgAgnwFBqNEAEKUDGiCcASgCACG0BCAZILQEayG2BCBQKAIAIbcEILYEILcEayG4BCCkASC4BDYCACClAUEANgIAIH0oAgAhuQQgfigCACG6BCC5BCC6BEYhuwQguwQEQCCKASDCAhCnAQUguQQgwgIQZyB9KAIAIbwEILwEQSRqIb0EIH0gvQQ2AgALIKQBKAIAIb4EIF4oAgAhvwQgvwQgvgRqIcEEIF4gwQQ2AgAgpQEoAgAhwgQgXygCACHDBCDDBCDCBGohxAQgXyDEBDYCACDCAhBdCyAZIOYFTyHFBCDFBCAzciH4BQJAIPgFRQRAIFwsAAAhxgQgxgRBAXEhxwQgxwRBGHRBGHVBAEYhyAQgyAQEQAJAAkACQAJAIBpBGHRBGHVBCmsOBAACAgECCwELAkAMBQwCAAsACwELCyBfKAIAIckEIEogyQRLIcoEIMoEBEAgSiDJBGshzAQgoQEoAgAhzQQgfSgCACHOBCDNBCDOBEYhzwQgzwRFBEBBACELIM0EIT8DQAJAID8oAgAhPCA/QQxqIT0gPSgCACE+IDwgPhCqASHQBCDQBEEBcSHRBCALINEEaiH7BSA/QSRqIdIEINIEIM4ERiHTBCDTBARADAEFIPsFIQsg0gQhPwsMAQsLIPsFQQBGIdQEINQERQRAIMwEQX9qIdUEINUEIPsFbkF/cSHXBCDXBEEBaiHYBEEAIQUgzAQhCiDNBCFAA0ACQCBAQQxqIdkEINkEKAIAIdoEINoEIAVqIdsEINkEINsENgIAIApBAEYh3AQCQCDcBARAIAUhD0EAIRQFIEAoAgAh3QQg3QRBAUch3gQg2wRBAEYh3wQg3wQg3gRyIfQFIPQFBEAgBSEPIAohFAwCCyAKINgESSHgBCDgBAR/IAoFINgECyFEIEBBFGoh4gQg4gRBADoAACBAQRBqIeMEIOMEKAIAIeQEIOQEIERqIeUEIOMEIOUENgIAIM0CQgA3AgAgzQJBCGpBADYCACDNAiBEEJwDIEBBGGoh5gQgrAEsAAAh5wQg5wRBGHRBGHVBAEgh6AQgzQIoAgAh6QQg6AQEfyDpBAUgzQILIeoEIOcEQf8BcSHrBCDrBEGAAXEh7gQg7gRBAEYh7wQgrQEoAgAh8AQg7wQEfyDrBAUg8AQLIfEEIOYEIOoEIPEEEKgDGiDNAhCfAyAFIERqIfIEIAogRGsh8wQgXygCACH0BCD0BCBEaiH1BCBfIPUENgIAIPIEIQ8g8wQhFAsLIEBBJGoh9gQg9gQgzgRGIfcEIPcEBEAMAQUgDyEFIBQhCiD2BCFACwwBCwsLCwsLCyB9KAIAIfkEIKEBKAIAIfoEIPkEIPoERiH7BCD7BARAQbABIf0FDAELIPoEIUEDQAJAIEFBGGoh/AQg/ARBC2oh/QQg/QQsAAAh/gQg/gRBGHRBGHVBAEgh/wQg/wQEQCD8BCgCACGABSCABSGHBQUg/AQhhwULIP4EQf8BcSGBBSCBBUGAAXEhggUgggVBAEYhhAUghAUEQCCBBSGIBQUgQUEcaiGFBSCFBSgCACGGBSCGBSGIBQsgpwEghwUgiAUQqAMaIEFBJGohiQUgiQUg+QRGIYoFIIoFBEAMAQUgiQUhQQsMAQsLIEkoAgAhiwUgiwVBAWohjAUgSSCMBTYCACBYKAIAIY0FIKYBKAIAIY8FII0FII8FRiGQBSCQBQRAIKkBIFAQqwEFII0FIFAQYyBYKAIAIZEFIJEFQSxqIZIFIFggkgU2AgALIEgoAgAhkwUgkwUg2QVqIZQFIKoBKAIAIZUFIFkoAgAhlgUglQUglgVrIZcFIJcFQSxtQX9xIZgFIJQFIJgFRiGaBQJAIJoFBEBBwAEh/QUFIBkgA2ohmwUglAUhnAUDQAJAIFkgnAUQpgEhnQUgnQUoAgAhngUgOywAACGfBSCfBUH/AXEhoAUgoAVBgAFxIaEFIKEFQQBGIaIFIKsBKAIAIaMFIKIFBH8goAUFIKMFCyGlBSClBSCeBWohpgUgpgUgmwVJIacFIEgoAgAhqAUgpwVFBEAMAQsgqAVBAWohqQUgSCCpBTYCACCpBSDZBWohqgUgqgEoAgAhqwUgWSgCACGsBSCrBSCsBWshrQUgrQVBLG1Bf3EhrgUgqgUgrgVGIbAFILAFBEBBwAEh/QUMBAUgqgUhnAULDAELCyCqASgCACE2IFkoAgAhNyCoBSDZBWohOCA2IDdrITkgOUEsbUF/cSE6IDggOkYhsQUgsQUEQEHAASH9BQUgWSA4EKYBIbIFILIFKAIAIbMFIDssAAAhtAUgtAVB/wFxIbUFILUFQYABcSG2BSC2BUEARiG3BSCrASgCACG4BSC3BQR/ILUFBSC4BQshuQUguQUgswVqIbsFIBkgA2ohvAUguwUgvAVHIb0FIBkg5gVJIb4FIL8FIL4FciH1BSD1BSC9BXEh9wUg9wVFBEBBwQEh/QUMBAsLCwsg/QVBwAFGBEBBACH9BSAZIOYFSSE0IL8FIDRyIfYFIPYFRQRAQcEBIf0FDAILCyBQEFwgGSDpBUkhwAUgwAUEQCAZIQYgGiEHBUHDASH9BQwBCwwBCwsg/QVB4ABGBEBBoidBuyVBuwZBoy8QEQUg/QVBhQFGBEBBoidBuyVB7gZBoy8QEQUg/QVBiAFGBEBBzydBuyVB+AZBoy8QEQUg/QVBsAFGBEBBiyhBuyVB1QdBoy8QEQUg/QVBwQFGBEAgUBBcIAEgABCsASD+BSQKDwUg/QVBwwFGBEAgASAAEKwBIP4FJAoPCwsLCwsLCxABAn8jCiEDIAAgAToAAA8LEAECfyMKIQIgABATGhDDAwszAQV/IwohBSAAQQxqIQEgAUEANgIAIABBEGohAiACQQA2AgAgAEEUaiEDIANBADYCAA8L8QEBDn8jCiEPIAAgASkCADcCACAAQQhqIAFBCGopAgA3AgAgAEEQaiABQRBqLgEAOwEAIAFBFGohBSAAQRRqIQYgBkEANgIAIABBGGohByAHQQA2AgAgAEEcaiEIIAhBADYCACAFKAIAIQkgBiAJNgIAIAFBGGohCiAKKAIAIQsgByALNgIAIAFBHGohDCAMKAIAIQIgCCACNgIAIAxBADYCACAKQQA2AgAgBUEANgIAIABBIGohAyABQSBqIQQgAyAEKQIANwIAIANBCGogBEEIaigCADYCACABQSBqIQ0gDUIANwIAIA1BCGpBADYCAA8L8AEBFn8jCiEXIwpBIGokCiMKIwtOBEBBIBADCyAXIQ0gAEEIaiEOIABBBGohDyAPKAIAIRAgACgCACERIBAgEWshEiASQSxtQX9xIRMgE0EBaiEUIBRB3ejFLkshAyADBEAQqwMFIA4oAgAhBCAEIBFrIQUgBUEsbUF/cSEGIAZBrvSiF0khByAGQQF0IQggCCAUSSEJIAkEfyAUBSAICyECIAcEfyACBUHd6MUuCyEVIA0gFSATIA4QswEgDUEIaiEKIAooAgAhCyALIAEQowEgC0EsaiEMIAogDDYCACAAIA0QvAEgDRC2ASAXJAoPCwtGAQN/IwohAyAAQRRqIQEgAEIANwIAIABBCGpCADcCACAAQRBqQQA7AQAgAUIANwIAIAFBCGpCADcCACABQRBqQgA3AgAPC1IBCn8jCiELIABBBGohAiACKAIAIQMgACgCACEEIAQhBSADIAVrIQYgBkEsbUF/cSEHIAcgAUshCCAIBEAgBCABQSxsaiEJIAkPBRCsAwtBAA8L7wEBFn8jCiEXIwpBIGokCiMKIwtOBEBBIBADCyAXIQ0gAEEIaiEOIABBBGohDyAPKAIAIRAgACgCACERIBAgEWshEiASQSRtQX9xIRMgE0EBaiEUIBRBx+PxOEshAyADBEAQqwMFIA4oAgAhBCAEIBFrIQUgBUEkbUF/cSEGIAZB4/G4HEkhByAGQQF0IQggCCAUSSEJIAkEfyAUBSAICyECIAcEfyACBUHH4/E4CyEVIA0gFSATIA4QvwEgDUEIaiEKIAooAgAhCyALIAEQZyALQSRqIQwgCiAMNgIAIAAgDRDBASANEMIBIBckCg8LC90BAQt/IwohDCAAIAEpAgA3AgAgAEEIaiABQQhqKQIANwIAIABBEGogAUEQaigCADYCACAAQRRqIAFBFGosAAA6AAAgAEEYaiEDIANBC2ohBCAELAAAIQUgBUEYdEEYdUEASCEGIAYEQCADKAIAIQcgB0EAEKABIABBHGohCCAIQQA2AgAgAyECBSADQQAQoAEgBEEAOgAAIAMhAgsgAxCkAyABQRhqIQkgAiAJKQIANwIAIAJBCGogCUEIaigCADYCACABQRhqIQogCkIANwIAIApBCGpBADYCACAADwuoAQERfyMKIRIgAEEEaiEJIAkoAgAhCiAAKAIAIQsgCiEMIAshDSAMIA1rIQ4gDkEkbUF/cSEPIA8gAUkhECAQBEAgASAPayEDIAAgAxC9AQ8LIA8gAUshBCAERQRADwsgCyABQSRsaiEFIAUgCkYhBiAGRQRAIAohAgNAAkAgAkFcaiEHIAcQXSAFIAdGIQggCARADAEFIAchAgsMAQsLCyAJIAU2AgAPCyABBX8jCiEGIABBAUYhAiABQQBHIQMgAiADcSEEIAQPC+8BARZ/IwohFyMKQSBqJAojCiMLTgRAQSAQAwsgFyENIABBCGohDiAAQQRqIQ8gDygCACEQIAAoAgAhESAQIBFrIRIgEkEsbUF/cSETIBNBAWohFCAUQd3oxS5LIQMgAwRAEKsDBSAOKAIAIQQgBCARayEFIAVBLG1Bf3EhBiAGQa70ohdJIQcgBkEBdCEIIAggFEkhCSAJBH8gFAUgCAshAiAHBH8gAgVB3ejFLgshFSANIBUgEyAOELMBIA1BCGohCiAKKAIAIQsgCyABEGMgC0EsaiEMIAogDDYCACAAIA0QvAEgDRC2ASAXJAoPCwv5BgFhfyMKIWIgAUEEaiEVIBUoAgAhICAgQQBGISsgAEEsaiE2ICsEQEEAIQcFIABBHGohQSAAQShqIUxBACEDA0ACQCABKAIAIVcgVyADaiFgIDYgYBCmASELIAtBDGohDCAMKAIAIQ0gQSANEEEgC0EQaiEOIA4sAAAhDyAPQQFxIRAgEEEYdEEYdUEARiERIBFFBEAgTCgCACESIBJBf2ohEyBMIBM2AgALIANBAWohFCAVKAIAIRYgFCAWSSEXIBcEQCAUIQMFIBYhBwwBCwwBCwsLIDYoAgAhGCABKAIAIRkgGCAZQSxsaiEaIBogB0EsbGohGyA2IBogGxCuASA2KAIAIRwgASgCACEdIBwgHUEsbGohHiABQQxqIR8gHygCACEhIAFBEGohIiAiKAIAISMgNiAeICEgIxCvASAAQTBqISQgJCgCACElIDYoAgAhJiAlICZGIScgJwRAQaglQbslQf8HQakoEBELIAFBCGohKCAoKAIAISkgKUEARiEqIAEoAgAhLCAqBEAgLCEFQQAhBiAmIUMgJSFEBSAAQRxqIS0gAEEoaiEuQQAhBCAsITADQAJAIDAgBGohLyA2IC8QpgEhMSAxQQxqITIgMigCACEzIC0gMxA/IDFBEGohNCA0LAAAITUgNUEBcSE3IDdBGHRBGHVBAEYhOCA4RQRAIC4oAgAhOSA5QQFqITogLiA6NgIACyAEQQFqITsgKCgCACE8IDsgPEkhPSABKAIAIT4gPQRAIDshBCA+ITAFDAELDAELCyAkKAIAIQggNigCACEJID4hBSA8IQYgCSFDIAghRAsgBSAGaiE/ID9BAUshQCBABH8gPwVBAQshCiBEIENrIUIgQkEsbUF/cSFFIAogRUkhRiBGRQRADwsgCiECA0ACQCACQX9qIUcgNiBHEKYBIUggSCgCACFJIDYgRxCmASFKIEpBBGohSyBLKAIAIU0gTSBJaiFOIDYgAhCmASFPIE8gTjYCACA2IEcQpgEhUCBQQQhqIVEgUSgCACFSIDYgRxCmASFTIFNBDGohVCBUKAIAIVUgVSBSaiFWIDYgAhCmASFYIFhBCGohWSBZIFY2AgAgAkEBaiFaICQoAgAhWyA2KAIAIVwgWyBcayFdIF1BLG1Bf3EhXiBaIF5JIV8gXwRAIFohAgUMAQsMAQsLDwsUAQN/IwohAyAAQQxqIQEgARBeDwvDAQESfyMKIRQgASACRiEIIAgEQA8LIABBBGohCyALKAIAIQwgDCACRiENIA0EQCABIQMgAiESBSABIQQgAiEGA0ACQCAEIAYQugEaIAZBLGohDiAEQSxqIQ8gDiAMRiEQIBAEQAwBBSAPIQQgDiEGCwwBCwsgCygCACEHIA8hAyAHIRILIAMgEkYhESARRQRAIBIhBQNAAkAgBUFUaiEJIAkQXCADIAlGIQogCgRADAEFIAkhBQsMAQsLCyALIAM2AgAPC/QDAS1/IwohMCMKQSBqJAojCiMLTgRAQSAQAwsgMCEJIAAoAgAhFCABIR8gAyEoIAIhKSAoIClrISogKkEsbUF/cSErICpBAEohLCAsRQRAIDAkCg8LIABBCGohLSAtKAIAIQogAEEEaiELIAsoAgAhDCAMIQ0gCiANayEOIA5BLG1Bf3EhDyArIA9KIRAgEARAIA0gFGshHCAcQSxtQX9xIR0gHSAraiEeIB5B3ejFLkshICAgBEAQqwMLIAogFGshISAhQSxtQX9xISIgIkGu9KIXSSEjICJBAXQhJCAkIB5JISUgJQR/IB4FICQLIQggIwR/IAgFQd3oxS4LIS4gHyAUayEmICZBLG1Bf3EhJyAJIC4gJyAtELMBIAkgAiADELQBIAAgCSABELUBGiAJELYBIDAkCg8LIA0gH2shESARQSxtQX9xIRIgKyASSiETIAIgEkEsbGohFSATBEAgACAVIAMQsAEgEiEEIBUhBwUgKyEEIAMhBwsgBEEASiEWIBZFBEAgMCQKDwsgASArQSxsaiEXIAAgASAMIBcQsQEgByACRiEYIBgEQCAwJAoPCyABIQUgAiEGA0ACQCAFIAYQsgEaIAZBLGohGSAFQSxqIRogGSAHRiEbIBsEQAwBBSAaIQUgGSEGCwwBCwsgMCQKDwttAQt/IwohDSAAQQRqIQUgASACRiEGIAYEQA8LIAUoAgAhAyABIQQgAyEHA0ACQCAHIAQQYyAEQSxqIQggBSgCACEJIAlBLGohCiAFIAo2AgAgCCACRiELIAsEQAwBBSAIIQQgCiEHCwwBCwsPC9oBARZ/IwohGSAAQQRqIRIgEigCACETIBMhFCADIRUgFCAVayEWIBZBLG1Bf3EhFyABIBdBLGxqIQcgByACSSEIIAgEQCAHIQYgEyEJA0ACQCAJIAYQowEgBkEsaiEKIBIoAgAhCyALQSxqIQwgEiAMNgIAIAogAkkhDSANBEAgCiEGIAwhCQUMAQsMAQsLCyAWQQBGIQ4gDgRADwsgByEEIBMhBQNAAkAgBEFUaiEPIAVBVGohECAQIA8QugEaIA8gAUYhESARBEAMAQUgDyEEIBAhBQsMAQsLDwuEAQEKfyMKIQsgACABKQIANwIAIABBCGogAUEIaikCADcCACAAQRBqIAFBEGouAQA7AQAgACABRiECIAJFBEAgAEEUaiEDIAFBFGohBCAEKAIAIQUgAUEYaiEGIAYoAgAhByADIAUgBxC3AQsgAEEgaiEIIAFBIGohCSAIIAkQoAMaIAAPC7oBAQ5/IwohESAAQQxqIQogCkEANgIAIABBEGohCyALIAM2AgAgAUEARiEMAkAgDARAQQAhBQUgAUHd6MUuSyENIA0EQEEIEBIhDiAOQa8oEJcDIA5BvCQ2AgAgDkHAHkESEBQFIAFBLGwhDyAPEJMDIQQgBCEFDAILCwsgACAFNgIAIAUgAkEsbGohBiAAQQhqIQcgByAGNgIAIABBBGohCCAIIAY2AgAgBSABQSxsaiEJIAogCTYCAA8LbQELfyMKIQ0gASACRiEEIAQEQA8LIABBCGohBSAFKAIAIQMgAyEGIAEhBwNAAkAgBiAHEGMgBSgCACEIIAhBLGohCSAFIAk2AgAgB0EsaiEKIAogAkYhCyALBEAMAQUgCSEGIAohBwsMAQsLDwv9AgElfyMKIScgACgCACEdIABBCGohICAAQQRqISEgAUEEaiEiICIoAgAhIyAdIAJGISQgJARAICMhBQUgAiEEICMhCQNAAkAgCUFUaiElIARBVGohCiAlIAoQowEgIigCACELIAtBVGohDCAiIAw2AgAgCiAdRiENIA0EQCAMIQUMAQUgCiEEIAwhCQsMAQsLCyAhKAIAIQ4gAUEIaiEPIA4gAkYhECAQBEAgBSERICIhByARIRgFIA8oAgAhBiACIQMgBiESA0ACQCASIAMQowEgA0EsaiETIA8oAgAhFCAUQSxqIRUgDyAVNgIAIBMgDkYhFiAWBEAMAQUgEyEDIBUhEgsMAQsLICIoAgAhCCAiIQcgCCEYCyAAKAIAIRcgACAYNgIAIAcgFzYCACAhKAIAIRkgDygCACEaICEgGjYCACAPIBk2AgAgAUEMaiEbICAoAgAhHCAbKAIAIR4gICAeNgIAIBsgHDYCACAHKAIAIR8gASAfNgIAICMPC4MBAQ1/IwohDSAAQQRqIQEgASgCACEEIABBCGohBSAFKAIAIQYgBCAGRiEHIAdFBEAgBiEJA0ACQCAJQVRqIQggBSAINgIAIAgQXCAFKAIAIQogBCAKRiELIAsEQAwBBSAKIQkLDAELCwsgACgCACECIAJBAEYhAyADBEAPCyACEJQDDwuxAwEqfyMKISwgAiEcIAEhIyAcICNrISQgJEEkbUF/cSElIABBCGohJiAmKAIAIScgACgCACEoICcgKGshCCAIQSRtQX9xIQkgJSAJSyEKICghCyAKBEAgABC5ASAlQcfj8ThLIRogGgRAEKsDCyAmKAIAIRsgACgCACEdIBsgHWshHiAeQSRtQX9xIR8gH0Hj8bgcSSEgIB9BAXQhISAhICVJISIgIgR/ICUFICELIQcgIAR/IAcFQcfj8TgLISogACAqEGUgACABIAIQZg8LIABBBGohDCAMKAIAIQ0gDSAoayEOIA5BJG1Bf3EhDyAlIA9LIRAgASAPQSRsaiERIBAEfyARBSACCyEpICkgAUYhEiASBEAgCyEEBSABIQMgCyEFA0ACQCAFIAMQuAEaIANBJGohEyAFQSRqIRQgEyApRiEVIBUEQCAUIQQMAQUgEyEDIBQhBQsMAQsLCyAQBEAgACApIAIQZg8LIAwoAgAhFiAEIBZGIRcgF0UEQCAWIQYDQAJAIAZBXGohGCAYEF0gBCAYRiEZIBkEQAwBBSAYIQYLDAELCwsgDCAENgIADwtbAQR/IwohBSAAIAEpAgA3AgAgAEEIaiABQQhqKQIANwIAIABBEGogAUEQaigCADYCACAAQRRqIAFBFGosAAA6AAAgAEEYaiECIAFBGGohAyACIAMQoAMaIAAPC5kBAQ1/IwohDSAAKAIAIQMgA0EARiEEIAQEQA8LIABBBGohBSAFKAIAIQYgAyAGRiEHIAcEQCADIQsFIAYhAQNAAkAgAUFcaiEIIAgQXSADIAhGIQkgCQRADAEFIAghAQsMAQsLIAAoAgAhAiACIQsLIAUgAzYCACAAQQhqIQogCxCUAyAKQQA2AgAgBUEANgIAIABBADYCAA8L4gEBDX8jCiEOIAAgASkCADcCACAAQQhqIAFBCGopAgA3AgAgAEEQaiABQRBqLgEAOwEAIABBFGohBCABQRRqIQUgBCAFELsBIABBIGohBiAGQQtqIQcgBywAACEIIAhBGHRBGHVBAEghCSAJBEAgBigCACEKIApBABCgASAAQSRqIQsgC0EANgIAIAYhAgUgBkEAEKABIAdBADoAACAGIQILIAYQpAMgAUEgaiEDIAIgAykCADcCACACQQhqIANBCGooAgA2AgAgAUEgaiEMIAxCADcCACAMQQhqQQA2AgAgAA8LaQEJfyMKIQogABC5ASAAQQhqIQIgASgCACEDIAAgAzYCACABQQRqIQQgBCgCACEFIABBBGohBiAGIAU2AgAgAUEIaiEHIAcoAgAhCCACIAg2AgAgB0EANgIAIARBADYCACABQQA2AgAPC6kCAR9/IwohICAAKAIAIRIgAEEIaiEYIABBBGohGSAZKAIAIRogAUEEaiEbIBogEkYhHCAcBEAgEiEdIBsoAgAhByAbIQQgACEFIAchDiAdIQ8FIBsoAgAhAyAaIQIgAyEIA0ACQCAIQVRqIR4gAkFUaiEJIB4gCRCjASAbKAIAIQogCkFUaiELIBsgCzYCACAJIBJGIQwgDARADAEFIAkhAiALIQgLDAELCyALIQ0gACgCACEGIBshBCAAIQUgDSEOIAYhDwsgBSAONgIAIAQgDzYCACABQQhqIRAgGSgCACERIBAoAgAhEyAZIBM2AgAgECARNgIAIAFBDGohFCAYKAIAIRUgFCgCACEWIBggFjYCACAUIBU2AgAgBCgCACEXIAEgFzYCAA8L/QEBFn8jCiEXIwpBIGokCiMKIwtOBEBBIBADCyAXIQ0gAEEIaiEOIA4oAgAhDyAAQQRqIRAgECgCACERIA8gEWshEiASQSRtQX9xIRMgEyABSSEUIBRFBEAgACABEL4BIBckCg8LIAAoAgAhAyARIANrIQQgBEEkbUF/cSEFIAUgAWohBiAGQcfj8ThLIQcgBwRAEKsDCyAPIANrIQggCEEkbUF/cSEJIAlB4/G4HEkhCiAJQQF0IQsgCyAGSSEMIAwEfyAGBSALCyECIAoEfyACBUHH4/E4CyEVIA0gFSAFIA4QvwEgDSABEMABIAAgDRDBASANEMIBIBckCg8LXwEKfyMKIQsgAEEEaiEEIAQoAgAhAyABIQIgAyEFA0ACQCAFEMQBIAQoAgAhBiAGQSRqIQcgBCAHNgIAIAJBf2ohCCAIQQBGIQkgCQRADAEFIAghAiAHIQULDAELCw8LugEBDn8jCiERIABBDGohCiAKQQA2AgAgAEEQaiELIAsgAzYCACABQQBGIQwCQCAMBEBBACEFBSABQcfj8ThLIQ0gDQRAQQgQEiEOIA5BrygQlwMgDkG8JDYCACAOQcAeQRIQFAUgAUEkbCEPIA8QkwMhBCAEIQUMAgsLCyAAIAU2AgAgBSACQSRsaiEGIABBCGohByAHIAY2AgAgAEEEaiEIIAggBjYCACAFIAFBJGxqIQkgCiAJNgIADwtfAQp/IwohCyAAQQhqIQQgBCgCACEDIAEhAiADIQUDQAJAIAUQxAEgBCgCACEGIAZBJGohByAEIAc2AgAgAkF/aiEIIAhBAEYhCSAJBEAMAQUgCCECIAchBQsMAQsLDwupAgEffyMKISAgACgCACESIABBCGohGCAAQQRqIRkgGSgCACEaIAFBBGohGyAaIBJGIRwgHARAIBIhHSAbKAIAIQcgGyEEIAAhBSAHIQ4gHSEPBSAbKAIAIQMgGiECIAMhCANAAkAgCEFcaiEeIAJBXGohCSAeIAkQwwEgGygCACEKIApBXGohCyAbIAs2AgAgCSASRiEMIAwEQAwBBSAJIQIgCyEICwwBCwsgCyENIAAoAgAhBiAbIQQgACEFIA0hDiAGIQ8LIAUgDjYCACAEIA82AgAgAUEIaiEQIBkoAgAhESAQKAIAIRMgGSATNgIAIBAgETYCACABQQxqIRQgGCgCACEVIBQoAgAhFiAYIBY2AgAgFCAVNgIAIAQoAgAhFyABIBc2AgAPC4MBAQ1/IwohDSAAQQRqIQEgASgCACEEIABBCGohBSAFKAIAIQYgBCAGRiEHIAdFBEAgBiEJA0ACQCAJQVxqIQggBSAINgIAIAgQXSAFKAIAIQogBCAKRiELIAsEQAwBBSAKIQkLDAELCwsgACgCACECIAJBAEYhAyADBEAPCyACEJQDDwuDAQEFfyMKIQYgACABKQIANwIAIABBCGogAUEIaikCADcCACAAQRBqIAFBEGooAgA2AgAgAEEUaiABQRRqLAAAOgAAIABBGGohAiABQRhqIQMgAiADKQIANwIAIAJBCGogA0EIaigCADYCACABQRhqIQQgBEIANwIAIARBCGpBADYCAA8LRgEDfyMKIQMgAEEYaiEBIABCADcCACAAQQhqQgA3AgAgAEEQakEANgIAIABBFGpBADoAACABQgA3AgAgAUEIakEANgIADwtXAQR/IwohBSMKQRBqJAojCiMLTgRAQRAQAwsgBSECIAJCADcCACACQQhqQQA2AgBBqNEAEMYBIQMgAkGo0QAgAxCbAyAAIAEgAhDHASACEJ8DIAUkCg8LEgEDfyMKIQMgABCKAyEBIAEPC5QBARB/IwohEiABQTBqIQogCigCACELIAFBLGohDCAMKAIAIQ0gCyANRiEOIA4EQEGoJUG7JUH/BEGZLxARCyABQRBqIQ8gD0ELaiEQIBAsAAAhAyADQf8BcSEEIARBgAFxIQUgBUEARiEGIAYEQCAEIQkFIAFBFGohByAHKAIAIQggCCEJCyAAIAFBACAJIAIQnwEPC34BDH8jCiEMIAAoAgAhAyADQQBGIQQgBARADwsgAEEEaiEFIAUoAgAhBiADIAZGIQcgBwRAIAMhCgUgBiEBA0ACQCABQXRqIQggCBCfAyADIAhGIQkgCQRADAEFIAghAQsMAQsLIAAoAgAhAiACIQoLIAUgAzYCACAKEJQDDwu7AQEOfyMKIREgAEEMaiEKIApBADYCACAAQRBqIQsgCyADNgIAIAFBAEYhDAJAIAwEQEEAIQUFIAFB1arVqgFLIQ0gDQRAQQgQEiEOIA5BrygQlwMgDkG8JDYCACAOQcAeQRIQFAUgAUEMbCEPIA8QkwMhBCAEIQUMAgsLCyAAIAU2AgAgBSACQQxsaiEGIABBCGohByAHIAY2AgAgAEEEaiEIIAggBjYCACAFIAFBDGxqIQkgCiAJNgIADwuEAQENfyMKIQ0gAEEEaiEBIAEoAgAhBCAAQQhqIQUgBSgCACEGIAQgBkYhByAHRQRAIAYhCQNAAkAgCUF0aiEIIAUgCDYCACAIEJ8DIAUoAgAhCiAEIApGIQsgCwRADAEFIAohCQsMAQsLCyAAKAIAIQIgAkEARiEDIAMEQA8LIAIQlAMPCwwBAn8jCiEBEMwBDwsMAQJ/IwohARDNAQ8L4hYBkwF/IwohkgEjCkGAA2okCiMKIwtOBEBBgAMQAwsgkgFB8AJqITcgkgFB6AJqITggkgFB4AJqIUMgkgFB2AJqIU4gkgFB0AJqIVkgkgFByAJqIWQgkgFBwAJqIW8gkgFBuAJqIXogkgFBsAJqIYUBIJIBQagCaiGQASCSAUGgAmohOSCSAUGYAmohOiCSAUGQAmohOyCSAUGIAmohPCCSAUGAAmohPSCSAUH4AWohPiCSAUHwAWohPyCSAUHoAWohQCCSAUHgAWohQSCSAUHYAWohQiCSAUHQAWohRCCSAUHIAWohRSCSAUHAAWohRiCSAUG4AWohRyCSAUGwAWohSCCSAUGoAWohSSCSAUGgAWohSiCSAUGYAWohSyCSAUGQAWohTCCSAUGIAWohTSCSAUGAAWohTyCSAUH4AGohUCCSAUHwAGohUSCSAUHoAGohUiCSAUHgAGohUyCSAUHYAGohVCCSAUHQAGohVSCSAUHIAGohViCSAUHAAGohVyCSAUE4aiFYIJIBQTBqIVogkgFBKGohWyCSAUEgaiFcIJIBQRhqIV0gkgFBEGohXiCSAUEIaiFfIJIBIWAQzgEQzwEQ0AEQ0QEQ0gEQ0wFBrSlBABDUAUG5KUEEENQBQcopQQgQ1AEQ1QEQ1gFB4ilBABDXAUHkKUEEENcBENgBQdgbQagbQeAbQQBBjjFBHkGMMUEAQYwxQQBB5ilBiTFBHxAfQdgbQQFBqCFBjjFBIEEhECAgXEEiNgIAIFxBBGohCCAIQQA2AgAgXBDdASFhQdgbQfEpQQJBoCFBhTFBIyBhQQAQISBbQSQ2AgAgW0EEaiEJIAlBADYCACBbEN0BIWJB2BtB/ClBAkGgIUGFMUEjIGJBABAhIFpBJTYCACBaQQRqIQogCkEANgIAIFoQ3wEhY0HYG0GIKkECQZghQYUxQSYgY0EAECEgWEEnNgIAIFhBBGohCyALQQA2AgAgWBDfASFlQdgbQZQqQQJBmCFBhTFBJiBlQQAQISBXQSg2AgAgV0EEaiEMIAxBADYCACBXEN8BIWZB2BtBqypBAkGYIUGFMUEmIGZBABAhIFZBKTYCACBWQQRqIQ0gDUEANgIAIFYQ3wEhZ0HYG0HEKkECQZghQYUxQSYgZ0EAECEgVUEqNgIAIFVBBGohDiAOQQA2AgAgVRDfASFoQdgbQd4qQQJBmCFBhTFBJiBoQQAQISBUQSs2AgAgVEEEaiEPIA9BADYCACBUEN8BIWlB2BtB8SpBAkGYIUGFMUEmIGlBABAhIFNBLDYCACBTQQRqIRAgEEEANgIAIFMQ3wEhakHYG0GDK0ECQZghQYUxQSYgakEAECEgUkEtNgIAIFJBBGohESARQQA2AgAgUhDhASFrQdgbQZIrQQNBjCFBgDFBLiBrQQAQISBRQS82AgAgUUEEaiESIBJBADYCACBREOEBIWxB2BtBnStBA0GMIUGAMUEuIGxBABAhIFBBMDYCACBQQQRqIRMgE0EANgIAIFAQ4wEhbUHYG0GpK0EDQYAhQYAxQTEgbUEAECEgT0EyNgIAIE9BBGohFCAUQQA2AgAgTxDjASFuQdgbQbUrQQNBgCFBgDFBMSBuQQAQISBNQTM2AgAgTUEEaiEVIBVBADYCACBNEOMBIXBB2BtBzCtBA0GAIUGAMUExIHBBABAhIExBNDYCACBMQQRqIRYgFkEANgIAIEwQ4wEhcUHYG0HlK0EDQYAhQYAxQTEgcUEAECEgS0E1NgIAIEtBBGohFyAXQQA2AgAgSxDjASFyQdgbQf8rQQNBgCFBgDFBMSByQQAQISBKQTY2AgAgSkEEaiEYIBhBADYCACBKEOMBIXNB2BtBkixBA0GAIUGAMUExIHNBABAhIElBNzYCACBJQQRqIRkgGUEANgIAIEkQ4wEhdEHYG0GkLEEDQYAhQYAxQTEgdEEAECEgSEE4NgIAIEhBBGohGiAaQQA2AgAgSBDdASF1QdgbQbMsQQJBoCFBhTFBIyB1QQAQISBHQTk2AgAgR0EEaiEbIBtBADYCACBHEN0BIXZB2BtBvyxBAkGgIUGFMUEjIHZBABAhIEZBOjYCACBGQQRqIRwgHEEANgIAIEYQ3QEhd0HYG0HOLEECQaAhQYUxQSMgd0EAECEgRUE7NgIAIEVBBGohHSAdQQA2AgAgRRDdASF4QdgbQd8sQQJBoCFBhTFBIyB4QQAQISBEQTw2AgAgREEEaiEeIB5BADYCACBEEOUBIXlB2BtB9CxBAkH4IEGFMUE9IHlBABAhIEJBPjYCACBCQQRqIR8gH0EANgIAIEIQ5QEhe0HYG0GFLUECQfggQYUxQT0ge0EAECEgQUE/NgIAIEFBBGohICAgQQA2AgAgQRDnASF8QdgbQZUtQQNB7CBBgDFBwAAgfEEAECEgQEHBADYCACBAQQRqISEgIUEANgIAIEAQ6QEhfUHYG0GiLUECQeQgQYUxQcIAIH1BABAhID9BwwA2AgAgP0EEaiEiICJBADYCACA/EOsBIX5B2BtBrC1BAkHcIEGFMUHEACB+QQAQISA+QcUANgIAID5BBGohIyAjQQA2AgAgPhDtASF/QdgbQbQtQQNB0CBBgDFBxgAgf0EAECEgPUHHADYCACA9QQRqISQgJEEANgIAID0Q7wEhgAFB2BtBvC1BA0HEIEGAMUHIACCAAUEAECEgPEHJADYCACA8QQRqISUgJUEANgIAIDwQ8QEhgQFB2BtBzS1BA0G4IEGAMUHKACCBAUEAECEgO0HLADYCACA7QQRqISYgJkEANgIAIDsQ8QEhggFB2BtB3S1BA0G4IEGAMUHKACCCAUEAECEgXUHMAEEAEPMBIF0oAgAhAyBdQQRqIQcgBygCACE2IDogAzYCACA6QQRqIScgJyA2NgIAIDoQ8QEhgwFB2BtB7i1BA0G4IEGAMUHKACCDAUEAECEgXkHNAEEAEPQBIF4oAgAhAiBeQQRqIQYgBigCACE1IDkgAjYCACA5QQRqISggKCA1NgIAIDkQ9QEhhAFB2BtB7i1BBEGgCEHgMEHOACCEAUEAECEgX0HPAEEAEPMBIF8oAgAhASBfQQRqIQUgBSgCACE0IJABIAE2AgAgkAFBBGohKSApIDQ2AgAgkAEQ8QEhhgFB2BtB/y1BA0G4IEGAMUHKACCGAUEAECEgYEHQAEEAEPQBIGAoAgAhACBgQQRqIQQgBCgCACEzIIUBIAA2AgAghQFBBGohKiAqIDM2AgAghQEQ9QEhhwFB2BtB/y1BBEGgCEHgMEHOACCHAUEAECEgekHRADYCACB6QQRqISsgK0EANgIAIHoQ9wEhiAFB2BtBkC5BA0GsIEGAMUHSACCIAUEAECEgb0HTADYCACBvQQRqISwgLEEANgIAIG8Q9wEhiQFB2BtBqC5BA0GsIEGAMUHSACCJAUEAECEgZEHUADYCACBkQQRqIS0gLUEANgIAIGQQ+QEhigFB2BtBwC5BA0GgIEGAMUHVACCKAUEAECEgWUHWADYCACBZQQRqIS4gLkEANgIAIFkQ+wEhiwFB2BtB3S5BA0GUIEGAMUHXACCLAUEAECEgTkHYADYCACBOQQRqIS8gL0EANgIAIE4Q/QEhjAFB2BtB+i5BAkGMIEGFMUHZACCMAUEAECEgQ0HaADYCACBDQQRqITAgMEEANgIAIEMQ/QEhjQFB2BtBjS9BAkGMIEGFMUHZACCNAUEAECEgOEHbADYCACA4QQRqITEgMUEANgIAIDgQ/wEhjgFB2BtBmS9BA0GAIEGAMUHcACCOAUEAECEgN0HdADYCACA3QQRqITIgMkEANgIAIDcQgQIhjwFB2BtBoy9BBUGACEGwL0HeACCPAUEAECEgkgEkCg8L4QIBD38jCiEOIwpBIGokCiMKIwtOBEBBIBADCyAOQRxqIQMgDkEYaiEEIA5BEGohBSAOQQhqIQYgDiEHQYAcQdAcQcAcQQBBjjFB3wBBjDFBAEGMMUEAQfMoQYkxQeAAEB9BgBxBAUHMIUGOMUHhAEHiABAgIAdB4wA2AgAgB0EEaiEAIABBADYCACAHEKoCIQhBgBxBmDFBA0HAIUGRMUHkACAIQQAQISAGQeUANgIAIAZBBGohASABQQA2AgAgBhCtAiEJQYAcQaIxQQRBwAhB+jNB5gAgCUEAECEgBUHnADYCACAFQQRqIQIgAkEANgIAIAUQsAIhCkGAHEGpMUECQbghQYUxQegAIApBABAhIARB6QA2AgAgBBCzAiELQYAcQa4xQQNBrCFBgDFB6gAgC0EAECEgA0HrADYCACADELYCIQxBgBxBsjFBBEGwCEHgMEHsACAMQQAQISAOJAoPCx0BAn8jCiEBQfgbQYUpQZYxQe0AQYkxQe4AECgPC1QBBX8jCiEEIwpBEGokCiMKIwtOBEBBEBADCyAEIQAgAEEANgIAIAAQnwIhASAAEJ8CIQJB+BtB8BtBhTFB7wAgAUHwG0GRMUHwACACECkgBCQKDwtUAQV/IwohBCMKQRBqJAojCiMLTgRAQRAQAwsgBCEAIABBCDYCACAAEJwCIQEgABCcAiECQfgbQZAfQYUxQfEAIAFBkB9BkTFB8gAgAhApIAQkCg8LDgECfyMKIQFB+BsQHA8LHQECfyMKIQFBoBtBnylBljFB8wBBiTFB9AAQKg8LVgEFfyMKIQYjCkEQaiQKIwojC04EQEEQEAMLIAYhAiACIAE2AgAgAhCXAiEDIAIQlwIhBEGgGyAAQcgfQYUxQfUAIANByB9BkTFB9gAgBBArIAYkCg8LDgECfyMKIQFBoBsQHQ8LHQECfyMKIQFB8BtB2SlBljFB9wBBiTFB+AAQKg8LVgEFfyMKIQYjCkEQaiQKIwojC04EQEEQEAMLIAYhAiACIAE2AgAgAhCSAiEDIAIQkgIhBEHwGyAAQcgfQYUxQfkAIANByB9BkTFB+gAgBBArIAYkCg8LDgECfyMKIQFB8BsQHQ8LDAECfyMKIQJB2BsPCyABA38jCiEDIABBAEYhASABBEAPCyAAEJECIAAQlAMPCyABBH8jCiEEIABB/wBxQQBqEQAAIQEgARCQAiECIAIPCxYBA38jCiECQTgQkwMhACAAEFYgAA8LPAEHfyMKIQdBCBCTAyEFIAAoAgAhAyAAQQRqIQEgASgCACEEIAUgAzYCACAFQQRqIQIgAiAENgIAIAUPC4IBARF/IwohEiABEIgCIQkgACgCACEDIABBBGohAiACKAIAIQQgBEEBdSEKIAEgCmohCyAEQQFxIQwgDEEARiENIA0EQCADIQUgBSEGBSALKAIAIQ4gDiADaiEPIA8oAgAhECAQIQYLIAsgBkH/AHFBgAFqEQEAIQcgBxCKAiEIIAgPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwuCAQERfyMKIRIgARCIAiEJIAAoAgAhAyAAQQRqIQIgAigCACEEIARBAXUhCiABIApqIQsgBEEBcSEMIAxBAEYhDSANBEAgAyEFIAUhBgUgCygCACEOIA4gA2ohDyAPKAIAIRAgECEGCyALIAZB/wBxQYABahEBACEHIAcQjgIhCCAIDws8AQd/IwohB0EIEJMDIQUgACgCACEDIABBBGohASABKAIAIQQgBSADNgIAIAVBBGohAiACIAQ2AgAgBQ8LiwEBEn8jCiEUIAEQgwIhDCAAKAIAIQQgAEEEaiEDIAMoAgAhBSAFQQF1IQ0gASANaiEOIAVBAXEhDyAPQQBGIRAgEARAIAQhByAHIQkFIA4oAgAhESARIARqIRIgEigCACEGIAYhCQsgAhCEAiEIIA4gCCAJQf8AcUGAAmoRAgAhCiAKEI4CIQsgCw8LPAEHfyMKIQdBCBCTAyEFIAAoAgAhAyAAQQRqIQEgASgCACEEIAUgAzYCACAFQQRqIQIgAiAENgIAIAUPC4sBARJ/IwohFCABEIMCIQwgACgCACEEIABBBGohAyADKAIAIQUgBUEBdSENIAEgDWohDiAFQQFxIQ8gD0EARiEQIBAEQCAEIQcgByEJBSAOKAIAIREgESAEaiESIBIoAgAhBiAGIQkLIAIQjwIhCCAOIAggCUH/AHFBgAJqEQIAIQogChCOAiELIAsPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwudAQERfyMKIRIjCkEQaiQKIwojC04EQEEQEAMLIBIhCSABEIgCIQogACgCACEDIABBBGohAiACKAIAIQQgBEEBdSELIAEgC2ohDCAEQQFxIQ0gDUEARiEOIA4EQCADIQYgBiEHBSAMKAIAIQ8gDyADaiEQIBAoAgAhBSAFIQcLIAkgDCAHQf8AcUGACGoRAwAgCRCLAiEIIBIkCiAIDws8AQd/IwohB0EIEJMDIQUgACgCACEDIABBBGohASABKAIAIQQgBSADNgIAIAVBBGohAiACIAQ2AgAgBQ8LiwEBEn8jCiEUIAEQiAIhDCAAKAIAIQQgAEEEaiEDIAMoAgAhBSAFQQF1IQ0gASANaiEOIAVBAXEhDyAPQQBGIRAgEARAIAQhByAHIQkFIA4oAgAhESARIARqIRIgEigCACEGIAYhCQsgAhCEAiEIIA4gCCAJQf8AcUGAAmoRAgAhCiAKEI4CIQsgCw8LPAEHfyMKIQdBCBCTAyEFIAAoAgAhAyAAQQRqIQEgASgCACEEIAUgAzYCACAFQQRqIQIgAiAENgIAIAUPC4IBARF/IwohEiABEIgCIQkgACgCACEDIABBBGohAiACKAIAIQQgBEEBdSEKIAEgCmohCyAEQQFxIQwgDEEARiENIA0EQCADIQUgBSEGBSALKAIAIQ4gDiADaiEPIA8oAgAhECAQIQYLIAsgBkH/AHFBgAFqEQEAIQcgBxCNAiEIIAgPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwuiAQERfyMKIRIjCkEQaiQKIwojC04EQEEQEAMLIBIhCSABEIgCIQogACgCACEDIABBBGohAiACKAIAIQQgBEEBdSELIAEgC2ohDCAEQQFxIQ0gDUEARiEOIA4EQCADIQYgBiEHBSAMKAIAIQ8gDyADaiEQIBAoAgAhBSAFIQcLIAkgDCAHQf8AcUGACGoRAwAgCRCNAiEIIAkQnwMgEiQKIAgPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwuLAQESfyMKIRQgARCIAiEMIAAoAgAhBCAAQQRqIQMgAygCACEFIAVBAXUhDSABIA1qIQ4gBUEBcSEPIA9BAEYhECAQBEAgBCEHIAchCQUgDigCACERIBEgBGohEiASKAIAIQYgBiEJCyACEIQCIQggDiAIIAlB/wBxQYACahECACEKIAoQjQIhCyALDws8AQd/IwohB0EIEJMDIQUgACgCACEDIABBBGohASABKAIAIQQgBSADNgIAIAVBBGohAiACIAQ2AgAgBQ8LzgECFH8BfiMKIRYjCkEgaiQKIwojC04EQEEgEAMLIBZBEGohFCAWQQhqIQ0gFiEOIAEQiAIhDyAAKAIAIQQgAEEEaiEDIAMoAgAhBSAFQQF1IRAgASAQaiERIAVBAXEhEiASQQBGIRMgEwRAIAQhCSAJIQsFIBEoAgAhBiAGIARqIQcgBygCACEIIAghCwsgAhCJAiEKIAIpAgAhFyAOIBc3AwAgFCAOKQIANwIAIA0gESAUIAtB/wBxQYAJahEEACANEIsCIQwgFiQKIAwPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwvOAQIUfwF+IwohFiMKQSBqJAojCiMLTgRAQSAQAwsgFkEYaiEUIBZBCGohDSAWIQ4gARCIAiEPIAAoAgAhBCAAQQRqIQMgAygCACEFIAVBAXUhECABIBBqIREgBUEBcSESIBJBAEYhEyATBEAgBCEJIAkhCwUgESgCACEGIAYgBGohByAHKAIAIQggCCELCyACEIkCIQogAikCACEXIA4gFzcDACAUIA4pAgA3AgAgDSARIBQgC0H/AHFBgAlqEQQAIA0QjAIhDCAWJAogDA8LHgEDfyMKIQUgACABNgIAIABBBGohAyADIAI2AgAPCx4BA38jCiEFIAAgATYCACAAQQRqIQMgAyACNgIADws8AQd/IwohB0EIEJMDIQUgACgCACEDIABBBGohASABKAIAIQQgBSADNgIAIAVBBGohAiACIAQ2AgAgBQ8L1wECFX8BfiMKIRgjCkEgaiQKIwojC04EQEEgEAMLIBhBGGohFiAYQQhqIRAgGCERIAEQiAIhEiAAKAIAIQUgAEEEaiEEIAQoAgAhBiAGQQF1IRMgASATaiEUIAZBAXEhFSAVQQBGIQcgBwRAIAUhCyALIQ4FIBQoAgAhCCAIIAVqIQkgCSgCACEKIAohDgsgAhCJAiEMIAIpAgAhGSARIBk3AwAgAxCEAiENIBYgESkCADcCACAQIBQgFiANIA5B/wBxQYAKahEFACAQEIwCIQ8gGCQKIA8PCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwuLAQESfyMKIRQgARCIAiEMIAAoAgAhBCAAQQRqIQMgAygCACEFIAVBAXUhDSABIA1qIQ4gBUEBcSEPIA9BAEYhECAQBEAgBCEHIAchCQUgDigCACERIBEgBGohEiASKAIAIQYgBiEJCyACEIQCIQggDiAIIAlB/wBxQYACahECACEKIAoQigIhCyALDws8AQd/IwohB0EIEJMDIQUgACgCACEDIABBBGohASABKAIAIQQgBSADNgIAIAVBBGohAiACIAQ2AgAgBQ8LpgEBEn8jCiEUIwpBEGokCiMKIwtOBEBBEBADCyAUIQwgARCIAiENIAAoAgAhBCAAQQRqIQMgAygCACEFIAVBAXUhDiABIA5qIQ8gBUEBcSEQIBBBAEYhESARBEAgBCEIIAghCgUgDygCACESIBIgBGohBiAGKAIAIQcgByEKCyACEIQCIQkgDCAPIAkgCkH/AHFBgAlqEQQAIAwQiwIhCyAUJAogCw8LPAEHfyMKIQdBCBCTAyEFIAAoAgAhAyAAQQRqIQEgASgCACEEIAUgAzYCACAFQQRqIQIgAiAENgIAIAUPC8cBAhR/AX4jCiEWIwpBEGokCiMKIwtOBEBBEBADCyAWQQhqIRQgFiENIAEQiAIhDiAAKAIAIQQgAEEEaiEDIAMoAgAhBSAFQQF1IQ8gASAPaiEQIAVBAXEhESARQQBGIRIgEgRAIAQhCCAIIQoFIBAoAgAhEyATIARqIQYgBigCACEHIAchCgsgAhCJAiEJIAIpAgAhFyANIBc3AwAgFCANKQIANwIAIBAgFCAKQf8AcUGAAmoRAgAhCyALEIoCIQwgFiQKIAwPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwuiAQERfyMKIRIjCkEgaiQKIwojC04EQEEgEAMLIBIhCSABEIMCIQogACgCACEDIABBBGohAiACKAIAIQQgBEEBdSELIAEgC2ohDCAEQQFxIQ0gDUEARiEOIA4EQCADIQYgBiEHBSAMKAIAIQ8gDyADaiEQIBAoAgAhBSAFIQcLIAkgDCAHQf8AcUGACGoRAwAgCRCGAiEIIAkQrQEgEiQKIAgPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwu3AQESfyMKIRQjCkEwaiQKIwojC04EQEEwEAMLIBRBEGohDCAUIQ0gARCDAiEOIAAoAgAhBCAAQQRqIQMgAygCACEFIAVBAXUhDyABIA9qIRAgBUEBcSERIBFBAEYhEiASBEAgBCEJIAkhCgUgECgCACEGIAYgBGohByAHKAIAIQggCCEKCyANIAIQhQIgDCAQIA0gCkH/AHFBgAlqEQQAIAwQhgIhCyAMEK0BIA0QnwMgFCQKIAsPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwvJAQEUfyMKIRgjCkEwaiQKIwojC04EQEEwEAMLIBhBEGohEiAYIRMgARCDAiEUIAAoAgAhBiAAQQRqIQUgBSgCACEHIAdBAXUhFSABIBVqIRYgB0EBcSEIIAhBAEYhCSAJBEAgBiENIA0hEAUgFigCACEKIAogBmohCyALKAIAIQwgDCEQCyACEIQCIQ4gAxCEAiEPIBMgBBCFAiASIBYgDiAPIBMgEEH/AHFBgAtqEQYAIBIQhgIhESASEK0BIBMQnwMgGCQKIBEPCwsBAn8jCiECIAAPCwsBAn8jCiECIAAPCzEBBH8jCiEFIAFBBGohAiABKAIAIQMgAEIANwIAIABBCGpBADYCACAAIAIgAxCbAw8LGQEDfyMKIQNBGBCTAyEBIAEgABCHAiABDwuhAQELfyMKIQwgACABKQIANwIAIABBCGogAUEIaigCADYCACABQQxqIQMgAEEMaiEEIARBADYCACAAQRBqIQUgBUEANgIAIABBFGohBiAGQQA2AgAgAygCACEHIAQgBzYCACABQRBqIQggCCgCACEJIAUgCTYCACABQRRqIQogCigCACECIAYgAjYCACAKQQA2AgAgCEEANgIAIANBADYCAA8LCwECfyMKIQIgAA8LCwECfyMKIQIgAA8LCwECfyMKIQIgAA8LIgIDfwF+IwohA0EIEJMDIQEgACkCACEEIAEgBDcCACABDwssAQN/IwohA0EMEJMDIQEgASAAKQIANwIAIAFBCGogAEEIaigCADYCACABDwuQAQEQfyMKIRAgAEELaiEBIAEsAAAhByAHQf8BcSEIIAhBgAFxIQkgCUEARiEKIABBBGohCyALKAIAIQwgCgR/IAgFIAwLIQ0gDUEEaiEOIA4Q5gIhAiACIA02AgAgAkEEaiEDIAdBGHRBGHVBAEghBCAAKAIAIQUgBAR/IAUFIAALIQYgAyAGIA0Q3gMaIAIPCwsBAn8jCiECIAAPCwsBAn8jCiECIAAPCwsBAn8jCiECIAAPCysBBX8jCiEFIABBLGohASABEF4gAEEcaiECIAIQXyAAQRBqIQMgAxCfAw8LIAEEfyMKIQRBBBCTAyEBIAAoAgAhAiABIAI2AgAgAQ8LJwEGfyMKIQcgACgCACEDIAEgA2ohBCAEKAIAIQIgAhCKAiEFIAUPCyUBBX8jCiEHIAIQhAIhAyAAKAIAIQQgASAEaiEFIAUgAzYCAA8LFwEDfyMKIQJBCBCTAyEAIAAQmAEgAA8LGwEDfyMKIQMgAEEARiEBIAEEQA8LIAAQlAMPCyABBH8jCiEEQQQQkwMhASAAKAIAIQIgASACNgIAIAEPCycBBn8jCiEHIAAoAgAhAyABIANqIQQgBCgCACECIAIQigIhBSAFDwslAQV/IwohByACEIQCIQMgACgCACEEIAEgBGohBSAFIAM2AgAPCzIBA38jCiECQRgQkwMhACAAQgA3AwAgAEEIakIANwMAIABBEGpCADcDACAAEKIBIAAPCyABA38jCiEDIABBAEYhASABBEAPCyAAEK0BIAAQlAMPCyABBH8jCiEEQQQQkwMhASAAKAIAIQIgASACNgIAIAEPCzsBCH8jCiEJIAAoAgAhAiABIAJqIQMgAywAACEEIARBAXEhBSAFQRh0QRh1QQBHIQYgBhCOAiEHIAcPCywBBn8jCiEIIAIQjwIhAyAAKAIAIQQgASAEaiEFIANBAXEhBiAFIAY6AAAPCyABBH8jCiEEQQQQkwMhASAAKAIAIQIgASACNgIAIAEPCyABBX8jCiEGIAAoAgAhAiABIAJqIQMgAxCiAiEEIAQPCy4CBX8BfiMKIQcgAhCJAiEDIAAoAgAhBCABIARqIQUgAikCACEIIAUgCDcCAA8LIgIDfwF+IwohA0EIEJMDIQEgACkCACEEIAEgBDcCACABDwslAQR/IwohA0EMEJMDIQAgABCYASAAQQhqIQEgAUEAOgAAIAAPCxsBA38jCiEDIABBAEYhASABBEAPCyAAEJQDDwsMAQJ/IwohAkGAHA8LIAEDfyMKIQMgAEEARiEBIAEEQA8LIAAQygIgABCUAw8LIAEEfyMKIQQgAEH/AHFBAGoRAAAhASABEMkCIQIgAg8LNQEFfyMKIQRBDBCTAyEAIABBADYCACAAQQRqIQEgAUEANgIAIABBCGohAiACQQA2AgAgAA8LVwEJfyMKIQogAEEEaiECIAIoAgAhAyAAQQhqIQQgBCgCACEFIAMgBUYhBiAGBEAgACABEMgCDwUgAyABEJoDIAIoAgAhByAHQQxqIQggAiAINgIADwsACzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwugAQEQfyMKIRIjCkEQaiQKIwojC04EQEEQEAMLIBIhCiABEMQCIQsgACgCACEEIABBBGohAyADKAIAIQUgBUEBdSEMIAEgDGohDSAFQQFxIQ4gDkEARiEPIA8EQCAEIQggCCEJBSANKAIAIRAgECAEaiEGIAYoAgAhByAHIQkLIAogAhCFAiANIAogCUH/AHFBgAhqEQMAIAoQnwMgEiQKDwurAQERfyMKIRMgAEEEaiELIAsoAgAhDCAAKAIAIQ0gDCEOIA0hDyAOIA9rIRAgEEEMbUF/cSERIBEgAUkhBCAEBEAgASARayEFIAAgBSACEMUCDwsgESABSyEGIAZFBEAPCyANIAFBDGxqIQcgByAMRiEIIAhFBEAgDCEDA0ACQCADQXRqIQkgCRCfAyAHIAlGIQogCgRADAEFIAkhAwsMAQsLCyALIAc2AgAPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwupAQERfyMKIRQjCkEQaiQKIwojC04EQEEQEAMLIBQhDSABEMQCIQ4gACgCACEFIABBBGohBCAEKAIAIQYgBkEBdSEPIAEgD2ohECAGQQFxIREgEUEARiESIBIEQCAFIQogCiEMBSAQKAIAIQcgByAFaiEIIAgoAgAhCSAJIQwLIAIQuQIhCyANIAMQhQIgECALIA0gDEH/AHFBgAlqEQQAIA0QnwMgFCQKDwsxAQd/IwohByAAQQRqIQEgASgCACECIAAoAgAhAyACIANrIQQgBEEMbUF/cSEFIAUPCzwBB38jCiEHQQgQkwMhBSAAKAIAIQMgAEEEaiEBIAEoAgAhBCAFIAM2AgAgBUEEaiECIAIgBDYCACAFDwuCAQERfyMKIRIgARDCAiEJIAAoAgAhAyAAQQRqIQIgAigCACEEIARBAXUhCiABIApqIQsgBEEBcSEMIAxBAEYhDSANBEAgAyEFIAUhBgUgCygCACEOIA4gA2ohDyAPKAIAIRAgECEGCyALIAZB/wBxQYABahEBACEHIAcQwwIhCCAIDwtYAQp/IwohDCABQQRqIQQgBCgCACEFIAEoAgAhBiAGIQcgBSAHayEIIAhBDG1Bf3EhCSAJIAJLIQogCgRAIAYgAkEMbGohAyAAIAMQvAIPBSAAEL0CDwsACyABBH8jCiEEQQQQkwMhASAAKAIAIQIgASACNgIAIAEPC2EBCH8jCiEKIwpBEGokCiMKIwtOBEBBEBADCyAKIQQgACgCACEFIAEQuAIhBiACELkCIQcgBCAGIAcgBUH/AHFBgAlqEQQAIAQQugIhCCAEKAIAIQMgAxC7AiAKJAogCA8LJAEEfyMKIQYgACgCACEDIAMgAUEMbGohBCAEIAIQoAMaQQEPCyABBH8jCiEEQQQQkwMhASAAKAIAIQIgASACNgIAIAEPC2MBCH8jCiELIwpBEGokCiMKIwtOBEBBEBADCyALIQQgACgCACEFIAEQuAIhBiACELkCIQcgBCADEIUCIAYgByAEIAVB/wBxQYADahEHACEIIAgQjgIhCSAEEJ8DIAskCiAJDwsLAQJ/IwohAiAADwsLAQJ/IwohAiAADwsdAQR/IwohBCAAKAIAIQEgARAuIAAoAgAhAiACDwsNAQJ/IwohAiAAEC0PC0IBBX8jCiEGIwpBEGokCiMKIwtOBEBBEBADCyAGIQIgAiABEL8CIAIQwAIhA0G4GyADEC8hBCAAIAQ2AgAgBiQKDwsOAQJ/IwohAiAAEL4CDwsQAQJ/IwohAiAAQQE2AgAPCzkBBH8jCiEFIwpBEGokCiMKIwtOBEBBEBADCyAFIQIgAiAANgIAIAEQjQIhAyACIAMQwQIgBSQKDwsLAQJ/IwohAiAADwssAQV/IwohBiAAKAIAIQIgAiABNgIAIAAoAgAhAyADQQhqIQQgACAENgIADwsLAQJ/IwohAiAADwsLAQJ/IwohAiAADwsLAQJ/IwohAiAADwvJAgEdfyMKIR8jCkEgaiQKIwojC04EQEEgEAMLIB8hFiAAQQhqIRcgFygCACEYIABBBGohGSAZKAIAIRogGCAaayEbIBtBDG1Bf3EhHCAcIAFJIQUgBUUEQCAaIQYgASEDIAYhBwNAAkAgByACEJoDIBkoAgAhCCAIQQxqIQkgGSAJNgIAIANBf2ohCiAKQQBGIQsgCwRADAEFIAohAyAJIQcLDAELCyAfJAoPCyAAKAIAIQwgGiAMayENIA1BDG1Bf3EhDiAOIAFqIQ8gD0HVqtWqAUshECAQBEAQqwMLIBggDGshESARQQxtQX9xIRIgEkGq1arVAEkhEyASQQF0IRQgFCAPSSEVIBUEfyAPBSAUCyEEIBMEfyAEBUHVqtWqAQshHSAWIB0gDiAXEMkBIBYgASACEMYCIAAgFhDHAiAWEMoBIB8kCg8LYQEKfyMKIQwgAEEIaiEFIAUoAgAhBCABIQMgBCEGA0ACQCAGIAIQmgMgBSgCACEHIAdBDGohCCAFIAg2AgAgA0F/aiEJIAlBAEYhCiAKBEAMAQUgCSEDIAghBgsMAQsLDwvtAgEjfyMKISQgACgCACESIABBCGohGSAAQQRqIRogGigCACEbIAFBBGohHCAbIBJGIR0gHQRAIBIhHiAcKAIAIQcgHCEEIAAhBSAHIQ8gHiEQBSAcKAIAIQMgGyECIAMhCkEAISADQAJAICBBf3MhHyAbIB9BDGxqISIgAkF0aiEIIApBdGohCSAJIAgpAgA3AgAgCUEIaiAIQQhqKAIANgIAICJCADcCACAiQQhqQQA2AgAgHCgCACELIAtBdGohDCAcIAw2AgAgCCASRiENICBBAWohISANBEAMAQUgCCECIAwhCiAhISALDAELCyAMIQ4gACgCACEGIBwhBCAAIQUgDiEPIAYhEAsgBSAPNgIAIAQgEDYCACABQQhqIREgGigCACETIBEoAgAhFCAaIBQ2AgAgESATNgIAIAFBDGohFSAZKAIAIRYgFSgCACEXIBkgFzYCACAVIBY2AgAgBCgCACEYIAEgGDYCAA8L8wEBFn8jCiEXIwpBIGokCiMKIwtOBEBBIBADCyAXIQ0gAEEIaiEOIABBBGohDyAPKAIAIRAgACgCACERIBAgEWshEiASQQxtQX9xIRMgE0EBaiEUIBRB1arVqgFLIQMgAwRAEKsDBSAOKAIAIQQgBCARayEFIAVBDG1Bf3EhBiAGQarVqtUASSEHIAZBAXQhCCAIIBRJIQkgCQR/IBQFIAgLIQIgBwR/IAIFQdWq1aoBCyEVIA0gFSATIA4QyQEgDUEIaiEKIAooAgAhCyALIAEQmgMgC0EMaiEMIAogDDYCACAAIA0QxwIgDRDKASAXJAoPCwsLAQJ/IwohAiAADwsOAQJ/IwohAiAAEMgBDwsMAQJ/IwohARDMAg8LDAECfyMKIQEQzQIPC7wBAQJ/IwohAUGAH0HXNBAsQZAfQdw0QQFBAUEAEB4QzgIQzwIQ0AIQ0QIQ0gIQ0wIQ1AIQ1QIQ1gIQ1wIQ2AJBuBtB4TQQJkHYHUHtNBAmQcAdQQRBjjUQJ0G4HEGbNRAiENkCQas1ENoCQdA1ENsCQfc1ENwCQZY2EN0CQb42EN4CQds2EN8CEOACEOECQYE3ENoCQaE3ENsCQcI3ENwCQeM3EN0CQYU4EN4CQaY4EN8CEOICEOMCEOQCDwsZAQJ/IwohAUGYH0HhPkEBQYB/Qf8AECQPCxkBAn8jCiEBQagfQdU+QQFBgH9B/wAQJA8LGAECfyMKIQFBoB9Bxz5BAUEAQf8BECQPCxsBAn8jCiEBQbAfQcE+QQJBgIB+Qf//ARAkDwsZAQJ/IwohAUG4H0GyPkECQQBB//8DECQPCx8BAn8jCiEBQcAfQa4+QQRBgICAgHhB/////wcQJA8LFwECfyMKIQFByB9BoT5BBEEAQX8QJA8LHwECfyMKIQFB0B9BnD5BBEGAgICAeEH/////BxAkDwsXAQJ/IwohAUHYH0GOPkEEQQBBfxAkDwsTAQJ/IwohAUHgH0GIPkEEECMPCxMBAn8jCiEBQegfQYE+QQgQIw8LEwECfyMKIQFBuB1BAEHGPBAlDwsSAQJ/IwohAkGwHUEAIAAQJQ8LEgECfyMKIQJBqB1BASAAECUPCxIBAn8jCiECQaAdQQIgABAlDwsSAQJ/IwohAkGYHUEDIAAQJQ8LEgECfyMKIQJBkB1BBCAAECUPCxIBAn8jCiECQYgdQQUgABAlDwsTAQJ/IwohAUGAHUEEQc86ECUPCxMBAn8jCiEBQfgcQQVBiToQJQ8LEwECfyMKIQFB8BxBBkHLORAlDwsTAQJ/IwohAUHoHEEHQYw5ECUPCxMBAn8jCiEBQeAcQQdByDgQJQ8LIAEFfyMKIQUgAEEEaiEBIAEoAgAhAiACEIsDIQMgAw8L03ABxQh/IwohxQgjCkEQaiQKIwojC04EQEEQEAMLIMUIIVwgAEH1AUkhywECQCDLAQRAIABBC0khugIgAEELaiGpAyCpA0F4cSGYBCC6AgR/QRAFIJgECyGHBSCHBUEDdiH2BUHgzAAoAgAh5QYg5QYg9gV2IdQHINQHQQNxIV0gXUEARiFoIGhFBEAg1AdBAXEhcyBzQQFzIX4gfiD2BWohiQEgiQFBAXQhlAFBiM0AIJQBQQJ0aiGfASCfAUEIaiGqASCqASgCACG1ASC1AUEIaiHAASDAASgCACHMASDMASCfAUYh1wEg1wEEQEEBIIkBdCHiASDiAUF/cyHtASDlBiDtAXEh+AFB4MwAIPgBNgIABSDMAUEMaiGDAiCDAiCfATYCACCqASDMATYCAAsgiQFBA3QhjgIgjgJBA3IhmQIgtQFBBGohpAIgpAIgmQI2AgAgtQEgjgJqIa8CIK8CQQRqIbsCILsCKAIAIcYCIMYCQQFyIdECILsCINECNgIAIMABIQEgxQgkCiABDwtB6MwAKAIAIdwCIIcFINwCSyHnAiDnAgRAINQHQQBGIfICIPICRQRAINQHIPYFdCH9AkECIPYFdCGIA0EAIIgDayGTAyCIAyCTA3IhngMg/QIgngNxIaoDQQAgqgNrIbUDIKoDILUDcSHAAyDAA0F/aiHLAyDLA0EMdiHWAyDWA0EQcSHhAyDLAyDhA3Yh7AMg7ANBBXYh9wMg9wNBCHEhggQgggQg4QNyIY0EIOwDIIIEdiGZBCCZBEECdiGkBCCkBEEEcSGvBCCNBCCvBHIhugQgmQQgrwR2IcUEIMUEQQF2IdAEINAEQQJxIdsEILoEINsEciHmBCDFBCDbBHYh8QQg8QRBAXYh/AQg/ARBAXEhiAUg5gQgiAVyIZMFIPEEIIgFdiGeBSCTBSCeBWohqQUgqQVBAXQhtAVBiM0AILQFQQJ0aiG/BSC/BUEIaiHKBSDKBSgCACHVBSDVBUEIaiHgBSDgBSgCACHrBSDrBSC/BUYh9wUg9wUEQEEBIKkFdCGCBiCCBkF/cyGNBiDlBiCNBnEhmAZB4MwAIJgGNgIAIJgGIdUHBSDrBUEMaiGjBiCjBiC/BTYCACDKBSDrBTYCACDlBiHVBwsgqQVBA3QhrgYgrgYghwVrIbkGIIcFQQNyIcQGINUFQQRqIc8GIM8GIMQGNgIAINUFIIcFaiHaBiC5BkEBciHmBiDaBkEEaiHxBiDxBiDmBjYCACDVBSCuBmoh/AYg/AYguQY2AgAg3AJBAEYhhwcghwdFBEBB9MwAKAIAIZIHINwCQQN2IZ0HIJ0HQQF0IagHQYjNACCoB0ECdGohswdBASCdB3Qhvgcg1QcgvgdxIckHIMkHQQBGIeAHIOAHBEAg1QcgvgdyIesHQeDMACDrBzYCACCzB0EIaiFOILMHIQogTiFYBSCzB0EIaiH2ByD2BygCACGBCCCBCCEKIPYHIVgLIFggkgc2AgAgCkEMaiGMCCCMCCCSBzYCACCSB0EIaiGXCCCXCCAKNgIAIJIHQQxqIaIIIKIIILMHNgIAC0HozAAguQY2AgBB9MwAINoGNgIAIOAFIQEgxQgkCiABDwtB5MwAKAIAIaoIIKoIQQBGIasIIKsIBEAghwUhCQVBACCqCGshXiCqCCBecSFfIF9Bf2ohYCBgQQx2IWEgYUEQcSFiIGAgYnYhYyBjQQV2IWQgZEEIcSFlIGUgYnIhZiBjIGV2IWcgZ0ECdiFpIGlBBHEhaiBmIGpyIWsgZyBqdiFsIGxBAXYhbSBtQQJxIW4gayBuciFvIGwgbnYhcCBwQQF2IXEgcUEBcSFyIG8gcnIhdCBwIHJ2IXUgdCB1aiF2QZDPACB2QQJ0aiF3IHcoAgAheCB4QQRqIXkgeSgCACF6IHpBeHEheyB7IIcFayF8IHghBiB4IQcgfCEIA0ACQCAGQRBqIX0gfSgCACF/IH9BAEYhgAEggAEEQCAGQRRqIYEBIIEBKAIAIYIBIIIBQQBGIYMBIIMBBEAMAgUgggEhhQELBSB/IYUBCyCFAUEEaiGEASCEASgCACGGASCGAUF4cSGHASCHASCHBWshiAEgiAEgCEkhigEgigEEfyCIAQUgCAshvQggigEEfyCFAQUgBwshvwgghQEhBiC/CCEHIL0IIQgMAQsLIAcghwVqIYsBIIsBIAdLIYwBIIwBBEAgB0EYaiGNASCNASgCACGOASAHQQxqIY8BII8BKAIAIZABIJABIAdGIZEBAkAgkQEEQCAHQRRqIZcBIJcBKAIAIZgBIJgBQQBGIZkBIJkBBEAgB0EQaiGaASCaASgCACGbASCbAUEARiGcASCcAQRAQQAhPAwDBSCbASEkIJoBIScLBSCYASEkIJcBIScLICQhIiAnISUDQAJAICJBFGohnQEgnQEoAgAhngEgngFBAEYhoAEgoAEEQCAiQRBqIaEBIKEBKAIAIaIBIKIBQQBGIaMBIKMBBEAMAgUgogEhIyChASEmCwUgngEhIyCdASEmCyAjISIgJiElDAELCyAlQQA2AgAgIiE8BSAHQQhqIZIBIJIBKAIAIZMBIJMBQQxqIZUBIJUBIJABNgIAIJABQQhqIZYBIJYBIJMBNgIAIJABITwLCyCOAUEARiGkAQJAIKQBRQRAIAdBHGohpQEgpQEoAgAhpgFBkM8AIKYBQQJ0aiGnASCnASgCACGoASAHIKgBRiGpASCpAQRAIKcBIDw2AgAgPEEARiGsCCCsCARAQQEgpgF0IasBIKsBQX9zIawBIKoIIKwBcSGtAUHkzAAgrQE2AgAMAwsFII4BQRBqIa4BIK4BKAIAIa8BIK8BIAdGIbABII4BQRRqIbEBILABBH8grgEFILEBCyFZIFkgPDYCACA8QQBGIbIBILIBBEAMAwsLIDxBGGohswEgswEgjgE2AgAgB0EQaiG0ASC0ASgCACG2ASC2AUEARiG3ASC3AUUEQCA8QRBqIbgBILgBILYBNgIAILYBQRhqIbkBILkBIDw2AgALIAdBFGohugEgugEoAgAhuwEguwFBAEYhvAEgvAFFBEAgPEEUaiG9ASC9ASC7ATYCACC7AUEYaiG+ASC+ASA8NgIACwsLIAhBEEkhvwEgvwEEQCAIIIcFaiHBASDBAUEDciHCASAHQQRqIcMBIMMBIMIBNgIAIAcgwQFqIcQBIMQBQQRqIcUBIMUBKAIAIcYBIMYBQQFyIccBIMUBIMcBNgIABSCHBUEDciHIASAHQQRqIckBIMkBIMgBNgIAIAhBAXIhygEgiwFBBGohzQEgzQEgygE2AgAgiwEgCGohzgEgzgEgCDYCACDcAkEARiHPASDPAUUEQEH0zAAoAgAh0AEg3AJBA3Yh0QEg0QFBAXQh0gFBiM0AINIBQQJ0aiHTAUEBINEBdCHUASDUASDlBnEh1QEg1QFBAEYh1gEg1gEEQCDUASDlBnIh2AFB4MwAINgBNgIAINMBQQhqIU8g0wEhAiBPIVcFINMBQQhqIdkBINkBKAIAIdoBINoBIQIg2QEhVwsgVyDQATYCACACQQxqIdsBINsBINABNgIAINABQQhqIdwBINwBIAI2AgAg0AFBDGoh3QEg3QEg0wE2AgALQejMACAINgIAQfTMACCLATYCAAsgB0EIaiHeASDeASEBIMUIJAogAQ8FIIcFIQkLCwUghwUhCQsFIABBv39LId8BIN8BBEBBfyEJBSAAQQtqIeABIOABQXhxIeEBQeTMACgCACHjASDjAUEARiHkASDkAQRAIOEBIQkFQQAg4QFrIeUBIOABQQh2IeYBIOYBQQBGIecBIOcBBEBBACEdBSDhAUH///8HSyHoASDoAQRAQR8hHQUg5gFBgP4/aiHpASDpAUEQdiHqASDqAUEIcSHrASDmASDrAXQh7AEg7AFBgOAfaiHuASDuAUEQdiHvASDvAUEEcSHwASDwASDrAXIh8QEg7AEg8AF0IfIBIPIBQYCAD2oh8wEg8wFBEHYh9AEg9AFBAnEh9QEg8QEg9QFyIfYBQQ4g9gFrIfcBIPIBIPUBdCH5ASD5AUEPdiH6ASD3ASD6AWoh+wEg+wFBAXQh/AEg+wFBB2oh/QEg4QEg/QF2If4BIP4BQQFxIf8BIP8BIPwBciGAAiCAAiEdCwtBkM8AIB1BAnRqIYECIIECKAIAIYICIIICQQBGIYQCAkAghAIEQEEAITtBACE+IOUBIUBBPSHECAUgHUEfRiGFAiAdQQF2IYYCQRkghgJrIYcCIIUCBH9BAAUghwILIYgCIOEBIIgCdCGJAkEAIRcg5QEhGyCCAiEcIIkCIR5BACEgA0ACQCAcQQRqIYoCIIoCKAIAIYsCIIsCQXhxIYwCIIwCIOEBayGNAiCNAiAbSSGPAiCPAgRAII0CQQBGIZACIJACBEAgHCFEQQAhSCAcIUtBwQAhxAgMBQUgHCEvII0CITALBSAXIS8gGyEwCyAcQRRqIZECIJECKAIAIZICIB5BH3YhkwIgHEEQaiCTAkECdGohlAIglAIoAgAhlQIgkgJBAEYhlgIgkgIglQJGIZcCIJYCIJcCciGzCCCzCAR/ICAFIJICCyExIJUCQQBGIZgCIB5BAXQhwQggmAIEQCAxITsgLyE+IDAhQEE9IcQIDAEFIC8hFyAwIRsglQIhHCDBCCEeIDEhIAsMAQsLCwsgxAhBPUYEQCA7QQBGIZoCID5BAEYhmwIgmgIgmwJxIbEIILEIBEBBAiAddCGcAkEAIJwCayGdAiCcAiCdAnIhngIgngIg4wFxIZ8CIJ8CQQBGIaACIKACBEAg4QEhCQwGC0EAIJ8CayGhAiCfAiChAnEhogIgogJBf2ohowIgowJBDHYhpQIgpQJBEHEhpgIgowIgpgJ2IacCIKcCQQV2IagCIKgCQQhxIakCIKkCIKYCciGqAiCnAiCpAnYhqwIgqwJBAnYhrAIgrAJBBHEhrQIgqgIgrQJyIa4CIKsCIK0CdiGwAiCwAkEBdiGxAiCxAkECcSGyAiCuAiCyAnIhswIgsAIgsgJ2IbQCILQCQQF2IbUCILUCQQFxIbYCILMCILYCciG3AiC0AiC2AnYhuAIgtwIguAJqIbkCQZDPACC5AkECdGohvAIgvAIoAgAhvQJBACE/IL0CIUkFID4hPyA7IUkLIElBAEYhvgIgvgIEQCA/IUIgQCFGBSA/IUQgQCFIIEkhS0HBACHECAsLIMQIQcEARgRAIEQhQyBIIUcgSyFKA0ACQCBKQQRqIb8CIL8CKAIAIcACIMACQXhxIcECIMECIOEBayHCAiDCAiBHSSHDAiDDAgR/IMICBSBHCyG+CCDDAgR/IEoFIEMLIcAIIEpBEGohxAIgxAIoAgAhxQIgxQJBAEYhxwIgxwIEQCBKQRRqIcgCIMgCKAIAIckCIMkCIcoCBSDFAiHKAgsgygJBAEYhywIgywIEQCDACCFCIL4IIUYMAQUgwAghQyC+CCFHIMoCIUoLDAELCwsgQkEARiHMAiDMAgRAIOEBIQkFQejMACgCACHNAiDNAiDhAWshzgIgRiDOAkkhzwIgzwIEQCBCIOEBaiHQAiDQAiBCSyHSAiDSAgRAIEJBGGoh0wIg0wIoAgAh1AIgQkEMaiHVAiDVAigCACHWAiDWAiBCRiHXAgJAINcCBEAgQkEUaiHdAiDdAigCACHeAiDeAkEARiHfAiDfAgRAIEJBEGoh4AIg4AIoAgAh4QIg4QJBAEYh4gIg4gIEQEEAIUEMAwUg4QIhNCDgAiE3CwUg3gIhNCDdAiE3CyA0ITIgNyE1A0ACQCAyQRRqIeMCIOMCKAIAIeQCIOQCQQBGIeUCIOUCBEAgMkEQaiHmAiDmAigCACHoAiDoAkEARiHpAiDpAgRADAIFIOgCITMg5gIhNgsFIOQCITMg4wIhNgsgMyEyIDYhNQwBCwsgNUEANgIAIDIhQQUgQkEIaiHYAiDYAigCACHZAiDZAkEMaiHaAiDaAiDWAjYCACDWAkEIaiHbAiDbAiDZAjYCACDWAiFBCwsg1AJBAEYh6gICQCDqAgRAIOMBIcYDBSBCQRxqIesCIOsCKAIAIewCQZDPACDsAkECdGoh7QIg7QIoAgAh7gIgQiDuAkYh7wIg7wIEQCDtAiBBNgIAIEFBAEYhrgggrggEQEEBIOwCdCHwAiDwAkF/cyHxAiDjASDxAnEh8wJB5MwAIPMCNgIAIPMCIcYDDAMLBSDUAkEQaiH0AiD0AigCACH1AiD1AiBCRiH2AiDUAkEUaiH3AiD2AgR/IPQCBSD3AgshWiBaIEE2AgAgQUEARiH4AiD4AgRAIOMBIcYDDAMLCyBBQRhqIfkCIPkCINQCNgIAIEJBEGoh+gIg+gIoAgAh+wIg+wJBAEYh/AIg/AJFBEAgQUEQaiH+AiD+AiD7AjYCACD7AkEYaiH/AiD/AiBBNgIACyBCQRRqIYADIIADKAIAIYEDIIEDQQBGIYIDIIIDBEAg4wEhxgMFIEFBFGohgwMggwMggQM2AgAggQNBGGohhAMghAMgQTYCACDjASHGAwsLCyBGQRBJIYUDAkAghQMEQCBGIOEBaiGGAyCGA0EDciGHAyBCQQRqIYkDIIkDIIcDNgIAIEIghgNqIYoDIIoDQQRqIYsDIIsDKAIAIYwDIIwDQQFyIY0DIIsDII0DNgIABSDhAUEDciGOAyBCQQRqIY8DII8DII4DNgIAIEZBAXIhkAMg0AJBBGohkQMgkQMgkAM2AgAg0AIgRmohkgMgkgMgRjYCACBGQQN2IZQDIEZBgAJJIZUDIJUDBEAglANBAXQhlgNBiM0AIJYDQQJ0aiGXA0HgzAAoAgAhmANBASCUA3QhmQMgmAMgmQNxIZoDIJoDQQBGIZsDIJsDBEAgmAMgmQNyIZwDQeDMACCcAzYCACCXA0EIaiFTIJcDISEgUyFWBSCXA0EIaiGdAyCdAygCACGfAyCfAyEhIJ0DIVYLIFYg0AI2AgAgIUEMaiGgAyCgAyDQAjYCACDQAkEIaiGhAyChAyAhNgIAINACQQxqIaIDIKIDIJcDNgIADAILIEZBCHYhowMgowNBAEYhpAMgpAMEQEEAIR8FIEZB////B0shpQMgpQMEQEEfIR8FIKMDQYD+P2ohpgMgpgNBEHYhpwMgpwNBCHEhqAMgowMgqAN0IasDIKsDQYDgH2ohrAMgrANBEHYhrQMgrQNBBHEhrgMgrgMgqANyIa8DIKsDIK4DdCGwAyCwA0GAgA9qIbEDILEDQRB2IbIDILIDQQJxIbMDIK8DILMDciG0A0EOILQDayG2AyCwAyCzA3QhtwMgtwNBD3YhuAMgtgMguANqIbkDILkDQQF0IboDILkDQQdqIbsDIEYguwN2IbwDILwDQQFxIb0DIL0DILoDciG+AyC+AyEfCwtBkM8AIB9BAnRqIb8DINACQRxqIcEDIMEDIB82AgAg0AJBEGohwgMgwgNBBGohwwMgwwNBADYCACDCA0EANgIAQQEgH3QhxAMgxgMgxANxIcUDIMUDQQBGIccDIMcDBEAgxgMgxANyIcgDQeTMACDIAzYCACC/AyDQAjYCACDQAkEYaiHJAyDJAyC/AzYCACDQAkEMaiHKAyDKAyDQAjYCACDQAkEIaiHMAyDMAyDQAjYCAAwCCyC/AygCACHNAyDNA0EEaiHOAyDOAygCACHPAyDPA0F4cSHQAyDQAyBGRiHRAwJAINEDBEAgzQMhGQUgH0EfRiHSAyAfQQF2IdMDQRkg0wNrIdQDINIDBH9BAAUg1AMLIdUDIEYg1QN0IdcDINcDIRggzQMhGgNAAkAgGEEfdiHeAyAaQRBqIN4DQQJ0aiHfAyDfAygCACHaAyDaA0EARiHgAyDgAwRADAELIBhBAXQh2AMg2gNBBGoh2QMg2QMoAgAh2wMg2wNBeHEh3AMg3AMgRkYh3QMg3QMEQCDaAyEZDAQFINgDIRgg2gMhGgsMAQsLIN8DINACNgIAINACQRhqIeIDIOIDIBo2AgAg0AJBDGoh4wMg4wMg0AI2AgAg0AJBCGoh5AMg5AMg0AI2AgAMAwsLIBlBCGoh5QMg5QMoAgAh5gMg5gNBDGoh5wMg5wMg0AI2AgAg5QMg0AI2AgAg0AJBCGoh6AMg6AMg5gM2AgAg0AJBDGoh6QMg6QMgGTYCACDQAkEYaiHqAyDqA0EANgIACwsgQkEIaiHrAyDrAyEBIMUIJAogAQ8FIOEBIQkLBSDhASEJCwsLCwsLQejMACgCACHtAyDtAyAJSSHuAyDuA0UEQCDtAyAJayHvA0H0zAAoAgAh8AMg7wNBD0sh8QMg8QMEQCDwAyAJaiHyA0H0zAAg8gM2AgBB6MwAIO8DNgIAIO8DQQFyIfMDIPIDQQRqIfQDIPQDIPMDNgIAIPADIO0DaiH1AyD1AyDvAzYCACAJQQNyIfYDIPADQQRqIfgDIPgDIPYDNgIABUHozABBADYCAEH0zABBADYCACDtA0EDciH5AyDwA0EEaiH6AyD6AyD5AzYCACDwAyDtA2oh+wMg+wNBBGoh/AMg/AMoAgAh/QMg/QNBAXIh/gMg/AMg/gM2AgALIPADQQhqIf8DIP8DIQEgxQgkCiABDwtB7MwAKAIAIYAEIIAEIAlLIYEEIIEEBEAggAQgCWshgwRB7MwAIIMENgIAQfjMACgCACGEBCCEBCAJaiGFBEH4zAAghQQ2AgAggwRBAXIhhgQghQRBBGohhwQghwQghgQ2AgAgCUEDciGIBCCEBEEEaiGJBCCJBCCIBDYCACCEBEEIaiGKBCCKBCEBIMUIJAogAQ8LQbjQACgCACGLBCCLBEEARiGMBCCMBARAQcDQAEGAIDYCAEG80ABBgCA2AgBBxNAAQX82AgBByNAAQX82AgBBzNAAQQA2AgBBnNAAQQA2AgAgXCGOBCCOBEFwcSGPBCCPBEHYqtWqBXMhkARBuNAAIJAENgIAQYAgIZQEBUHA0AAoAgAhUiBSIZQECyAJQTBqIZEEIAlBL2ohkgQglAQgkgRqIZMEQQAglARrIZUEIJMEIJUEcSGWBCCWBCAJSyGXBCCXBEUEQEEAIQEgxQgkCiABDwtBmNAAKAIAIZoEIJoEQQBGIZsEIJsERQRAQZDQACgCACGcBCCcBCCWBGohnQQgnQQgnARNIZ4EIJ0EIJoESyGfBCCeBCCfBHIhsgggsggEQEEAIQEgxQgkCiABDwsLQZzQACgCACGgBCCgBEEEcSGhBCChBEEARiGiBAJAIKIEBEBB+MwAKAIAIaMEIKMEQQBGIaUEAkAgpQQEQEGAASHECAVBoNAAIQUDQAJAIAUoAgAhpgQgpgQgowRLIacEIKcERQRAIAVBBGohqAQgqAQoAgAhqQQgpgQgqQRqIaoEIKoEIKMESyGrBCCrBARADAILCyAFQQhqIawEIKwEKAIAIa0EIK0EQQBGIa4EIK4EBEBBgAEhxAgMBAUgrQQhBQsMAQsLIJMEIIAEayHIBCDIBCCVBHEhyQQgyQRB/////wdJIcoEIMoEBEAgyQQQ4QMhywQgBSgCACHMBCCoBCgCACHNBCDMBCDNBGohzgQgywQgzgRGIc8EIM8EBEAgywRBf0Yh0QQg0QQEQCDJBCE4BSDJBCFMIMsEIU1BkQEhxAgMBgsFIMsEITkgyQQhOkGIASHECAsFQQAhOAsLCwJAIMQIQYABRgRAQQAQ4QMhsAQgsARBf0YhsQQgsQQEQEEAITgFILAEIbIEQbzQACgCACGzBCCzBEF/aiG0BCC0BCCyBHEhtQQgtQRBAEYhtgQgtAQgsgRqIbcEQQAgswRrIbgEILcEILgEcSG5BCC5BCCyBGshuwQgtgQEf0EABSC7BAshvAQgvAQglgRqIcIIQZDQACgCACG9BCDCCCC9BGohvgQgwgggCUshvwQgwghB/////wdJIcAEIL8EIMAEcSGwCCCwCARAQZjQACgCACHBBCDBBEEARiHCBCDCBEUEQCC+BCC9BE0hwwQgvgQgwQRLIcQEIMMEIMQEciG1CCC1CARAQQAhOAwFCwsgwggQ4QMhxgQgxgQgsARGIccEIMcEBEAgwgghTCCwBCFNQZEBIcQIDAYFIMYEITkgwgghOkGIASHECAsFQQAhOAsLCwsCQCDECEGIAUYEQEEAIDprIdIEIDlBf0ch0wQgOkH/////B0kh1AQg1AQg0wRxIboIIJEEIDpLIdUEINUEILoIcSG5CCC5CEUEQCA5QX9GIeAEIOAEBEBBACE4DAMFIDohTCA5IU1BkQEhxAgMBQsAC0HA0AAoAgAh1gQgkgQgOmsh1wQg1wQg1gRqIdgEQQAg1gRrIdkEINgEINkEcSHaBCDaBEH/////B0kh3AQg3ARFBEAgOiFMIDkhTUGRASHECAwECyDaBBDhAyHdBCDdBEF/RiHeBCDeBARAINIEEOEDGkEAITgMAgUg2gQgOmoh3wQg3wQhTCA5IU1BkQEhxAgMBAsACwtBnNAAKAIAIeEEIOEEQQRyIeIEQZzQACDiBDYCACA4IUVBjwEhxAgFQQAhRUGPASHECAsLIMQIQY8BRgRAIJYEQf////8HSSHjBCDjBARAIJYEEOEDIeQEQQAQ4QMh5QQg5ARBf0ch5wQg5QRBf0ch6AQg5wQg6ARxIbYIIOQEIOUESSHpBCDpBCC2CHEhuwgg5QQh6gQg5AQh6wQg6gQg6wRrIewEIAlBKGoh7QQg7AQg7QRLIe4EIO4EBH8g7AQFIEULIcMIILsIQQFzIbwIIOQEQX9GIe8EIO4EQQFzIa8IIO8EIK8IciHwBCDwBCC8CHIhtwggtwhFBEAgwwghTCDkBCFNQZEBIcQICwsLIMQIQZEBRgRAQZDQACgCACHyBCDyBCBMaiHzBEGQ0AAg8wQ2AgBBlNAAKAIAIfQEIPMEIPQESyH1BCD1BARAQZTQACDzBDYCAAtB+MwAKAIAIfYEIPYEQQBGIfcEAkAg9wQEQEHwzAAoAgAh+AQg+ARBAEYh+QQgTSD4BEkh+gQg+QQg+gRyIbQIILQIBEBB8MwAIE02AgALQaDQACBNNgIAQaTQACBMNgIAQazQAEEANgIAQbjQACgCACH7BEGEzQAg+wQ2AgBBgM0AQX82AgBBlM0AQYjNADYCAEGQzQBBiM0ANgIAQZzNAEGQzQA2AgBBmM0AQZDNADYCAEGkzQBBmM0ANgIAQaDNAEGYzQA2AgBBrM0AQaDNADYCAEGozQBBoM0ANgIAQbTNAEGozQA2AgBBsM0AQajNADYCAEG8zQBBsM0ANgIAQbjNAEGwzQA2AgBBxM0AQbjNADYCAEHAzQBBuM0ANgIAQczNAEHAzQA2AgBByM0AQcDNADYCAEHUzQBByM0ANgIAQdDNAEHIzQA2AgBB3M0AQdDNADYCAEHYzQBB0M0ANgIAQeTNAEHYzQA2AgBB4M0AQdjNADYCAEHszQBB4M0ANgIAQejNAEHgzQA2AgBB9M0AQejNADYCAEHwzQBB6M0ANgIAQfzNAEHwzQA2AgBB+M0AQfDNADYCAEGEzgBB+M0ANgIAQYDOAEH4zQA2AgBBjM4AQYDOADYCAEGIzgBBgM4ANgIAQZTOAEGIzgA2AgBBkM4AQYjOADYCAEGczgBBkM4ANgIAQZjOAEGQzgA2AgBBpM4AQZjOADYCAEGgzgBBmM4ANgIAQazOAEGgzgA2AgBBqM4AQaDOADYCAEG0zgBBqM4ANgIAQbDOAEGozgA2AgBBvM4AQbDOADYCAEG4zgBBsM4ANgIAQcTOAEG4zgA2AgBBwM4AQbjOADYCAEHMzgBBwM4ANgIAQcjOAEHAzgA2AgBB1M4AQcjOADYCAEHQzgBByM4ANgIAQdzOAEHQzgA2AgBB2M4AQdDOADYCAEHkzgBB2M4ANgIAQeDOAEHYzgA2AgBB7M4AQeDOADYCAEHozgBB4M4ANgIAQfTOAEHozgA2AgBB8M4AQejOADYCAEH8zgBB8M4ANgIAQfjOAEHwzgA2AgBBhM8AQfjOADYCAEGAzwBB+M4ANgIAQYzPAEGAzwA2AgBBiM8AQYDPADYCACBMQVhqIf0EIE1BCGoh/gQg/gQh/wQg/wRBB3EhgAUggAVBAEYhgQVBACD/BGshggUgggVBB3EhgwUggQUEf0EABSCDBQshhAUgTSCEBWohhQUg/QQghAVrIYYFQfjMACCFBTYCAEHszAAghgU2AgAghgVBAXIhiQUghQVBBGohigUgigUgiQU2AgAgTSD9BGohiwUgiwVBBGohjAUgjAVBKDYCAEHI0AAoAgAhjQVB/MwAII0FNgIABUGg0AAhEANAAkAgECgCACGOBSAQQQRqIY8FII8FKAIAIZAFII4FIJAFaiGRBSBNIJEFRiGSBSCSBQRAQZoBIcQIDAELIBBBCGohlAUglAUoAgAhlQUglQVBAEYhlgUglgUEQAwBBSCVBSEQCwwBCwsgxAhBmgFGBEAgEEEMaiGXBSCXBSgCACGYBSCYBUEIcSGZBSCZBUEARiGaBSCaBQRAII4FIPYETSGbBSBNIPYESyGcBSCcBSCbBXEhuAgguAgEQCCQBSBMaiGdBSCPBSCdBTYCAEHszAAoAgAhnwUgnwUgTGohoAUg9gRBCGohoQUgoQUhogUgogVBB3EhowUgowVBAEYhpAVBACCiBWshpQUgpQVBB3EhpgUgpAUEf0EABSCmBQshpwUg9gQgpwVqIagFIKAFIKcFayGqBUH4zAAgqAU2AgBB7MwAIKoFNgIAIKoFQQFyIasFIKgFQQRqIawFIKwFIKsFNgIAIPYEIKAFaiGtBSCtBUEEaiGuBSCuBUEoNgIAQcjQACgCACGvBUH8zAAgrwU2AgAMBAsLC0HwzAAoAgAhsAUgTSCwBUkhsQUgsQUEQEHwzAAgTTYCAAsgTSBMaiGyBUGg0AAhKANAAkAgKCgCACGzBSCzBSCyBUYhtQUgtQUEQEGiASHECAwBCyAoQQhqIbYFILYFKAIAIbcFILcFQQBGIbgFILgFBEAMAQUgtwUhKAsMAQsLIMQIQaIBRgRAIChBDGohuQUguQUoAgAhugUgugVBCHEhuwUguwVBAEYhvAUgvAUEQCAoIE02AgAgKEEEaiG9BSC9BSgCACG+BSC+BSBMaiHABSC9BSDABTYCACBNQQhqIcEFIMEFIcIFIMIFQQdxIcMFIMMFQQBGIcQFQQAgwgVrIcUFIMUFQQdxIcYFIMQFBH9BAAUgxgULIccFIE0gxwVqIcgFILIFQQhqIckFIMkFIcsFIMsFQQdxIcwFIMwFQQBGIc0FQQAgywVrIc4FIM4FQQdxIc8FIM0FBH9BAAUgzwULIdAFILIFINAFaiHRBSDRBSHSBSDIBSHTBSDSBSDTBWsh1AUgyAUgCWoh1gUg1AUgCWsh1wUgCUEDciHYBSDIBUEEaiHZBSDZBSDYBTYCACD2BCDRBUYh2gUCQCDaBQRAQezMACgCACHbBSDbBSDXBWoh3AVB7MwAINwFNgIAQfjMACDWBTYCACDcBUEBciHdBSDWBUEEaiHeBSDeBSDdBTYCAAVB9MwAKAIAId8FIN8FINEFRiHhBSDhBQRAQejMACgCACHiBSDiBSDXBWoh4wVB6MwAIOMFNgIAQfTMACDWBTYCACDjBUEBciHkBSDWBUEEaiHlBSDlBSDkBTYCACDWBSDjBWoh5gUg5gUg4wU2AgAMAgsg0QVBBGoh5wUg5wUoAgAh6AUg6AVBA3Eh6QUg6QVBAUYh6gUg6gUEQCDoBUF4cSHsBSDoBUEDdiHtBSDoBUGAAkkh7gUCQCDuBQRAINEFQQhqIe8FIO8FKAIAIfAFINEFQQxqIfEFIPEFKAIAIfIFIPIFIPAFRiHzBSDzBQRAQQEg7QV0IfQFIPQFQX9zIfUFQeDMACgCACH4BSD4BSD1BXEh+QVB4MwAIPkFNgIADAIFIPAFQQxqIfoFIPoFIPIFNgIAIPIFQQhqIfsFIPsFIPAFNgIADAILAAUg0QVBGGoh/AUg/AUoAgAh/QUg0QVBDGoh/gUg/gUoAgAh/wUg/wUg0QVGIYAGAkAggAYEQCDRBUEQaiGGBiCGBkEEaiGHBiCHBigCACGIBiCIBkEARiGJBiCJBgRAIIYGKAIAIYoGIIoGQQBGIYsGIIsGBEBBACE9DAMFIIoGISsghgYhLgsFIIgGISsghwYhLgsgKyEpIC4hLANAAkAgKUEUaiGMBiCMBigCACGOBiCOBkEARiGPBiCPBgRAIClBEGohkAYgkAYoAgAhkQYgkQZBAEYhkgYgkgYEQAwCBSCRBiEqIJAGIS0LBSCOBiEqIIwGIS0LICohKSAtISwMAQsLICxBADYCACApIT0FINEFQQhqIYEGIIEGKAIAIYMGIIMGQQxqIYQGIIQGIP8FNgIAIP8FQQhqIYUGIIUGIIMGNgIAIP8FIT0LCyD9BUEARiGTBiCTBgRADAILINEFQRxqIZQGIJQGKAIAIZUGQZDPACCVBkECdGohlgYglgYoAgAhlwYglwYg0QVGIZkGAkAgmQYEQCCWBiA9NgIAID1BAEYhrQggrQhFBEAMAgtBASCVBnQhmgYgmgZBf3MhmwZB5MwAKAIAIZwGIJwGIJsGcSGdBkHkzAAgnQY2AgAMAwUg/QVBEGohngYgngYoAgAhnwYgnwYg0QVGIaAGIP0FQRRqIaEGIKAGBH8gngYFIKEGCyFbIFsgPTYCACA9QQBGIaIGIKIGBEAMBAsLCyA9QRhqIaQGIKQGIP0FNgIAINEFQRBqIaUGIKUGKAIAIaYGIKYGQQBGIacGIKcGRQRAID1BEGohqAYgqAYgpgY2AgAgpgZBGGohqQYgqQYgPTYCAAsgpQZBBGohqgYgqgYoAgAhqwYgqwZBAEYhrAYgrAYEQAwCCyA9QRRqIa0GIK0GIKsGNgIAIKsGQRhqIa8GIK8GID02AgALCyDRBSDsBWohsAYg7AUg1wVqIbEGILAGIQMgsQYhEQUg0QUhAyDXBSERCyADQQRqIbIGILIGKAIAIbMGILMGQX5xIbQGILIGILQGNgIAIBFBAXIhtQYg1gVBBGohtgYgtgYgtQY2AgAg1gUgEWohtwYgtwYgETYCACARQQN2IbgGIBFBgAJJIboGILoGBEAguAZBAXQhuwZBiM0AILsGQQJ0aiG8BkHgzAAoAgAhvQZBASC4BnQhvgYgvQYgvgZxIb8GIL8GQQBGIcAGIMAGBEAgvQYgvgZyIcEGQeDMACDBBjYCACC8BkEIaiFRILwGIRUgUSFVBSC8BkEIaiHCBiDCBigCACHDBiDDBiEVIMIGIVULIFUg1gU2AgAgFUEMaiHFBiDFBiDWBTYCACDWBUEIaiHGBiDGBiAVNgIAINYFQQxqIccGIMcGILwGNgIADAILIBFBCHYhyAYgyAZBAEYhyQYCQCDJBgRAQQAhFgUgEUH///8HSyHKBiDKBgRAQR8hFgwCCyDIBkGA/j9qIcsGIMsGQRB2IcwGIMwGQQhxIc0GIMgGIM0GdCHOBiDOBkGA4B9qIdAGINAGQRB2IdEGINEGQQRxIdIGINIGIM0GciHTBiDOBiDSBnQh1AYg1AZBgIAPaiHVBiDVBkEQdiHWBiDWBkECcSHXBiDTBiDXBnIh2AZBDiDYBmsh2QYg1AYg1wZ0IdsGINsGQQ92IdwGINkGINwGaiHdBiDdBkEBdCHeBiDdBkEHaiHfBiARIN8GdiHgBiDgBkEBcSHhBiDhBiDeBnIh4gYg4gYhFgsLQZDPACAWQQJ0aiHjBiDWBUEcaiHkBiDkBiAWNgIAINYFQRBqIecGIOcGQQRqIegGIOgGQQA2AgAg5wZBADYCAEHkzAAoAgAh6QZBASAWdCHqBiDpBiDqBnEh6wYg6wZBAEYh7AYg7AYEQCDpBiDqBnIh7QZB5MwAIO0GNgIAIOMGINYFNgIAINYFQRhqIe4GIO4GIOMGNgIAINYFQQxqIe8GIO8GINYFNgIAINYFQQhqIfAGIPAGINYFNgIADAILIOMGKAIAIfIGIPIGQQRqIfMGIPMGKAIAIfQGIPQGQXhxIfUGIPUGIBFGIfYGAkAg9gYEQCDyBiETBSAWQR9GIfcGIBZBAXYh+AZBGSD4Bmsh+QYg9wYEf0EABSD5Bgsh+gYgESD6BnQh+wYg+wYhEiDyBiEUA0ACQCASQR92IYMHIBRBEGoggwdBAnRqIYQHIIQHKAIAIf8GIP8GQQBGIYUHIIUHBEAMAQsgEkEBdCH9BiD/BkEEaiH+BiD+BigCACGAByCAB0F4cSGBByCBByARRiGCByCCBwRAIP8GIRMMBAUg/QYhEiD/BiEUCwwBCwsghAcg1gU2AgAg1gVBGGohhgcghgcgFDYCACDWBUEMaiGIByCIByDWBTYCACDWBUEIaiGJByCJByDWBTYCAAwDCwsgE0EIaiGKByCKBygCACGLByCLB0EMaiGMByCMByDWBTYCACCKByDWBTYCACDWBUEIaiGNByCNByCLBzYCACDWBUEMaiGOByCOByATNgIAINYFQRhqIY8HII8HQQA2AgALCyDIBUEIaiGeCCCeCCEBIMUIJAogAQ8LC0Gg0AAhBANAAkAgBCgCACGQByCQByD2BEshkQcgkQdFBEAgBEEEaiGTByCTBygCACGUByCQByCUB2ohlQcglQcg9gRLIZYHIJYHBEAMAgsLIARBCGohlwcglwcoAgAhmAcgmAchBAwBCwsglQdBUWohmQcgmQdBCGohmgcgmgchmwcgmwdBB3EhnAcgnAdBAEYhngdBACCbB2shnwcgnwdBB3EhoAcgngcEf0EABSCgBwshoQcgmQcgoQdqIaIHIPYEQRBqIaMHIKIHIKMHSSGkByCkBwR/IPYEBSCiBwshpQcgpQdBCGohpgcgpQdBGGohpwcgTEFYaiGpByBNQQhqIaoHIKoHIasHIKsHQQdxIawHIKwHQQBGIa0HQQAgqwdrIa4HIK4HQQdxIa8HIK0HBH9BAAUgrwcLIbAHIE0gsAdqIbEHIKkHILAHayGyB0H4zAAgsQc2AgBB7MwAILIHNgIAILIHQQFyIbQHILEHQQRqIbUHILUHILQHNgIAIE0gqQdqIbYHILYHQQRqIbcHILcHQSg2AgBByNAAKAIAIbgHQfzMACC4BzYCACClB0EEaiG5ByC5B0EbNgIAIKYHQaDQACkCADcCACCmB0EIakGg0ABBCGopAgA3AgBBoNAAIE02AgBBpNAAIEw2AgBBrNAAQQA2AgBBqNAAIKYHNgIAIKcHIbsHA0ACQCC7B0EEaiG6ByC6B0EHNgIAILsHQQhqIbwHILwHIJUHSSG9ByC9BwRAILoHIbsHBQwBCwwBCwsgpQcg9gRGIb8HIL8HRQRAIKUHIcAHIPYEIcEHIMAHIMEHayHCByC5BygCACHDByDDB0F+cSHEByC5ByDEBzYCACDCB0EBciHFByD2BEEEaiHGByDGByDFBzYCACClByDCBzYCACDCB0EDdiHHByDCB0GAAkkhyAcgyAcEQCDHB0EBdCHKB0GIzQAgygdBAnRqIcsHQeDMACgCACHMB0EBIMcHdCHNByDMByDNB3EhzgcgzgdBAEYhzwcgzwcEQCDMByDNB3Ih0AdB4MwAINAHNgIAIMsHQQhqIVAgywchDiBQIVQFIMsHQQhqIdEHINEHKAIAIdIHINIHIQ4g0QchVAsgVCD2BDYCACAOQQxqIdMHINMHIPYENgIAIPYEQQhqIdYHINYHIA42AgAg9gRBDGoh1wcg1wcgywc2AgAMAwsgwgdBCHYh2Acg2AdBAEYh2Qcg2QcEQEEAIQ8FIMIHQf///wdLIdoHINoHBEBBHyEPBSDYB0GA/j9qIdsHINsHQRB2IdwHINwHQQhxId0HINgHIN0HdCHeByDeB0GA4B9qId8HIN8HQRB2IeEHIOEHQQRxIeIHIOIHIN0HciHjByDeByDiB3Qh5Acg5AdBgIAPaiHlByDlB0EQdiHmByDmB0ECcSHnByDjByDnB3Ih6AdBDiDoB2sh6Qcg5Acg5wd0IeoHIOoHQQ92IewHIOkHIOwHaiHtByDtB0EBdCHuByDtB0EHaiHvByDCByDvB3Yh8Acg8AdBAXEh8Qcg8Qcg7gdyIfIHIPIHIQ8LC0GQzwAgD0ECdGoh8wcg9gRBHGoh9Acg9AcgDzYCACD2BEEUaiH1ByD1B0EANgIAIKMHQQA2AgBB5MwAKAIAIfcHQQEgD3Qh+Acg9wcg+AdxIfkHIPkHQQBGIfoHIPoHBEAg9wcg+AdyIfsHQeTMACD7BzYCACDzByD2BDYCACD2BEEYaiH8ByD8ByDzBzYCACD2BEEMaiH9ByD9ByD2BDYCACD2BEEIaiH+ByD+ByD2BDYCAAwDCyDzBygCACH/ByD/B0EEaiGACCCACCgCACGCCCCCCEF4cSGDCCCDCCDCB0YhhAgCQCCECARAIP8HIQwFIA9BH0YhhQggD0EBdiGGCEEZIIYIayGHCCCFCAR/QQAFIIcICyGICCDCByCICHQhiQggiQghCyD/ByENA0ACQCALQR92IZEIIA1BEGogkQhBAnRqIZIIIJIIKAIAIY0III0IQQBGIZMIIJMIBEAMAQsgC0EBdCGKCCCNCEEEaiGLCCCLCCgCACGOCCCOCEF4cSGPCCCPCCDCB0YhkAggkAgEQCCNCCEMDAQFIIoIIQsgjQghDQsMAQsLIJIIIPYENgIAIPYEQRhqIZQIIJQIIA02AgAg9gRBDGohlQgglQgg9gQ2AgAg9gRBCGohlggglggg9gQ2AgAMBAsLIAxBCGohmAggmAgoAgAhmQggmQhBDGohmgggmggg9gQ2AgAgmAgg9gQ2AgAg9gRBCGohmwggmwggmQg2AgAg9gRBDGohnAggnAggDDYCACD2BEEYaiGdCCCdCEEANgIACwsLQezMACgCACGfCCCfCCAJSyGgCCCgCARAIJ8IIAlrIaEIQezMACChCDYCAEH4zAAoAgAhowggowggCWohpAhB+MwAIKQINgIAIKEIQQFyIaUIIKQIQQRqIaYIIKYIIKUINgIAIAlBA3IhpwggowhBBGohqAggqAggpwg2AgAgowhBCGohqQggqQghASDFCCQKIAEPCwtBkNEAQQw2AgBBACEBIMUIJAogAQ8LmhwBqAJ/IwohqAIgAEEARiEdIB0EQA8LIABBeGohjAFB8MwAKAIAIdgBIABBfGoh4wEg4wEoAgAh7gEg7gFBeHEh+QEgjAEg+QFqIYQCIO4BQQFxIY8CII8CQQBGIZoCAkAgmgIEQCCMASgCACEeIO4BQQNxISkgKUEARiE0IDQEQA8LQQAgHmshPyCMASA/aiFKIB4g+QFqIVUgSiDYAUkhYCBgBEAPC0H0zAAoAgAhayBrIEpGIXYgdgRAIIQCQQRqIY4CII4CKAIAIZACIJACQQNxIZECIJECQQNGIZICIJICRQRAIEohCCBVIQkgSiGXAgwDCyBKIFVqIZMCIEpBBGohlAIgVUEBciGVAiCQAkF+cSGWAkHozAAgVTYCACCOAiCWAjYCACCUAiCVAjYCACCTAiBVNgIADwsgHkEDdiGBASAeQYACSSGNASCNAQRAIEpBCGohmAEgmAEoAgAhowEgSkEMaiGuASCuASgCACG5ASC5ASCjAUYhxAEgxAEEQEEBIIEBdCHPASDPAUF/cyHVAUHgzAAoAgAh1gEg1gEg1QFxIdcBQeDMACDXATYCACBKIQggVSEJIEohlwIMAwUgowFBDGoh2QEg2QEguQE2AgAguQFBCGoh2gEg2gEgowE2AgAgSiEIIFUhCSBKIZcCDAMLAAsgSkEYaiHbASDbASgCACHcASBKQQxqId0BIN0BKAIAId4BIN4BIEpGId8BAkAg3wEEQCBKQRBqIeUBIOUBQQRqIeYBIOYBKAIAIecBIOcBQQBGIegBIOgBBEAg5QEoAgAh6QEg6QFBAEYh6gEg6gEEQEEAIRcMAwUg6QEhDCDlASEPCwUg5wEhDCDmASEPCyAMIQogDyENA0ACQCAKQRRqIesBIOsBKAIAIewBIOwBQQBGIe0BIO0BBEAgCkEQaiHvASDvASgCACHwASDwAUEARiHxASDxAQRADAIFIPABIQsg7wEhDgsFIOwBIQsg6wEhDgsgCyEKIA4hDQwBCwsgDUEANgIAIAohFwUgSkEIaiHgASDgASgCACHhASDhAUEMaiHiASDiASDeATYCACDeAUEIaiHkASDkASDhATYCACDeASEXCwsg3AFBAEYh8gEg8gEEQCBKIQggVSEJIEohlwIFIEpBHGoh8wEg8wEoAgAh9AFBkM8AIPQBQQJ0aiH1ASD1ASgCACH2ASD2ASBKRiH3ASD3AQRAIPUBIBc2AgAgF0EARiGlAiClAgRAQQEg9AF0IfgBIPgBQX9zIfoBQeTMACgCACH7ASD7ASD6AXEh/AFB5MwAIPwBNgIAIEohCCBVIQkgSiGXAgwECwUg3AFBEGoh/QEg/QEoAgAh/gEg/gEgSkYh/wEg3AFBFGohgAIg/wEEfyD9AQUggAILIRsgGyAXNgIAIBdBAEYhgQIggQIEQCBKIQggVSEJIEohlwIMBAsLIBdBGGohggIgggIg3AE2AgAgSkEQaiGDAiCDAigCACGFAiCFAkEARiGGAiCGAkUEQCAXQRBqIYcCIIcCIIUCNgIAIIUCQRhqIYgCIIgCIBc2AgALIIMCQQRqIYkCIIkCKAIAIYoCIIoCQQBGIYsCIIsCBEAgSiEIIFUhCSBKIZcCBSAXQRRqIYwCIIwCIIoCNgIAIIoCQRhqIY0CII0CIBc2AgAgSiEIIFUhCSBKIZcCCwsFIIwBIQgg+QEhCSCMASGXAgsLIJcCIIQCSSGYAiCYAkUEQA8LIIQCQQRqIZkCIJkCKAIAIZsCIJsCQQFxIZwCIJwCQQBGIZ0CIJ0CBEAPCyCbAkECcSGeAiCeAkEARiGfAiCfAgRAQfjMACgCACGgAiCgAiCEAkYhoQIgoQIEQEHszAAoAgAhogIgogIgCWohowJB7MwAIKMCNgIAQfjMACAINgIAIKMCQQFyIaQCIAhBBGohHyAfIKQCNgIAQfTMACgCACEgIAggIEYhISAhRQRADwtB9MwAQQA2AgBB6MwAQQA2AgAPC0H0zAAoAgAhIiAiIIQCRiEjICMEQEHozAAoAgAhJCAkIAlqISVB6MwAICU2AgBB9MwAIJcCNgIAICVBAXIhJiAIQQRqIScgJyAmNgIAIJcCICVqISggKCAlNgIADwsgmwJBeHEhKiAqIAlqISsgmwJBA3YhLCCbAkGAAkkhLQJAIC0EQCCEAkEIaiEuIC4oAgAhLyCEAkEMaiEwIDAoAgAhMSAxIC9GITIgMgRAQQEgLHQhMyAzQX9zITVB4MwAKAIAITYgNiA1cSE3QeDMACA3NgIADAIFIC9BDGohOCA4IDE2AgAgMUEIaiE5IDkgLzYCAAwCCwAFIIQCQRhqITogOigCACE7IIQCQQxqITwgPCgCACE9ID0ghAJGIT4CQCA+BEAghAJBEGohRCBEQQRqIUUgRSgCACFGIEZBAEYhRyBHBEAgRCgCACFIIEhBAEYhSSBJBEBBACEYDAMFIEghEiBEIRULBSBGIRIgRSEVCyASIRAgFSETA0ACQCAQQRRqIUsgSygCACFMIExBAEYhTSBNBEAgEEEQaiFOIE4oAgAhTyBPQQBGIVAgUARADAIFIE8hESBOIRQLBSBMIREgSyEUCyARIRAgFCETDAELCyATQQA2AgAgECEYBSCEAkEIaiFAIEAoAgAhQSBBQQxqIUIgQiA9NgIAID1BCGohQyBDIEE2AgAgPSEYCwsgO0EARiFRIFFFBEAghAJBHGohUiBSKAIAIVNBkM8AIFNBAnRqIVQgVCgCACFWIFYghAJGIVcgVwRAIFQgGDYCACAYQQBGIaYCIKYCBEBBASBTdCFYIFhBf3MhWUHkzAAoAgAhWiBaIFlxIVtB5MwAIFs2AgAMBAsFIDtBEGohXCBcKAIAIV0gXSCEAkYhXiA7QRRqIV8gXgR/IFwFIF8LIRwgHCAYNgIAIBhBAEYhYSBhBEAMBAsLIBhBGGohYiBiIDs2AgAghAJBEGohYyBjKAIAIWQgZEEARiFlIGVFBEAgGEEQaiFmIGYgZDYCACBkQRhqIWcgZyAYNgIACyBjQQRqIWggaCgCACFpIGlBAEYhaiBqRQRAIBhBFGohbCBsIGk2AgAgaUEYaiFtIG0gGDYCAAsLCwsgK0EBciFuIAhBBGohbyBvIG42AgAglwIgK2ohcCBwICs2AgBB9MwAKAIAIXEgCCBxRiFyIHIEQEHozAAgKzYCAA8FICshFgsFIJsCQX5xIXMgmQIgczYCACAJQQFyIXQgCEEEaiF1IHUgdDYCACCXAiAJaiF3IHcgCTYCACAJIRYLIBZBA3YheCAWQYACSSF5IHkEQCB4QQF0IXpBiM0AIHpBAnRqIXtB4MwAKAIAIXxBASB4dCF9IHwgfXEhfiB+QQBGIX8gfwRAIHwgfXIhgAFB4MwAIIABNgIAIHtBCGohGSB7IQcgGSEaBSB7QQhqIYIBIIIBKAIAIYMBIIMBIQcgggEhGgsgGiAINgIAIAdBDGohhAEghAEgCDYCACAIQQhqIYUBIIUBIAc2AgAgCEEMaiGGASCGASB7NgIADwsgFkEIdiGHASCHAUEARiGIASCIAQRAQQAhBgUgFkH///8HSyGJASCJAQRAQR8hBgUghwFBgP4/aiGKASCKAUEQdiGLASCLAUEIcSGOASCHASCOAXQhjwEgjwFBgOAfaiGQASCQAUEQdiGRASCRAUEEcSGSASCSASCOAXIhkwEgjwEgkgF0IZQBIJQBQYCAD2ohlQEglQFBEHYhlgEglgFBAnEhlwEgkwEglwFyIZkBQQ4gmQFrIZoBIJQBIJcBdCGbASCbAUEPdiGcASCaASCcAWohnQEgnQFBAXQhngEgnQFBB2ohnwEgFiCfAXYhoAEgoAFBAXEhoQEgoQEgngFyIaIBIKIBIQYLC0GQzwAgBkECdGohpAEgCEEcaiGlASClASAGNgIAIAhBEGohpgEgCEEUaiGnASCnAUEANgIAIKYBQQA2AgBB5MwAKAIAIagBQQEgBnQhqQEgqAEgqQFxIaoBIKoBQQBGIasBAkAgqwEEQCCoASCpAXIhrAFB5MwAIKwBNgIAIKQBIAg2AgAgCEEYaiGtASCtASCkATYCACAIQQxqIa8BIK8BIAg2AgAgCEEIaiGwASCwASAINgIABSCkASgCACGxASCxAUEEaiGyASCyASgCACGzASCzAUF4cSG0ASC0ASAWRiG1AQJAILUBBEAgsQEhBAUgBkEfRiG2ASAGQQF2IbcBQRkgtwFrIbgBILYBBH9BAAUguAELIboBIBYgugF0IbsBILsBIQMgsQEhBQNAAkAgA0EfdiHCASAFQRBqIMIBQQJ0aiHDASDDASgCACG+ASC+AUEARiHFASDFAQRADAELIANBAXQhvAEgvgFBBGohvQEgvQEoAgAhvwEgvwFBeHEhwAEgwAEgFkYhwQEgwQEEQCC+ASEEDAQFILwBIQMgvgEhBQsMAQsLIMMBIAg2AgAgCEEYaiHGASDGASAFNgIAIAhBDGohxwEgxwEgCDYCACAIQQhqIcgBIMgBIAg2AgAMAwsLIARBCGohyQEgyQEoAgAhygEgygFBDGohywEgywEgCDYCACDJASAINgIAIAhBCGohzAEgzAEgygE2AgAgCEEMaiHNASDNASAENgIAIAhBGGohzgEgzgFBADYCAAsLQYDNACgCACHQASDQAUF/aiHRAUGAzQAg0QE2AgAg0QFBAEYh0gEg0gFFBEAPC0Go0AAhAgNAAkAgAigCACEBIAFBAEYh0wEgAUEIaiHUASDTAQRADAEFINQBIQILDAELC0GAzQBBfzYCAA8LUQEIfyMKIQgjCkEQaiQKIwojC04EQEEQEAMLIAghBiAAQTxqIQEgASgCACECIAIQ7QIhAyAGIAM2AgBBBiAGEBohBCAEEOsCIQUgCCQKIAUPC50FAUB/IwohQiMKQTBqJAojCiMLTgRAQTAQAwsgQkEgaiE8IEJBEGohOyBCIR4gAEEcaiEpICkoAgAhNCAeIDQ2AgAgHkEEaiE3IABBFGohOCA4KAIAITkgOSA0ayE6IDcgOjYCACAeQQhqIQogCiABNgIAIB5BDGohCyALIAI2AgAgOiACaiEMIABBPGohDSANKAIAIQ4gHiEPIDsgDjYCACA7QQRqIT0gPSAPNgIAIDtBCGohPiA+QQI2AgBBkgEgOxAYIRAgEBDrAiERIAwgEUYhEgJAIBIEQEEDIUEFQQIhBCAMIQUgHiEGIBEhGgNAAkAgGkEASCEbIBsEQAwBCyAFIBprISQgBkEEaiElICUoAgAhJiAaICZLIScgBkEIaiEoICcEfyAoBSAGCyEJICdBH3RBH3UhKiAEICpqIQggJwR/ICYFQQALISsgGiArayEDIAkoAgAhLCAsIANqIS0gCSAtNgIAIAlBBGohLiAuKAIAIS8gLyADayEwIC4gMDYCACANKAIAITEgCSEyIDwgMTYCACA8QQRqIT8gPyAyNgIAIDxBCGohQCBAIAg2AgBBkgEgPBAYITMgMxDrAiE1ICQgNUYhNiA2BEBBAyFBDAQFIAghBCAkIQUgCSEGIDUhGgsMAQsLIABBEGohHCAcQQA2AgAgKUEANgIAIDhBADYCACAAKAIAIR0gHUEgciEfIAAgHzYCACAEQQJGISAgIARAQQAhBwUgBkEEaiEhICEoAgAhIiACICJrISMgIyEHCwsLIEFBA0YEQCAAQSxqIRMgEygCACEUIABBMGohFSAVKAIAIRYgFCAWaiEXIABBEGohGCAYIBc2AgAgFCEZICkgGTYCACA4IBk2AgAgAiEHCyBCJAogBw8LsQEBEH8jCiESIwpBIGokCiMKIwtOBEBBIBADCyASIQwgEkEUaiEFIABBPGohBiAGKAIAIQcgBSEIIAwgBzYCACAMQQRqIQ0gDUEANgIAIAxBCGohDiAOIAE2AgAgDEEMaiEPIA8gCDYCACAMQRBqIRAgECACNgIAQYwBIAwQFyEJIAkQ6wIhCiAKQQBIIQsgCwRAIAVBfzYCAEF/IQQFIAUoAgAhAyADIQQLIBIkCiAEDwsxAQV/IwohBSAAQYBgSyECIAIEQEEAIABrIQNBkNEAIAM2AgBBfyEBBSAAIQELIAEPCw0BAn8jCiEBQZDRAA8LCwECfyMKIQIgAA8LvAEBEX8jCiETIwpBIGokCiMKIwtOBEBBIBADCyATIQ8gE0EQaiEIIABBJGohCSAJQQI2AgAgACgCACEKIApBwABxIQsgC0EARiEMIAwEQCAAQTxqIQ0gDSgCACEOIAghAyAPIA42AgAgD0EEaiEQIBBBk6gBNgIAIA9BCGohESARIAM2AgBBNiAPEBkhBCAEQQBGIQUgBUUEQCAAQcsAaiEGIAZBfzoAAAsLIAAgASACEOkCIQcgEyQKIAcPC9ABARV/IwohFiAALAAAIQsgASwAACEMIAtBGHRBGHUgDEEYdEEYdUchDSALQRh0QRh1QQBGIQ4gDiANciEUIBQEQCAMIQQgCyEFBSABIQIgACEDA0ACQCADQQFqIQ8gAkEBaiEQIA8sAAAhESAQLAAAIRIgEUEYdEEYdSASQRh0QRh1RyEGIBFBGHRBGHVBAEYhByAHIAZyIRMgEwRAIBIhBCARIQUMAQUgECECIA8hAwsMAQsLCyAFQf8BcSEIIARB/wFxIQkgCCAJayEKIAoPCyABBX8jCiEFIABBUGohASABQQpJIQIgAkEBcSEDIAMPC60DARd/IwohGCMKQeABaiQKIwojC04EQEHgARADCyAYQdABaiEMIBhBoAFqIQ8gGEHQAGohECAYIREgD0IANwMAIA9BCGpCADcDACAPQRBqQgA3AwAgD0EYakIANwMAIA9BIGpCADcDACABKAIAIRYgDCAWNgIAQQAgACAMIBAgDxDyAiESIBJBAEghEyATBEABBUGcIigCACEUQdAhKAIAIRUgFUEgcSECQZoiLAAAIQMgA0EYdEEYdUEBSCEEIAQEQCAVQV9xIQVB0CEgBTYCAAtBgCIoAgAhBiAGQQBGIQcgBwRAQfwhKAIAIQhB/CEgETYCAEHsISARNgIAQeQhIBE2AgBBgCJB0AA2AgAgEUHQAGohCUHgISAJNgIAQdAhIAAgDCAQIA8Q8gIaIAhBAEYhCiAKRQRAQfQhKAIAIQtB0CFBAEEAIAtB/wBxQYADahEHABpB/CEgCDYCAEGAIkEANgIAQeAhQQA2AgBB7CFBADYCAEHkIUEANgIACwVB0CEgACAMIBAgDxDyAhoLQdAhKAIAIQ0gDSACciEOQdAhIA42AgALIBgkCg8L7CkD4wJ/Dn4BfCMKIecCIwpBwABqJAojCiMLTgRAQcAAEAMLIOcCQThqIYYCIOcCQShqIZECIOcCIZwCIOcCQTBqIacCIOcCQTxqIbECIIYCIAE2AgAgAEEARyFEIJwCQShqIU8gTyFZIJwCQSdqIWQgpwJBBGohb0EAIRBBACETQQAhHANAAkAgECEPIBMhEgNAAkAgEkF/SiF5AkAgeQRAQf////8HIBJrIYMBIA8ggwFKIYwBIIwBBEBBkNEAQcsANgIAQX8hIwwCBSAPIBJqIZYBIJYBISMMAgsABSASISMLCyCGAigCACGfASCfASwAACGpASCpAUEYdEEYdUEARiGyASCyAQRAQd0AIeYCDAMLIKkBIb0BIJ8BIdIBA0ACQAJAAkACQAJAIL0BQRh0QRh1QQBrDiYBAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAAILAkBBCiHmAgwEDAMACwALAkAg0gEhFAwDDAIACwALAQsg0gFBAWohxwEghgIgxwE2AgAgxwEsAAAhOyA7Ib0BIMcBIdIBDAELCwJAIOYCQQpGBEBBACHmAiDSASEVINIBIecBA0ACQCDnAUEBaiHcASDcASwAACHvASDvAUEYdEEYdUElRiHwASDwAUUEQCAVIRQMBAsgFUEBaiHxASDnAUECaiHyASCGAiDyATYCACDyASwAACHzASDzAUEYdEEYdUElRiH0ASD0AQRAIPEBIRUg8gEh5wEFIPEBIRQMAQsMAQsLCwsgFCH1ASCfASH2ASD1ASD2AWsh9wEgRARAIAAgnwEg9wEQ9AILIPcBQQBGIfgBIPgBBEAMAQUg9wEhDyAjIRILDAELCyCGAigCACH5ASD5AUEBaiH6ASD6ASwAACH7ASD7AUEYdEEYdSH8ASD8ARDwAiH9ASD9AUEARiH+ASD+AQRAQX8hFyAcIShBASFDBSD5AUECaiH/ASD/ASwAACGAAiCAAkEYdEEYdUEkRiGBAiD8AUFQaiGCAiCBAgR/QQMFQQELIeACIIECBH9BAQUgHAsh4QIggQIEfyCCAgVBfwsh4gIg4gIhFyDhAiEoIOACIUMLIPkBIENqIYMCIIYCIIMCNgIAIIMCLAAAIYQCIIQCQRh0QRh1IYUCIIUCQWBqIYcCIIcCQR9LIYgCQQEghwJ0IYkCIIkCQYnRBHEhigIgigJBAEYhiwIgiAIgiwJyIcECIMECBEBBACEaIIQCITkggwIhmgIFQQAhGyCHAiGNAiCDAiHjAgNAAkBBASCNAnQhjAIgjAIgG3IhjgIg4wJBAWohjwIghgIgjwI2AgAgjwIsAAAhkAIgkAJBGHRBGHUhkgIgkgJBYGohkwIgkwJBH0shlAJBASCTAnQhlQIglQJBidEEcSGWAiCWAkEARiGXAiCUAiCXAnIhwAIgwAIEQCCOAiEaIJACITkgjwIhmgIMAQUgjgIhGyCTAiGNAiCPAiHjAgsMAQsLCyA5QRh0QRh1QSpGIZgCIJgCBEAgmgJBAWohmQIgmQIsAAAhmwIgmwJBGHRBGHUhnQIgnQIQ8AIhngIgngJBAEYhnwIgnwIEQEEaIeYCBSCaAkECaiGgAiCgAiwAACGhAiChAkEYdEEYdUEkRiGiAiCiAgRAIJ0CQVBqIaMCIAQgowJBAnRqIaQCIKQCQQo2AgAgmQIsAAAhpQIgpQJBGHRBGHUhpgIgpgJBUGohqAIgAyCoAkEDdGohqQIgqQIpAwAh9QIg9QKnIaoCIJoCQQNqIasCIKoCIRlBASEwIKsCIeQCBUEaIeYCCwsg5gJBGkYEQEEAIeYCIChBAEYhrAIgrAJFBEBBfyEGDAMLIEQEQCACKAIAIbwCILwCIa0CQQBBBGohywIgywIhygIgygJBAWshwgIgrQIgwgJqIa4CQQBBBGohzwIgzwIhzgIgzgJBAWshzQIgzQJBf3MhzAIgrgIgzAJxIa8CIK8CIbACILACKAIAIbICILACQQRqIb4CIAIgvgI2AgAgsgIhGUEAITAgmQIh5AIFQQAhGUEAITAgmQIh5AILCyCGAiDkAjYCACAZQQBIIbMCIBpBgMAAciG0AkEAIBlrIbUCILMCBH8gtAIFIBoLIdcCILMCBH8gtQIFIBkLIdgCINgCISYg1wIhJyAwITMg5AIhuQIFIIYCEPUCIbYCILYCQQBIIbcCILcCBEBBfyEGDAILIIYCKAIAIT8gtgIhJiAaIScgKCEzID8huQILILkCLAAAIbgCILgCQRh0QRh1QS5GIboCAkAgugIEQCC5AkEBaiG7AiC7AiwAACFFIEVBGHRBGHVBKkYhRiBGRQRAIIYCILsCNgIAIIYCEPUCIV8ghgIoAgAhQSBfIRggQSFADAILILkCQQJqIUcgRywAACFIIEhBGHRBGHUhSSBJEPACIUogSkEARiFLIEtFBEAguQJBA2ohTCBMLAAAIU0gTUEYdEEYdUEkRiFOIE4EQCBJQVBqIVAgBCBQQQJ0aiFRIFFBCjYCACBHLAAAIVIgUkEYdEEYdSFTIFNBUGohVCADIFRBA3RqIVUgVSkDACHpAiDpAqchViC5AkEEaiFXIIYCIFc2AgAgViEYIFchQAwDCwsgM0EARiFYIFhFBEBBfyEGDAMLIEQEQCACKAIAIb0CIL0CIVpBAEEEaiHFAiDFAiHEAiDEAkEBayHDAiBaIMMCaiFbQQBBBGohyQIgyQIhyAIgyAJBAWshxwIgxwJBf3MhxgIgWyDGAnEhXCBcIV0gXSgCACFeIF1BBGohvwIgAiC/AjYCACBeIe0BBUEAIe0BCyCGAiBHNgIAIO0BIRggRyFABUF/IRgguQIhQAsLQQAhFiBAIWEDQAJAIGEsAAAhYCBgQRh0QRh1IWIgYkG/f2ohYyBjQTlLIWUgZQRAQX8hBgwDCyBhQQFqIWYghgIgZjYCACBhLAAAIWcgZ0EYdEEYdSFoIGhBv39qIWlB0AggFkE6bGogaWohaiBqLAAAIWsga0H/AXEhbCBsQX9qIW0gbUEISSFuIG4EQCBsIRYgZiFhBQwBCwwBCwsga0EYdEEYdUEARiFwIHAEQEF/IQYMAQsga0EYdEEYdUETRiFxIBdBf0ohcgJAIHEEQCByBEBBfyEGDAMFQTQh5gILBSByBEAgBCAXQQJ0aiFzIHMgbDYCACADIBdBA3RqIXQgdCkDACHqAiCRAiDqAjcDAEE0IeYCDAILIERFBEBBACEGDAMLIJECIGwgAhD2AkE1IeYCCwsg5gJBNEYEQEEAIeYCIEQEQEE1IeYCBUEAIRELCwJAIOYCQTVGBEBBACHmAiBhLAAAIXUgdUEYdEEYdSF2IBZBAEchdyB2QQ9xIXggeEEDRiF6IHcgenEh0QIgdkFfcSF7INECBH8gewUgdgshCiAnQYDAAHEhfCB8QQBGIX0gJ0H//3txIX4gfQR/ICcFIH4LIdQCAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIApBwQBrDjgNFQsVEA8OFRUVFRUVFRUVFRUMFRUVFQIVFRUVFRUVFREVCAYUExIVBRUVFQkABAEVFQoVBxUVAxULAkAgFkH/AXEh5QICQAJAAkACQAJAAkACQAJAAkAg5QJBGHRBGHVBAGsOCAABAgMEBwUGBwsCQCCRAigCACF/IH8gIzYCAEEAIREMIgwIAAsACwJAIJECKAIAIYABIIABICM2AgBBACERDCEMBwALAAsCQCAjrCHrAiCRAigCACGBASCBASDrAjcDAEEAIREMIAwGAAsACwJAICNB//8DcSGCASCRAigCACGEASCEASCCATsBAEEAIREMHwwFAAsACwJAICNB/wFxIYUBIJECKAIAIYYBIIYBIIUBOgAAQQAhEQweDAQACwALAkAgkQIoAgAhhwEghwEgIzYCAEEAIREMHQwDAAsACwJAICOsIewCIJECKAIAIYgBIIgBIOwCNwMAQQAhEQwcDAIACwALAkBBACERDBsACwALDBYACwALAkAgGEEISyGJASCJAQR/IBgFQQgLIYoBINQCQQhyIYsBQfgAISAgigEhJSCLASEyQcEAIeYCDBUACwALAQsCQCAKISAgGCElINQCITJBwQAh5gIMEwALAAsCQCCRAikDACHuAiDuAiBPEPgCIZQBINQCQQhxIZUBIJUBQQBGIZcBIJQBIZgBIFkgmAFrIZkBIBggmQFKIZoBIJkBQQFqIZsBIJcBIJoBciGcASCcAQR/IBgFIJsBCyHbAiCUASEHQQAhH0HmPiEhINsCIS0g1AIhNiDuAiHyAkHHACHmAgwSAAsACwELAkAgkQIpAwAh7wIg7wJCAFMhnQEgnQEEQEIAIO8CfSHwAiCRAiDwAjcDAEEBIQlB5j4hCyDwAiHxAkHGACHmAgwSBSDUAkGAEHEhngEgngFBAEYhoAEg1AJBAXEhoQEgoQFBAEYhogEgogEEf0HmPgVB6D4LIQUgoAEEfyAFBUHnPgsh3AIg1AJBgRBxIaMBIKMBQQBHIaQBIKQBQQFxId0CIN0CIQkg3AIhCyDvAiHxAkHGACHmAgwSCwAMEAALAAsCQCCRAikDACHoAkEAIQlB5j4hCyDoAiHxAkHGACHmAgwPAAsACwJAIJECKQMAIfMCIPMCp0H/AXEhsQEgZCCxAToAACBkISlBACEqQeY+IStBASE3IH4hOCBZITwMDgALAAsCQEGQ0QAoAgAhswEgswEQ+gIhtAEgtAEhHUHLACHmAgwNAAsACwJAIJECKAIAIbUBILUBQQBGIbYBILYBBH9B8D4FILUBCyG3ASC3ASEdQcsAIeYCDAwACwALAkAgkQIpAwAh9AIg9AKnIb8BIKcCIL8BNgIAIG9BADYCACCRAiCnAjYCAEF/ITUgpwIh7gFB0AAh5gIMCwALAAsCQCAYQQBGIcABIMABBEAgAEEgICZBACDUAhD8AkEAIQ1B2gAh5gIMDAUgkQIoAgAhPSAYITUgPSHuAUHQACHmAgwMCwAMCgALAAsBCwELAQsBCwELAQsBCwJAIJECKwMAIfYCIAAg9gIgJiAYINQCIAoQ/gIh1wEg1wEhEQwFDAIACwALAkAgnwEhKUEAISpB5j4hKyAYITcg1AIhOCBZITwLCwsCQCDmAkHBAEYEQEEAIeYCIJECKQMAIe0CICBBIHEhjQEg7QIgTyCNARD3AiGOASDtAkIAUSGPASAyQQhxIZABIJABQQBGIZEBIJEBII8BciHSAiAgQQR2IZIBQeY+IJIBaiGTASDSAgR/QeY+BSCTAQsh2QIg0gIEf0EABUECCyHaAiCOASEHINoCIR8g2QIhISAlIS0gMiE2IO0CIfICQccAIeYCBSDmAkHGAEYEQEEAIeYCIPECIE8Q+QIhpQEgpQEhByAJIR8gCyEhIBghLSDUAiE2IPECIfICQccAIeYCBSDmAkHLAEYEQEEAIeYCIB0gGBD7AiG4ASC4AUEARiG5ASC4ASG6ASAdIbsBILoBILsBayG8ASAdIBhqIb4BILkBBH8gGAUgvAELITEguQEEfyC+AQUguAELISQgJCFCIB0hKUEAISpB5j4hKyAxITcgfiE4IEIhPAUg5gJB0ABGBEBBACHmAiDuASEIQQAhDgNAAkAgCCgCACHBASDBAUEARiHCASDCAQRAIA4hDAwBCyCxAiDBARD9AiHDASDDAUEASCHEASA1IA5rIcUBIMMBIMUBSyHGASDEASDGAXIh0wIg0wIEQEHUACHmAgwBCyAIQQRqIcgBIMMBIA5qIckBIDUgyQFLIcoBIMoBBEAgyAEhCCDJASEOBSDJASEMDAELDAELCyDmAkHUAEYEQEEAIeYCIMQBBEBBfyEGDAkFIA4hDAsLIABBICAmIAwg1AIQ/AIgDEEARiHLASDLAQRAQQAhDUHaACHmAgUg7gEhHkEAISIDQAJAIB4oAgAhzAEgzAFBAEYhzQEgzQEEQCAMIQ1B2gAh5gIMCAsgsQIgzAEQ/QIhzgEgzgEgImohzwEgzwEgDEoh0AEg0AEEQCAMIQ1B2gAh5gIMCAsgHkEEaiHRASAAILECIM4BEPQCIM8BIAxJIdMBINMBBEAg0QEhHiDPASEiBSAMIQ1B2gAh5gIMAQsMAQsLCwsLCwsLIOYCQccARgRAQQAh5gIgLUF/SiGmASA2Qf//e3EhpwEgpgEEfyCnAQUgNgsh1QIg8gJCAFIhqAEgLUEARyGqASCqASCoAXIh0AIgByGrASBZIKsBayGsASCoAUEBcyGtASCtAUEBcSGuASCsASCuAWohrwEgLSCvAUohsAEgsAEEfyAtBSCvAQshLiDQAgR/IC4FQQALId4CINACBH8gBwUgTwsh3wIg3wIhKSAfISogISErIN4CITcg1QIhOCBZITwFIOYCQdoARgRAQQAh5gIg1AJBgMAAcyHUASAAQSAgJiANINQBEPwCICYgDUoh1QEg1QEEfyAmBSANCyHWASDWASERDAMLCyApIdgBIDwg2AFrIdkBIDcg2QFIIdoBINoBBH8g2QEFIDcLIdYCINYCICpqIdsBICYg2wFIId0BIN0BBH8g2wEFICYLIS8gAEEgIC8g2wEgOBD8AiAAICsgKhD0AiA4QYCABHMh3gEgAEEwIC8g2wEg3gEQ/AIgAEEwINYCINkBQQAQ/AIgACApINkBEPQCIDhBgMAAcyHfASAAQSAgLyDbASDfARD8AiAvIRELCyARIRAgIyETIDMhHAwBCwsCQCDmAkHdAEYEQCAAQQBGIeABIOABBEAgHEEARiHhASDhAQRAQQAhBgVBASEsA0ACQCAEICxBAnRqIeIBIOIBKAIAIeMBIOMBQQBGIeQBIOQBBEAMAQsgAyAsQQN0aiHlASDlASDjASACEPYCICxBAWoh5gEg5gFBCkkh6AEg6AEEQCDmASEsBUEBIQYMBgsMAQsLICwhNEEAIesBA0Ag6wFBAEYh7AEgNEEBaiHpASDsAUUEQEF/IQYMBQsg6QFBCkkh6gEg6gFFBEBBASEGDAULIAQg6QFBAnRqITogOigCACE+IOkBITQgPiHrAQwAAAsACwUgIyEGCwsLIOcCJAogBg8LCwECfyMKIQFBAA8LLAEFfyMKIQcgACgCACEDIANBIHEhBCAEQQBGIQUgBQRAIAEgAiAAEIgDCw8LswEBFH8jCiEUIAAoAgAhAyADLAAAIQsgC0EYdEEYdSEMIAwQ8AIhDSANQQBGIQ4gDgRAQQAhAQVBACECIAMhBiALIREDQAJAIAJBCmwhDyARQRh0QRh1IRAgD0FQaiESIBIgEGohBCAGQQFqIQUgACAFNgIAIAUsAAAhByAHQRh0QRh1IQggCBDwAiEJIAlBAEYhCiAKBEAgBCEBDAEFIAQhAiAFIQYgByERCwwBCwsLIAEPC5kKA5ABfwd+AnwjCiGSASABQRRLIRYCQCAWRQRAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIAFBCWsOCgABAgMEBQYHCAkKCwJAIAIoAgAhNyA3IR9BAEEEaiFNIE0hTCBMQQFrIUsgHyBLaiEpQQBBBGohUSBRIVAgUEEBayFPIE9Bf3MhTiApIE5xITIgMiE0IDQoAgAhNSA0QQRqIUEgAiBBNgIAIAAgNTYCAAwNDAsACwALAkAgAigCACE7IDshNkEAQQRqIVQgVCFTIFNBAWshUiA2IFJqIQVBAEEEaiFYIFghVyBXQQFrIVYgVkF/cyFVIAUgVXEhBiAGIQcgBygCACEIIAdBBGohSCACIEg2AgAgCKwhkwEgACCTATcDAAwMDAoACwALAkAgAigCACE/ID8hCUEAQQRqIVsgWyFaIFpBAWshWSAJIFlqIQpBAEEEaiFfIF8hXiBeQQFrIV0gXUF/cyFcIAogXHEhCyALIQwgDCgCACENIAxBBGohSSACIEk2AgAgDa0hlAEgACCUATcDAAwLDAkACwALAkAgAigCACFAIEAhDkEAQQhqIWIgYiFhIGFBAWshYCAOIGBqIQ9BAEEIaiFmIGYhZSBlQQFrIWQgZEF/cyFjIA8gY3EhECAQIREgESkDACGVASARQQhqIUogAiBKNgIAIAAglQE3AwAMCgwIAAsACwJAIAIoAgAhOCA4IRJBAEEEaiFpIGkhaCBoQQFrIWcgEiBnaiETQQBBBGohbSBtIWwgbEEBayFrIGtBf3MhaiATIGpxIRQgFCEVIBUoAgAhFyAVQQRqIUIgAiBCNgIAIBdB//8DcSEYIBhBEHRBEHWsIZYBIAAglgE3AwAMCQwHAAsACwJAIAIoAgAhOSA5IRlBAEEEaiFwIHAhbyBvQQFrIW4gGSBuaiEaQQBBBGohdCB0IXMgc0EBayFyIHJBf3MhcSAaIHFxIRsgGyEcIBwoAgAhHSAcQQRqIUMgAiBDNgIAIB1B//8DcSEEIAStIZcBIAAglwE3AwAMCAwGAAsACwJAIAIoAgAhOiA6IR5BAEEEaiF3IHchdiB2QQFrIXUgHiB1aiEgQQBBBGoheyB7IXogekEBayF5IHlBf3MheCAgIHhxISEgISEiICIoAgAhIyAiQQRqIUQgAiBENgIAICNB/wFxISQgJEEYdEEYdawhmAEgACCYATcDAAwHDAUACwALAkAgAigCACE8IDwhJUEAQQRqIX4gfiF9IH1BAWshfCAlIHxqISZBAEEEaiGCASCCASGBASCBAUEBayGAASCAAUF/cyF/ICYgf3EhJyAnISggKCgCACEqIChBBGohRSACIEU2AgAgKkH/AXEhAyADrSGZASAAIJkBNwMADAYMBAALAAsCQCACKAIAIT0gPSErQQBBCGohhQEghQEhhAEghAFBAWshgwEgKyCDAWohLEEAQQhqIYkBIIkBIYgBIIgBQQFrIYcBIIcBQX9zIYYBICwghgFxIS0gLSEuIC4rAwAhmgEgLkEIaiFGIAIgRjYCACAAIJoBOQMADAUMAwALAAsCQCACKAIAIT4gPiEvQQBBCGohjAEgjAEhiwEgiwFBAWshigEgLyCKAWohMEEAQQhqIZABIJABIY8BII8BQQFrIY4BII4BQX9zIY0BIDAgjQFxITEgMSEzIDMrAwAhmwEgM0EIaiFHIAIgRzYCACAAIJsBOQMADAQMAgALAAsMAgsLCw8LkAECDn8CfiMKIRAgAEIAUSEIIAgEQCABIQMFIAEhBCAAIREDQAJAIBGnIQkgCUEPcSEKQaAMIApqIQsgCywAACEMIAxB/wFxIQ0gDSACciEOIA5B/wFxIQUgBEF/aiEGIAYgBToAACARQgSIIRIgEkIAUSEHIAcEQCAGIQMMAQUgBiEEIBIhEQsMAQsLCyADDwt1Agp/An4jCiELIABCAFEhBCAEBEAgASECBSAAIQwgASEDA0ACQCAMp0H/AXEhBSAFQQdxIQYgBkEwciEHIANBf2ohCCAIIAc6AAAgDEIDiCENIA1CAFEhCSAJBEAgCCECDAEFIA0hDCAIIQMLDAELCwsgAg8LiAICF38EfiMKIRggAEL/////D1YhECAApyEVIBAEQCAAIRkgASEFA0ACQCAZQgqAIRogGkJ2fiEbIBkgG3whHCAcp0H/AXEhESARQTByIRIgBUF/aiETIBMgEjoAACAZQv////+fAVYhFCAUBEAgGiEZIBMhBQUMAQsMAQsLIBqnIRYgFiECIBMhBAUgFSECIAEhBAsgAkEARiEIIAgEQCAEIQYFIAIhAyAEIQcDQAJAIANBCm5Bf3EhCSAJQXZsIQogAyAKaiELIAtBMHIhDCAMQf8BcSENIAdBf2ohDiAOIA06AAAgA0EKSSEPIA8EQCAOIQYMAQUgCSEDIA4hBwsMAQsLCyAGDwsWAQN/IwohAyAAQfjQABCDAyEBIAEPC5wEATF/IwohMiAAIRogGkEDcSElICVBAEchKSABQQBHISogKiApcSEwAkAgMARAIAAhBCABIQYDQAJAIAQsAAAhKyArQRh0QRh1QQBGISwgLARAIAQhKAwECyAEQQFqIS0gBkF/aiEuIC0hECAQQQNxIREgEUEARyESIC5BAEchEyATIBJxIS8gLwRAIC0hBCAuIQYFIC0hAyAuIQUgEyEOQQUhMQwBCwwBCwsFIAAhAyABIQUgKiEOQQUhMQsLAkAgMUEFRgRAAkAgDgRAIAMsAAAhDyAPQRh0QRh1QQBGIRQgFARAIAVBAEYhJyAnBEAMAwUgAyEoDAULAAsgBUEDSyEVAkAgFQRAIAMhByAFIQoDQAJAIAcoAgAhFiAWQf/9+3dqIRcgFkGAgYKEeHEhGCAYQYCBgoR4cyEZIBkgF3EhGyAbQQBGIRwgHEUEQCAKIQkgByENDAQLIAdBBGohHSAKQXxqIR4gHkEDSyEfIB8EQCAdIQcgHiEKBSAdIQIgHiEIQQshMQwBCwwBCwsFIAMhAiAFIQhBCyExCwsgMUELRgRAIAhBAEYhICAgBEAMAwUgCCEJIAIhDQsLIA0hCyAJIQwDQAJAIAssAAAhISAhQRh0QRh1QQBGISIgIgRAIAshKAwGCyALQQFqISMgDEF/aiEkICRBAEYhJiAmBEAMAQUgIyELICQhDAsMAQsLCwtBACEoCwsgKA8L0gEBEX8jCiEVIwpBgAJqJAojCiMLTgRAQYACEAMLIBUhDiAEQYDABHEhDyAPQQBGIRAgAiADSiERIBEgEHEhEyATBEAgAiADayESIAFBGHRBGHUhByASQYACSSEIIAgEfyASBUGAAgshCSAOIAcgCRDgAxogEkH/AUshCiAKBEAgEiEGA0ACQCAAIA5BgAIQ9AIgBkGAfmohCyALQf8BSyEMIAwEQCALIQYFDAELDAELCyASQf8BcSENIA0hBQUgEiEFCyAAIA4gBRD0AgsgFSQKDwspAQV/IwohBiAAQQBGIQMgAwRAQQAhAgUgACABEIIDIQQgBCECCyACDwvNMgPjA38RfiF8Iwoh6AMjCkGwBGokCiMKIwtOBEBBsAQQAwsg6ANBIGohpQMg6ANBmARqIa8DIOgDIboDILoDIcIDIOgDQZwEaiFgIK8DQQA2AgAgYEEMaiFrIAEQ/wIh6wMg6wNCAFMhfCB8BEAgAZohhgQghgQQ/wIh6gMghgQh+gNBASEVQfc+IRYg6gMh6QMFIARBgBBxIYkBIIkBQQBGIZQBIARBAXEhnwEgnwFBAEYhqgEgqgEEf0H4PgVB/T4LIQYglAEEfyAGBUH6Pgsh5QMgBEGBEHEhtQEgtQFBAEchwAEgwAFBAXEh5gMgASH6AyDmAyEVIOUDIRYg6wMh6QMLIOkDQoCAgICAgID4/wCDIfQDIPQDQoCAgICAgID4/wBRIdUBAkAg1QEEQCAFQSBxIeABIOABQQBHIeoBIOoBBH9Bij8FQY4/CyHzASD6AyD6A2JEAAAAAAAAAABEAAAAAAAAAABiciH+ASDqAQR/QZI/BUGWPwshiQIg/gEEfyCJAgUg8wELIRIgFUEDaiGUAiAEQf//e3EhnwIgAEEgIAIglAIgnwIQ/AIgACAWIBUQ9AIgACASQQMQ9AIgBEGAwABzIaoCIABBICACIJQCIKoCEPwCIJQCIV8FIPoDIK8DEIADIYoEIIoERAAAAAAAAABAoiGLBCCLBEQAAAAAAAAAAGIhyAIgyAIEQCCvAygCACHSAiDSAkF/aiHdAiCvAyDdAjYCAAsgBUEgciHnAiDnAkHhAEYh8gIg8gIEQCAFQSBxIf0CIP0CQQBGIYcDIBZBCWohkgMghwMEfyAWBSCSAwsh1wMgFUECciGZAyADQQtLIZoDQQwgA2shmwMgmwNBAEYhnAMgmgMgnANyIZ0DAkAgnQMEQCCLBCH+AwVEAAAAAAAAIEAh+wMgmwMhIgNAAkAgIkF/aiGeAyD7A0QAAAAAAAAwQKIhjAQgngNBAEYhnwMgnwMEQAwBBSCMBCH7AyCeAyEiCwwBCwsg1wMsAAAhoAMgoANBGHRBGHVBLUYhoQMgoQMEQCCLBJohjQQgjQQgjAShIY4EIIwEII4EoCGPBCCPBJohkAQgkAQh/gMMAgUgiwQgjASgIZEEIJEEIIwEoSGSBCCSBCH+AwwCCwALCyCvAygCACGiAyCiA0EASCGjA0EAIKIDayGkAyCjAwR/IKQDBSCiAwshpgMgpgOsIfkDIPkDIGsQ+QIhpwMgpwMga0YhqAMgqAMEQCBgQQtqIakDIKkDQTA6AAAgqQMhEwUgpwMhEwsgogNBH3UhqgMgqgNBAnEhqwMgqwNBK2ohrAMgrANB/wFxIa0DIBNBf2ohrgMgrgMgrQM6AAAgBUEPaiGwAyCwA0H/AXEhsQMgE0F+aiGyAyCyAyCxAzoAACADQQFIIbMDIARBCHEhtAMgtANBAEYhtQMgugMhFyD+AyH/AwNAAkAg/wOqIbYDQaAMILYDaiG3AyC3AywAACG4AyC4A0H/AXEhuQMg/QIguQNyIbsDILsDQf8BcSG8AyAXQQFqIb0DIBcgvAM6AAAgtgO3IZMEIP8DIJMEoSGUBCCUBEQAAAAAAAAwQKIhlQQgvQMhvgMgvgMgwgNrIb8DIL8DQQFGIcADIMADBEAglQREAAAAAAAAAABhIcEDILMDIMEDcSHPAyC1AyDPA3EhzgMgzgMEQCC9AyEmBSAXQQJqIcMDIL0DQS46AAAgwwMhJgsFIL0DISYLIJUERAAAAAAAAAAAYiHEAyDEAwRAICYhFyCVBCH/AwUMAQsMAQsLIANBAEYhxQMgJiFeIMUDBEBBGSHnAwVBfiDCA2shxgMgxgMgXmohxwMgxwMgA0ghyAMgyAMEQCBrIckDILIDIcoDIANBAmohywMgywMgyQNqIcwDIMwDIMoDayFhIGEhGCDJAyFcIMoDIV0FQRkh5wMLCyDnA0EZRgRAIGshYiCyAyFjIGIgwgNrIWQgZCBjayFlIGUgXmohZiBmIRggYiFcIGMhXQsgGCCZA2ohZyAAQSAgAiBnIAQQ/AIgACDXAyCZAxD0AiAEQYCABHMhaCAAQTAgAiBnIGgQ/AIgXiDCA2shaSAAILoDIGkQ9AIgXCBdayFqIGkgamohbCAYIGxrIW0gAEEwIG1BAEEAEPwCIAAgsgMgahD0AiAEQYDAAHMhbiAAQSAgAiBnIG4Q/AIgZyFfDAILIANBAEghbyBvBH9BBgUgAwsh2AMgyAIEQCCLBEQAAAAAAACwQaIhggQgrwMoAgAhcCBwQWRqIXEgrwMgcTYCACCCBCGABCBxIVkFIK8DKAIAIVsgiwQhgAQgWyFZCyBZQQBIIXIgpQNBoAJqIXMgcgR/IKUDBSBzCyERIBEhISCABCGBBANAAkAggQSrIXQgISB0NgIAICFBBGohdSB0uCGDBCCBBCCDBKEhhAQghAREAAAAAGXNzUGiIYUEIIUERAAAAAAAAAAAYiF2IHYEQCB1ISEghQQhgQQFDAELDAELCyARIXcgWUEASiF4IHgEQCARIR8gdSEyIFkheQNAAkAgeUEdSCF6IHoEfyB5BUEdCyF7IDJBfGohDiAOIB9JIX0gfQRAIB8hLgUge60h7AMgDiEPQQAhEANAAkAgDygCACF+IH6tIe0DIO0DIOwDhiHuAyAQrSHvAyDuAyDvA3wh8AMg8ANCgJTr3AOAIfEDIPEDQoDslKN8fiHyAyDwAyDyA3wh8wMg8wOnIX8gDyB/NgIAIPEDpyGAASAPQXxqIQ0gDSAfSSGBASCBAQRADAEFIA0hDyCAASEQCwwBCwsggAFBAEYhggEgggEEQCAfIS4FIB9BfGohgwEggwEggAE2AgAggwEhLgsLIDIgLkshhAECQCCEAQRAIDIhOwNAAkAgO0F8aiGFASCFASgCACGHASCHAUEARiGIASCIAUUEQCA7IToMBAsghQEgLkshhgEghgEEQCCFASE7BSCFASE6DAELDAELCwUgMiE6CwsgrwMoAgAhigEgigEge2shiwEgrwMgiwE2AgAgiwFBAEohjAEgjAEEQCAuIR8gOiEyIIsBIXkFIC4hHiA6ITEgiwEhWgwBCwwBCwsFIBEhHiB1ITEgWSFaCyBaQQBIIY0BII0BBEAg2ANBGWohjgEgjgFBCW1Bf3EhjwEgjwFBAWohkAEg5wJB5gBGIZEBIB4hOSAxIUEgWiGTAQNAAkBBACCTAWshkgEgkgFBCUghlQEglQEEfyCSAQVBCQshlgEgOSBBSSGXASCXAQRAQQEglgF0IZsBIJsBQX9qIZwBQYCU69wDIJYBdiGdAUEAIQwgOSEgA0ACQCAgKAIAIZ4BIJ4BIJwBcSGgASCeASCWAXYhoQEgoQEgDGohogEgICCiATYCACCgASCdAWwhowEgIEEEaiGkASCkASBBSSGlASClAQRAIKMBIQwgpAEhIAUMAQsMAQsLIDkoAgAhpgEgpgFBAEYhpwEgOUEEaiGoASCnAQR/IKgBBSA5CyHZAyCjAUEARiGpASCpAQRAIEEhRyDZAyHbAwUgQUEEaiGrASBBIKMBNgIAIKsBIUcg2QMh2wMLBSA5KAIAIZgBIJgBQQBGIZkBIDlBBGohmgEgmQEEfyCaAQUgOQsh2gMgQSFHINoDIdsDCyCRAQR/IBEFINsDCyGsASBHIa0BIKwBIa4BIK0BIK4BayGvASCvAUECdSGwASCwASCQAUohsQEgrAEgkAFBAnRqIbIBILEBBH8gsgEFIEcLIdwDIK8DKAIAIbMBILMBIJYBaiG0ASCvAyC0ATYCACC0AUEASCG2ASC2AQRAINsDITkg3AMhQSC0ASGTAQUg2wMhOCDcAyFADAELDAELCwUgHiE4IDEhQAsgOCBASSG3ASC3AQRAIDghuAEgdyC4AWshuQEguQFBAnUhugEgugFBCWwhuwEgOCgCACG8ASC8AUEKSSG9ASC9AQRAILsBISUFILsBIRRBCiEbA0ACQCAbQQpsIb4BIBRBAWohvwEgvAEgvgFJIcEBIMEBBEAgvwEhJQwBBSC/ASEUIL4BIRsLDAELCwsFQQAhJQsg5wJB5gBGIcIBIMIBBH9BAAUgJQshwwEg2AMgwwFrIcQBIOcCQecARiHFASDYA0EARyHGASDGASDFAXEhxwEgxwFBH3RBH3UhVSDEASBVaiHIASBAIckBIMkBIHdrIcoBIMoBQQJ1IcsBIMsBQQlsIcwBIMwBQXdqIc0BIMgBIM0BSCHOASDOAQRAIBFBBGohzwEgyAFBgMgAaiHQASDQAUEJbUF/cSHRASDRAUGAeGoh0gEgzwEg0gFBAnRqIdMBINEBQXdsIdQBINABINQBaiHWASDWAUEISCHXASDXAQRAINYBIRpBCiEqA0ACQCAaQQFqIRkgKkEKbCHYASAaQQdIIdkBINkBBEAgGSEaINgBISoFINgBISkMAQsMAQsLBUEKISkLINMBKAIAIdoBINoBICluQX9xIdsBINsBIClsIdwBINoBINwBayHdASDdAUEARiHeASDTAUEEaiHfASDfASBARiHhASDhASDeAXEh0AMg0AMEQCDTASE/ICUhQiA4IU4FINsBQQFxIeIBIOIBQQBGIeMBIOMBBHxEAAAAAAAAQEMFRAEAAAAAAEBDCyGWBCApQQF2IeQBIN0BIOQBSSHlASDdASDkAUYh5gEg4QEg5gFxIdEDINEDBHxEAAAAAAAA8D8FRAAAAAAAAPg/CyGXBCDlAQR8RAAAAAAAAOA/BSCXBAshmAQgFUEARiHnASDnAQRAIJgEIfwDIJYEIf0DBSAWLAAAIegBIOgBQRh0QRh1QS1GIekBIJYEmiGHBCCYBJohiAQg6QEEfCCHBAUglgQLIZkEIOkBBHwgiAQFIJgECyGaBCCaBCH8AyCZBCH9Awsg0wEg3AE2AgAg/QMg/AOgIYkEIIkEIP0DYiHrASDrAQRAINwBIClqIewBINMBIOwBNgIAIOwBQf+T69wDSyHtASDtAQRAINMBITAgOCFFA0ACQCAwQXxqIe4BIDBBADYCACDuASBFSSHvASDvAQRAIEVBfGoh8AEg8AFBADYCACDwASFLBSBFIUsLIO4BKAIAIfEBIPEBQQFqIfIBIO4BIPIBNgIAIPIBQf+T69wDSyH0ASD0AQRAIO4BITAgSyFFBSDuASEvIEshRAwBCwwBCwsFINMBIS8gOCFECyBEIfUBIHcg9QFrIfYBIPYBQQJ1IfcBIPcBQQlsIfgBIEQoAgAh+QEg+QFBCkkh+gEg+gEEQCAvIT8g+AEhQiBEIU4FIPgBITRBCiE2A0ACQCA2QQpsIfsBIDRBAWoh/AEg+QEg+wFJIf0BIP0BBEAgLyE/IPwBIUIgRCFODAEFIPwBITQg+wEhNgsMAQsLCwUg0wEhPyAlIUIgOCFOCwsgP0EEaiH/ASBAIP8BSyGAAiCAAgR/IP8BBSBACyHdAyBCIUgg3QMhTyBOIVAFICUhSCBAIU8gOCFQC0EAIEhrIYECIE8gUEshggICQCCCAgRAIE8hUgNAAkAgUkF8aiGDAiCDAigCACGFAiCFAkEARiGGAiCGAkUEQCBSIVFBASFTDAQLIIMCIFBLIYQCIIQCBEAggwIhUgUggwIhUUEAIVMMAQsMAQsLBSBPIVFBACFTCwsCQCDFAQRAIMYBQQFzIc0DIM0DQQFxIYcCINgDIIcCaiHeAyDeAyBISiGIAiBIQXtKIYoCIIgCIIoCcSHUAyDUAwRAIAVBf2ohiwIg3gNBf2ohViBWIEhrIYwCIIsCIQsgjAIhLQUgBUF+aiGNAiDeA0F/aiGOAiCNAiELII4CIS0LIARBCHEhjwIgjwJBAEYhkAIgkAIEQCBTBEAgUUF8aiGRAiCRAigCACGSAiCSAkEARiGTAiCTAgRAQQkhNQUgkgJBCnBBf3EhlQIglQJBAEYhlgIglgIEQEEAIShBCiE8A0ACQCA8QQpsIZcCIChBAWohmAIgkgIglwJwQX9xIZkCIJkCQQBGIZoCIJoCBEAgmAIhKCCXAiE8BSCYAiE1DAELDAELCwVBACE1CwsFQQkhNQsgC0EgciGbAiCbAkHmAEYhnAIgUSGdAiCdAiB3ayGeAiCeAkECdSGgAiCgAkEJbCGhAiChAkF3aiGiAiCcAgRAIKICIDVrIaMCIKMCQQBKIaQCIKQCBH8gowIFQQALId8DIC0g3wNIIaUCIKUCBH8gLQUg3wMLIeMDIAshHSDjAyE3DAMFIKICIEhqIaYCIKYCIDVrIacCIKcCQQBKIagCIKgCBH8gpwIFQQALIeADIC0g4ANIIakCIKkCBH8gLQUg4AMLIeQDIAshHSDkAyE3DAMLAAUgCyEdIC0hNwsFIAUhHSDYAyE3CwsgN0EARyGrAiAEQQN2IawCIKwCQQFxIVQgqwIEf0EBBSBUCyGtAiAdQSByIa4CIK4CQeYARiGvAiCvAgRAIEhBAEohsAIgsAIEfyBIBUEACyGxAkEAITMgsQIhWAUgSEEASCGyAiCyAgR/IIECBSBICyGzAiCzAqwh9QMg9QMgaxD5AiG0AiBrIbUCILQCIbYCILUCILYCayG3AiC3AkECSCG4AiC4AgRAILQCISQDQAJAICRBf2ohuQIguQJBMDoAACC5AiG6AiC1AiC6AmshuwIguwJBAkghvAIgvAIEQCC5AiEkBSC5AiEjDAELDAELCwUgtAIhIwsgSEEfdSG9AiC9AkECcSG+AiC+AkEraiG/AiC/AkH/AXEhwAIgI0F/aiHBAiDBAiDAAjoAACAdQf8BcSHCAiAjQX5qIcMCIMMCIMICOgAAIMMCIcQCILUCIMQCayHFAiDDAiEzIMUCIVgLIBVBAWohxgIgxgIgN2ohxwIgxwIgrQJqIScgJyBYaiHJAiAAQSAgAiDJAiAEEPwCIAAgFiAVEPQCIARBgIAEcyHKAiAAQTAgAiDJAiDKAhD8AiCvAgRAIFAgEUshywIgywIEfyARBSBQCyHhAyC6A0EJaiHMAiDMAiHNAiC6A0EIaiHOAiDhAyFGA0ACQCBGKAIAIc8CIM8CrSH2AyD2AyDMAhD5AiHQAiBGIOEDRiHRAiDRAgRAINACIMwCRiHYAiDYAgRAIM4CQTA6AAAgzgIhHAUg0AIhHAsFINACILoDSyHTAiDTAgRAINACIdQCINQCIMIDayHVAiC6A0EwINUCEOADGiDQAiEKA0ACQCAKQX9qIdYCINYCILoDSyHXAiDXAgRAINYCIQoFINYCIRwMAQsMAQsLBSDQAiEcCwsgHCHZAiDNAiDZAmsh2gIgACAcINoCEPQCIEZBBGoh2wIg2wIgEUsh3AIg3AIEQAwBBSDbAiFGCwwBCwsgqwJBAXMhVyAEQQhxId4CIN4CQQBGId8CIN8CIFdxIdIDINIDRQRAIABBmj9BARD0Agsg2wIgUUkh4AIgN0EASiHhAiDgAiDhAnEh4gIg4gIEQCA3IT4g2wIhTANAAkAgTCgCACHjAiDjAq0h9wMg9wMgzAIQ+QIh5AIg5AIgugNLIeUCIOUCBEAg5AIh5gIg5gIgwgNrIegCILoDQTAg6AIQ4AMaIOQCIQkDQAJAIAlBf2oh6QIg6QIgugNLIeoCIOoCBEAg6QIhCQUg6QIhCAwBCwwBCwsFIOQCIQgLID5BCUgh6wIg6wIEfyA+BUEJCyHsAiAAIAgg7AIQ9AIgTEEEaiHtAiA+QXdqIe4CIO0CIFFJIe8CID5BCUoh8AIg7wIg8AJxIfECIPECBEAg7gIhPiDtAiFMBSDuAiE9DAELDAELCwUgNyE9CyA9QQlqIfMCIABBMCDzAkEJQQAQ/AIFIFBBBGoh9AIgUwR/IFEFIPQCCyHiAyBQIOIDSSH1AiA3QX9KIfYCIPUCIPYCcSH3AiD3AgRAILoDQQlqIfgCIARBCHEh+QIg+QJBAEYh+gIg+AIh+wJBACDCA2sh/AIgugNBCGoh/gIgNyFKIFAhTQNAAkAgTSgCACH/AiD/Aq0h+AMg+AMg+AIQ+QIhgAMggAMg+AJGIYEDIIEDBEAg/gJBMDoAACD+AiEHBSCAAyEHCyBNIFBGIYIDAkAgggMEQCAHQQFqIYYDIAAgB0EBEPQCIEpBAUghiAMg+gIgiANxIdMDINMDBEAghgMhLAwCCyAAQZo/QQEQ9AIghgMhLAUgByC6A0shgwMggwNFBEAgByEsDAILIAcg/AJqIdUDINUDIdYDILoDQTAg1gMQ4AMaIAchKwNAAkAgK0F/aiGEAyCEAyC6A0shhQMghQMEQCCEAyErBSCEAyEsDAELDAELCwsLICwhiQMg+wIgiQNrIYoDIEogigNKIYsDIIsDBH8gigMFIEoLIYwDIAAgLCCMAxD0AiBKIIoDayGNAyBNQQRqIY4DII4DIOIDSSGPAyCNA0F/SiGQAyCPAyCQA3EhkQMgkQMEQCCNAyFKII4DIU0FII0DIUMMAQsMAQsLBSA3IUMLIENBEmohkwMgAEEwIJMDQRJBABD8AiBrIZQDIDMhlQMglAMglQNrIZYDIAAgMyCWAxD0AgsgBEGAwABzIZcDIABBICACIMkCIJcDEPwCIMkCIV8LCyBfIAJIIZgDIJgDBH8gAgUgXwshSSDoAyQKIEkPCxICAn8BfiMKIQIgAL0hAyADDwsWAgJ/AXwjCiEDIAAgARCBAyEEIAQPC/URAwt/BH4FfCMKIQwgAL0hDyAPQjSIIRAgEKdB//8DcSEJIAlB/w9xIQoCQAJAAkACQCAKQRB0QRB1QQBrDoAQAAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgECCwJAIABEAAAAAAAAAABiIQQgBARAIABEAAAAAAAA8EOiIRQgFCABEIEDIRUgASgCACEFIAVBQGohBiAVIRIgBiEIBSAAIRJBACEICyABIAg2AgAgEiERDAMACwALAkAgACERDAIACwALAkAgEKchByAHQf8PcSECIAJBgnhqIQMgASADNgIAIA9C/////////4eAf4MhDSANQoCAgICAgIDwP4QhDiAOvyETIBMhEQsLIBEPC88EATZ/IwohNyAAQQBGIQ0CQCANBEBBASECBSABQYABSSEYIBgEQCABQf8BcSEjIAAgIzoAAEEBIQIMAgtB+NAAKAIAIS4gLkEARiExIDEEQCABQYB/cSEyIDJBgL8DRiEzIDMEQCABQf8BcSE0IAAgNDoAAEEBIQIMAwVBkNEAQdQANgIAQX8hAgwDCwALIAFBgBBJIQMgAwRAIAFBBnYhBCAEQcABciEFIAVB/wFxIQYgAEEBaiEHIAAgBjoAACABQT9xIQggCEGAAXIhCSAJQf8BcSEKIAcgCjoAAEECIQIMAgsgAUGAsANJIQsgAUGAQHEhDCAMQYDAA0YhDiALIA5yITUgNQRAIAFBDHYhDyAPQeABciEQIBBB/wFxIREgAEEBaiESIAAgEToAACABQQZ2IRMgE0E/cSEUIBRBgAFyIRUgFUH/AXEhFiAAQQJqIRcgEiAWOgAAIAFBP3EhGSAZQYABciEaIBpB/wFxIRsgFyAbOgAAQQMhAgwCCyABQYCAfGohHCAcQYCAwABJIR0gHQRAIAFBEnYhHiAe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C2oRBgAPCygBBX8jCiEEQaTRACgCACEAIABBAGohAUGk0QAgATYCACAAIQIgAg8LeAEKfyMKIQwjCkEQaiQKIwojC04EQEEQEAMLIAwhBCACKAIAIQUgBCAFNgIAIAAoAgAhBiAGQRBqIQcgBygCACEIIAAgASAEIAhB/wBxQYADahEHACEJIAlBAXEhCiAJBEAgBCgCACEDIAIgAzYCAAsgDCQKIAoPCzgBB38jCiEHIABBAEYhASABBEBBACEDBSAAQeAeELwDIQIgAkEARyEEIARBAXEhBSAFIQMLIAMPCwMAAQssACAAQf8BcUEYdCAAQQh1Qf8BcUEQdHIgAEEQdUH/AXFBCHRyIABBGHZyDwvkBAEEfyACQYDAAE4EQCAAIAEgAhAxDwsgACEDIAAgAmohBiAAQQNxIAFBA3FGBEADQAJAIABBA3FFBEAMAQsCQCACQQBGBEAgAw8LIAAgASwAADoAACAAQQFqIQAgAUEBaiEBIAJBAWshAgsMAQsLIAZBfHEhBCAEQcAAayEFA0ACQCAAIAVMRQRADAELAkAgACABKAIANgIAIABBBGogAUEEaigCADYCACAAQQhqIAFBCGooAgA2AgAgAEEMaiABQQxqKAIANgIAIABBEGogAUEQaigCADYCACAAQRRqIAFBFGooAgA2AgAgAEEYaiABQRhqKAIANgIAIABBHGogAUEcaigCADYCACAAQSBqIAFBIGooAgA2AgAgAEEkaiABQSRqKAIANgIAIABBKGogAUEoaigCADYCACAAQSxqIAFBLGooAgA2AgAgAEEwaiABQTBqKAIANgIAIABBNGogAUE0aigCADYCACAAQThqIAFBOGooAgA2AgAgAEE8aiABQTxqKAIANgIAIABBwABqIQAgAUHAAGohAQsMAQsLA0ACQCAAIARIRQRADAELAkAgACABKAIANgIAIABBBGohACABQQRqIQELDAELCwUgBkEEayEEA0ACQCAAIARIRQRADAELAkAgACABLAAAOgAAIABBAWogAUEBaiwAADoAACAAQQJqIAFBAmosAAA6AAAgAEEDaiABQQNqLAAAOgAAIABBBGohACABQQRqIQELDAELCwsDQAJAIAAgBkhFBEAMAQsCQCAAIAEsAAA6AAAgAEEBaiEAIAFBAWohAQsMAQsLIAMPC24BAX8gASAASCAA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bGFyZ2UgZm9yIGRhdGEgdHlwZQBObyBzcGFjZSBsZWZ0IG9uIGRldmljZQBPdXQgb2YgbWVtb3J5AFJlc291cmNlIGJ1c3kASW50ZXJydXB0ZWQgc3lzdGVtIGNhbGwAUmVzb3VyY2UgdGVtcG9yYXJpbHkgdW5hdmFpbGFibGUASW52YWxpZCBzZWVrAENyb3NzLWRldmljZSBsaW5rAFJlYWQtb25seSBmaWxlIHN5c3RlbQBEaXJlY3Rvcnkgbm90IGVtcHR5AENvbm5lY3Rpb24gcmVzZXQgYnkgcGVlcgBPcGVyYXRpb24gdGltZWQgb3V0AENvbm5lY3Rpb24gcmVmdXNlZABIb3N0IGlzIGRvd24ASG9zdCBpcyB1bnJlYWNoYWJsZQBBZGRyZXNzIGluIHVzZQBCcm9rZW4gcGlwZQBJL08gZXJyb3IATm8gc3VjaCBkZXZpY2Ugb3IgYWRkcmVzcwBCbG9jayBkZXZpY2UgcmVxdWlyZWQATm8gc3VjaCBkZXZpY2UATm90IGEgZGlyZWN0b3J5AElzIGEgZGlyZWN0b3J5AFRleHQgZmlsZSBidXN5AEV4ZWMgZm9ybWF0IGVycm9yAEludmFsaWQgYXJndW1lbnQAQXJndW1lbnQgbGlzdCB0b28gbG9uZwBTeW1ib2xpYyBsaW5rIGxvb3AARmlsZW5hbWUgdG9vIGxvbmcAVG9vIG1hbnkgb3BlbiBmaWxlcyBpbiBzeXN0ZW0ATm8gZmlsZSBkZXNjcmlwdG9ycyBhdmFpbGFibGUAQmFkIGZpbGUgZGVzY3JpcHRvcgBObyBjaGlsZCBwcm9jZXNzAEJhZCBhZGRyZXNzAEZpbGUgdG9vIGxhcmdlAFRvbyBtYW55IGxpbmtzAE5vIGxvY2tzIGF2YWlsYWJsZQBSZXNvdXJjZSBkZWFkbG9jayB3b3VsZCBvY2N1cgBTdGF0ZSBub3QgcmVjb3ZlcmFibGUAUHJldmlvdXMgb3duZXIgZGllZABPcGVyYXRpb24gY2FuY2VsZWQARnVuY3Rpb24gbm90IGltcGxlbWVudGVkAE5vIG1lc3NhZ2Ugb2YgZGVzaXJlZCB0eXBlAElkZW50aWZpZXIgcmVtb3ZlZABEZXZpY2Ugbm90IGEgc3RyZWFtAE5vIGRhdGEgYXZhaWxhYmxlAERldmljZSB0aW1lb3V0AE91dCBvZiBzdHJlYW1zIHJlc291cmNlcwBMaW5rIGhhcyBiZWVuIHNldmVyZWQAUHJvdG9jb2wgZXJyb3IAQmFkIG1lc3NhZ2UARmlsZSBkZXNjcmlwdG9yIGluIGJhZCBzdGF0ZQBOb3QgYSBzb2NrZXQARGVzdGluYXRpb24gYWRkcmVzcyByZXF1aXJlZABNZXNzYWdlIHRvbyBsYXJnZQBQcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQAUHJvdG9jb2wgbm90IGF2YWlsYWJsZQBQcm90b2NvbCBub3Qgc3VwcG9ydGVkAFNvY2tldCB0eXBlIG5vdCBzdXBwb3J0ZWQATm90IHN1cHBvcnRlZABQcm90b2NvbCBmYW1pbHkgbm90IHN1cHBvcnRlZABBZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkIGJ5IHByb3RvY29sAEFkZHJlc3Mgbm90IGF2YWlsYWJsZQBOZXR3b3JrIGlzIGRvd24ATmV0d29yayB1bnJlYWNoYWJsZQBDb25uZWN0aW9uIHJlc2V0IGJ5IG5ldHdvcmsAQ29ubmVjdGlvbiBhYm9ydGVkAE5vIGJ1ZmZlciBzcGFjZSBhdmFpbGFibGUAU29ja2V0IGlzIGNvbm5lY3RlZABTb2NrZXQgbm90IGNvbm5lY3RlZABDYW5ub3Qgc2VuZCBhZnRlciBzb2NrZXQgc2h1dGRvd24AT3BlcmF0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MAT3BlcmF0aW9uIGluIHByb2dyZXNzAFN0YWxlIGZpbGUgaGFuZGxlAFJlbW90ZSBJL08gZXJyb3IAUXVvdGEgZXhjZWVkZWQATm8gbWVkaXVtIGZvdW5kAFdyb25nIG1lZGl1bSB0eXBlAE5vIGVycm9yIGluZm9ybWF0aW9uAAAAAAAA2BEAADcYAABsEgAAHBgAAAAAAADYDQAAiBIAALcXAAAAAAAAAQAAANANAAAAAAAA2BEAAPYXAADYEQAAKhgAAGwSAABRGAAAAQAAANgNAADYEQAARxgAANgRAABmGAAAiBIAALYYAAAAAAAAAQAAABgOAAAAAAAAiBIAAAwZAAAAAAAAAQAAADAOAAAAAAAA2BEAAGoZAADYEQAAjxkAAGwSAACiGQAAAQAAAAAOAABsEgAAABoAAAAAAAAADgAA2BEAAG0cAADYEQAArBwAANgRAADqHAAA2BEAADAdAADYEQAAbR0AANgRAACMHQAA2BEAAKsdAADYEQAAyh0AANgRAADpHQAA2BEAAAgeAADYEQAAJx4AANgRAABkHgAAiBIAAIMeAAAAAAAAAQAAANANAAAAAAAAiBIAAMIeAAAAAAAAAQAAANANAAAAAAAA2BEAAC0gAAAAEgAAjSAAAAgPAAAAAAAAABIAADogAAAYDwAAAAAAANgRAABbIAAAABIAAGggAAD4DgAAAAAAAAASAABvIQAA8A4AAAAAAAAAEgAAfyEAADAPAAAAAAAAABIAALQhAAAIDwAAAAAAAAASAACQIQAAUA8AAAAAAAAAEgAA1iEAAAgPAAAAAAAAUBIAAP4hAABQEgAAACIAAFASAAADIgAAUBIAAAUiAABQEgAAByIAAFASAAAJIgAAUBIAAAsiAABQEgAADSIAAFASAAAPIgAAUBIAABEiAABQEgAAEyIAAFASAAAVIgAAUBIAABciAABQEgAAGSIAAAASAAAbIgAA+A4AAAAAAACgDQAAqA0AALgNAACgDQAAqA0AAMgPAADgDQAA8A0AAPANAADgDQAAyA8AAMgPAADgDQAAyA8AAPgNAADgDQAA8A0AAPANAADgDQAA8A0AALgNAADgDQAAyA8AALgNAADgDQAAuA0AAOANAACQDwAA4A0AAMgPAADwDQAA4A0AAJAPAACoDQAAkA8AAJAPAACoDQAAyA8AAJAPAADgDQAAyA8AAOANAACoDQAAOA4AAAAOAADYDwAA2A8AAEAOAACADwAAUA4AALgNAABQDgAABQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAMAAACxKAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAA//////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAADAAAAWCIAAAAEAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAr/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABMEQAABQAAAAAAAAD4DgAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAAAAAAIA8AAAYAAAAOAAAACAAAAAkAAAAKAAAADwAAABAAAAARAAAAAAAAADAPAAASAAAAEwAAABQAAAAAAAAAQA8AABIAAAAVAAAAFAAAAAAAAABwDwAABgAAABYAAAAIAAAACQAAABcAAAAAAAAAYA8AAAYAAAAYAAAACAAAAAkAAAAZAAAAAAAAAPAPAAAGAAAAGgAAAAgAAAAJAAAACgAAABsAAAAcAAAAHQAAAG1fbGluZXMuc2l6ZSgpID4gMABzb3VyY2VzL1RleHRMYXlvdXQuY2MAcm93IDwgbV9saW5lcy5zaXplKCkACgBwb3NpdGlvbi55IDwgbV9saW5lcy5zaXplKCkAZmluZFRva2VuTG9jYXRvckZvclBvc2l0aW9uAHBvc2l0aW9uLnggPD0gbGluZS5vdXRwdXRMZW5ndGgAY2hhcmFjdGVySW5kZXggPD0gbV9saW5lcy5iYWNrKCkuaW5wdXRPZmZzZXQgKyBtX2xpbmVzLmJhY2soKS5pbnB1dExlbmd0aAB0b2tlbi5jYW5CZVN1YmRpdmlkZWQAIABjdXJyZW50TGluZS5vdXRwdXRMZW5ndGggPD0gZWZmZWN0aXZlQ29sdW1ucwBvZmZzZXQgPj0gY3VycmVudExpbmUuaW5wdXRPZmZzZXQgKyBjdXJyZW50TGluZS5pbnB1dExlbmd0aABjdXJyZW50TGluZS50b2tlbnMuc2l6ZSgpID4gMABhcHBseQBhbGxvY2F0b3I8VD46OmFsbG9jYXRlKHNpemVfdCBuKSAnbicgZXhjZWVkcyBtYXhpbXVtIHN1cHBvcnRlZCBzaXplAHN0ZDo6dmVjdG9yPGNoYXI+AHN0ZDo6cGFpcjxQb3NpdGlvbiwgYm9vbD4AVGV4dE9wZXJhdGlvbgBzdGFydGluZ1JvdwBkZWxldGVkTGluZUNvdW50AGFkZGVkTGluZUNvdW50AFBvc2l0aW9uAHgAeQBUZXh0TGF5b3V0AGdldENvbHVtbnMAZ2V0VGFiV2lkdGgAZ2V0U29mdFdyYXAAZ2V0Q29sbGFwc2VXaGl0ZXNwYWNlcwBnZXRQcmVzZXJ2ZUxlYWRpbmdTcGFjZXMAZ2V0UHJlc2VydmVUcmFpbGluZ1NwYWNlcwBnZXRBbGxvd1dvcmRCcmVha3MAZ2V0RGVtb3RlTmV3bGluZXMAZ2V0SnVzdGlmeVRleHQAc2V0Q29sdW1ucwBzZXRUYWJXaWR0aABzZXRTb2Z0V3JhcABzZXRDb2xsYXBzZVdoaXRlc3BhY2VzAHNldFByZXNlcnZlTGVhZGluZ1NwYWNlcwBzZXRQcmVzZXJ2ZVRyYWlsaW5nU3BhY2VzAHNldEFsbG93V29yZEJyZWFrcwBzZXREZW1vdGVOZXdsaW5lcwBzZXRKdXN0aWZ5VGV4dABnZXRSb3dDb3VudABnZXRDb2x1bW5Db3VudABnZXRTb2Z0V3JhcENvdW50AGdldE1heENoYXJhY3RlckluZGV4AGdldEZpcnN0UG9zaXRpb24AZ2V0TGFzdFBvc2l0aW9uAGRvZXNTb2Z0V3JhcABnZXRTb3VyY2UAZ2V0VGV4dABnZXRMaW5lAGdldEZpeGVkUG9zaXRpb24AZ2V0UG9zaXRpb25MZWZ0AGdldFBvc2l0aW9uUmlnaHQAZ2V0UG9zaXRpb25BYm92ZQBnZXRQb3NpdGlvbkJlbG93AGdldFJvd0ZvckNoYXJhY3RlckluZGV4AGdldENoYXJhY3RlckluZGV4Rm9yUm93AGdldFBvc2l0aW9uRm9yQ2hhcmFjdGVySW5kZXgAZ2V0Q2hhcmFjdGVySW5kZXhGb3JQb3NpdGlvbgBhcHBseUNvbmZpZ3VyYXRpb24AY2xlYXJTb3VyY2UAc2V0U291cmNlAHNwbGljZVNvdXJjZQBpaWlpaWkATlN0M19fMjEyYmFzaWNfc3RyaW5nSWNOU18xMWNoYXJfdHJhaXRzSWNFRU5TXzlhbGxvY2F0b3JJY0VFRUUATlN0M19fMjIxX19iYXNpY19zdHJpbmdfY29tbW9uSUxiMUVFRQBQMTBUZXh0TGF5b3V0ADEwVGV4dExheW91dAAxM1RleHRPcGVyYXRpb24AOFBvc2l0aW9uAFBLMTBUZXh0TGF5b3V0AGlpaWlpAE5TdDNfXzI0cGFpckk4UG9zaXRpb25iRUUAaWlpaQBpaWkAdmkAdgBpaQB2aWlpAGkAcHVzaF9iYWNrAHJlc2l6ZQBzaXplAGdldABzZXQATlN0M19fMjZ2ZWN0b3JJTlNfMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRU5TNF9JUzZfRUVFRQBOU3QzX18yMTNfX3ZlY3Rvcl9iYXNlSU5TXzEyYmFzaWNfc3RyaW5nSWNOU18xMWNoYXJfdHJhaXRzSWNFRU5TXzlhbGxvY2F0b3JJY0VFRUVOUzRfSVM2X0VFRUUATlN0M19fMjIwX192ZWN0b3JfYmFzZV9jb21tb25JTGIxRUVFAE4xMGVtc2NyaXB0ZW4zdmFsRQBQS05TdDNfXzI2dmVjdG9ySU5TXzEyYmFzaWNfc3RyaW5nSWNOU18xMWNoYXJfdHJhaXRzSWNFRU5TXzlhbGxvY2F0b3JJY0VFRUVOUzRfSVM2X0VFRUUAdmlpaWkAUE5TdDNfXzI2dmVjdG9ySU5TXzEyYmFzaWNfc3RyaW5nSWNOU18xMWNoYXJfdHJhaXRzSWNFRU5TXzlhbGxvY2F0b3JJY0VFRUVOUzRfSVM2X0VFRUUAdm9pZABib29sAHN0ZDo6c3RyaW5nAHN0ZDo6YmFzaWNfc3RyaW5nPHVuc2lnbmVkIGNoYXI+AHN0ZDo6d3N0cmluZwBlbXNjcmlwdGVuOjp2YWwAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDE2X3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVpbnQzMl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nIGRvdWJsZT4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZUVFAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGRvdWJsZT4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJZEVFAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGZsb2F0PgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lmRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgbG9uZz4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbUVFAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmc+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWxFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lqRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaUVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXRFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lzRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaEVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWFFRQBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxjaGFyPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ljRUUATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUATlN0M19fMjEyYmFzaWNfc3RyaW5nSWhOU18xMWNoYXJfdHJhaXRzSWhFRU5TXzlhbGxvY2F0b3JJaEVFRUUAZG91YmxlAGZsb2F0AHVuc2lnbmVkIGxvbmcAbG9uZwB1bnNpZ25lZCBpbnQAaW50AHVuc2lnbmVkIHNob3J0AHNob3J0AHVuc2lnbmVkIGNoYXIAc2lnbmVkIGNoYXIAY2hhcgAtKyAgIDBYMHgAKG51bGwpAC0wWCswWCAwWC0weCsweCAweABpbmYASU5GAG5hbgBOQU4ALgB0ZXJtaW5hdGluZyB3aXRoICVzIGV4Y2VwdGlvbiBvZiB0eXBlICVzOiAlcwB0ZXJtaW5hdGluZyB3aXRoICVzIGV4Y2VwdGlvbiBvZiB0eXBlICVzAHRlcm1pbmF0aW5nIHdpdGggJXMgZm9yZWlnbiBleGNlcHRpb24AdGVybWluYXRpbmcAdW5jYXVnaHQAU3Q5ZXhjZXB0aW9uAE4xMF9fY3h4YWJpdjExNl9fc2hpbV90eXBlX2luZm9FAFN0OXR5cGVfaW5mbwBOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UATjEwX19jeHhhYml2MTE3X19jbGFzc190eXBlX2luZm9FAHB0aHJlYWRfb25jZSBmYWlsdXJlIGluIF9fY3hhX2dldF9nbG9iYWxzX2Zhc3QoKQBjYW5ub3QgY3JlYXRlIHB0aHJlYWQga2V5IGZvciBfX2N4YV9nZXRfZ2xvYmFscygpAGNhbm5vdCB6ZXJvIG91dCB0aHJlYWQgdmFsdWUgZm9yIF9fY3hhX2dldF9nbG9iYWxzKCkAdGVybWluYXRlX2hhbmRsZXIgdW5leHBlY3RlZGx5IHJldHVybmVkAFN0MTFsb2dpY19lcnJvcgBTdDEybGVuZ3RoX2Vycm9yAE4xMF9fY3h4YWJpdjExOV9fcG9pbnRlcl90eXBlX2luZm9FAE4xMF9fY3h4YWJpdjExN19fcGJhc2VfdHlwZV9pbmZvRQBOMTBfX2N4eGFiaXYxMjNfX2Z1bmRhbWVudGFsX3R5cGVfaW5mb0UAdgBEbgBiAGMAaABhAHMAdABpAGoAbABtAGYAZABOMTBfX2N4eGFiaXYxMjFfX3ZtaV9jbGFzc190eXBlX2luZm9F';
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

STATICTOP = STATIC_BASE + 10432;
/* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_embind_cc() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });







var STATIC_BUMP = 10432;
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

  
  var tupleRegistrations={};
  
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
    }function __embind_finalize_value_array(rawTupleType) {
      var reg = tupleRegistrations[rawTupleType];
      delete tupleRegistrations[rawTupleType];
      var elements = reg.elements;
      var elementsLength = elements.length;
      var elementTypes = elements.map(function(elt) { return elt.getterReturnType; }).
                  concat(elements.map(function(elt) { return elt.setterArgumentType; }));
  
      var rawConstructor = reg.rawConstructor;
      var rawDestructor = reg.rawDestructor;
  
      whenDependentTypesAreResolved([rawTupleType], elementTypes, function(elementTypes) {
          elements.forEach(function(elt, i) {
              var getterReturnType = elementTypes[i];
              var getter = elt.getter;
              var getterContext = elt.getterContext;
              var setterArgumentType = elementTypes[i + elementsLength];
              var setter = elt.setter;
              var setterContext = elt.setterContext;
              elt.read = function(ptr) {
                  return getterReturnType['fromWireType'](getter(getterContext, ptr));
              };
              elt.write = function(ptr, o) {
                  var destructors = [];
                  setter(setterContext, ptr, setterArgumentType['toWireType'](destructors, o));
                  runDestructors(destructors);
              };
          });
  
          return [{
              name: reg.name,
              'fromWireType': function(ptr) {
                  var rv = new Array(elementsLength);
                  for (var i = 0; i < elementsLength; ++i) {
                      rv[i] = elements[i].read(ptr);
                  }
                  rawDestructor(ptr);
                  return rv;
              },
              'toWireType': function(destructors, o) {
                  if (elementsLength !== o.length) {
                      throw new TypeError("Incorrect number of tuple elements for " + reg.name + ": expected=" + elementsLength + ", actual=" + o.length);
                  }
                  var ptr = rawConstructor();
                  for (var i = 0; i < elementsLength; ++i) {
                      elements[i].write(ptr, o[i]);
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

  
  var structRegistrations={};function __embind_finalize_value_object(structType) {
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

  function __embind_register_value_array(
      rawType,
      name,
      constructorSignature,
      rawConstructor,
      destructorSignature,
      rawDestructor
    ) {
      tupleRegistrations[rawType] = {
          name: readLatin1String(name),
          rawConstructor: embind__requireFunction(constructorSignature, rawConstructor),
          rawDestructor: embind__requireFunction(destructorSignature, rawDestructor),
          elements: [],
      };
    }

  function __embind_register_value_array_element(
      rawTupleType,
      getterReturnType,
      getterSignature,
      getter,
      getterContext,
      setterArgumentType,
      setterSignature,
      setter,
      setterContext
    ) {
      tupleRegistrations[rawTupleType].elements.push({
          getterReturnType: getterReturnType,
          getter: embind__requireFunction(getterSignature, getter),
          getterContext: getterContext,
          setterArgumentType: setterArgumentType,
          setter: embind__requireFunction(setterSignature, setter),
          setterContext: setterContext,
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

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_i": nullFunc_i, "nullFunc_ii": nullFunc_ii, "nullFunc_iii": nullFunc_iii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_iiiiii": nullFunc_iiiiii, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_viii": nullFunc_viii, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "invoke_i": invoke_i, "invoke_ii": invoke_ii, "invoke_iii": invoke_iii, "invoke_iiii": invoke_iiii, "invoke_iiiii": invoke_iiiii, "invoke_iiiiii": invoke_iiiiii, "invoke_v": invoke_v, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_viii": invoke_viii, "invoke_viiii": invoke_viiii, "invoke_viiiii": invoke_viiiii, "invoke_viiiiii": invoke_viiiiii, "ClassHandle": ClassHandle, "ClassHandle_clone": ClassHandle_clone, "ClassHandle_delete": ClassHandle_delete, "ClassHandle_deleteLater": ClassHandle_deleteLater, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "ClassHandle_isDeleted": ClassHandle_isDeleted, "RegisteredClass": RegisteredClass, "RegisteredPointer": RegisteredPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "RegisteredPointer_destructor": RegisteredPointer_destructor, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "___assert_fail": ___assert_fail, "___cxa_allocate_exception": ___cxa_allocate_exception, "___cxa_begin_catch": ___cxa_begin_catch, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___cxa_throw": ___cxa_throw, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___resumeException": ___resumeException, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "__embind_finalize_value_array": __embind_finalize_value_array, "__embind_finalize_value_object": __embind_finalize_value_object, "__embind_register_bool": __embind_register_bool, "__embind_register_class": __embind_register_class, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_register_class_function": __embind_register_class_function, "__embind_register_emval": __embind_register_emval, "__embind_register_float": __embind_register_float, "__embind_register_integer": __embind_register_integer, "__embind_register_memory_view": __embind_register_memory_view, "__embind_register_std_string": __embind_register_std_string, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_value_array": __embind_register_value_array, "__embind_register_value_array_element": __embind_register_value_array_element, "__embind_register_value_object": __embind_register_value_object, "__embind_register_value_object_field": __embind_register_value_object_field, "__embind_register_void": __embind_register_void, "__emval_decref": __emval_decref, "__emval_incref": __emval_incref, "__emval_register": __emval_register, "__emval_take_value": __emval_take_value, "_abort": _abort, "_embind_repr": _embind_repr, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_pthread_getspecific": _pthread_getspecific, "_pthread_key_create": _pthread_key_create, "_pthread_once": _pthread_once, "_pthread_setspecific": _pthread_setspecific, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "count_emval_handles": count_emval_handles, "craftInvokerFunction": craftInvokerFunction, "createNamedFunction": createNamedFunction, "downcastPointer": downcastPointer, "embind__requireFunction": embind__requireFunction, "embind_init_charCodes": embind_init_charCodes, "ensureOverloadTable": ensureOverloadTable, "exposePublicSymbol": exposePublicSymbol, "extendError": extendError, "floatReadValueFromPointer": floatReadValueFromPointer, "flushPendingDeletes": flushPendingDeletes, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "genericPointerToWireType": genericPointerToWireType, "getBasestPointer": getBasestPointer, "getInheritedInstance": getInheritedInstance, "getInheritedInstanceCount": getInheritedInstanceCount, "getLiveInheritedInstances": getLiveInheritedInstances, "getShiftFromSize": getShiftFromSize, "getTypeName": getTypeName, "get_first_emval": get_first_emval, "heap32VectorToArray": heap32VectorToArray, "init_ClassHandle": init_ClassHandle, "init_RegisteredPointer": init_RegisteredPointer, "init_embind": init_embind, "init_emval": init_emval, "integerReadValueFromPointer": integerReadValueFromPointer, "makeClassHandle": makeClassHandle, "makeLegalFunctionName": makeLegalFunctionName, "new_": new_, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "readLatin1String": readLatin1String, "registerType": registerType, "replacePublicSymbol": replacePublicSymbol, "requireRegisteredType": requireRegisteredType, "runDestructor": runDestructor, "runDestructors": runDestructors, "setDelayFunction": setDelayFunction, "shallowCopyInternalPointer": shallowCopyInternalPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwBindingError": throwBindingError, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "throwInternalError": throwInternalError, "throwUnboundTypeError": throwUnboundTypeError, "upcastPointer": upcastPointer, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
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

