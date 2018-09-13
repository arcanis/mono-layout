let setup = false;

module.exports = wasmBinary => {
  if (setup) return Module;
  setup = true;

  Module.wasmBinary = wasmBinary;
