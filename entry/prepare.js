exports.prepare = lib => {
  lib.TextLayout.prototype.setConfiguration = function (config) {
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

  lib.TextLayout.prototype[Symbol.iterator] = function* () {
    for (let t = 0, T = this.getRowCount(); t < T; ++t) {
      yield this.getLine(t);
    }
  };

  return lib;
};
