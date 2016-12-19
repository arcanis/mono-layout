module.exports = function (bind, lib) {

    function patch(className, methodName, replacement) {

        let original = lib[className].prototype[methodName];

        lib[className].prototype[methodName] = function (... args) {
            return replacement.apply(this, [ this, original, ... args ]);
        };

    }

    var Position = function (x, y) {
        Object.assign(this, { x, y });
    };

    Position.prototype.fromJS = function (output) {
        output(this.x, this.y);
    };

    Position.prototype.toString = function () {
        return `<Position#${this.x}:${this.y}>`;
    };

    bind(`Position`, Position);

    patch(`TextLayout`, `setColumns`, (self, original, columns) => original.call(self, Math.min(columns, 0xFFFFFFFF)));
    patch(`TextLayout`, `getPositionAbove`, (self, original, position, amplitude = 1) => original.call(self, position, amplitude));
    patch(`TextLayout`, `getPositionBelow`, (self, original, position, amplitude = 1) => original.call(self, position, amplitude));

    lib.TextLayout.prototype.setOptions = function (options) {

        let needReset = false;
        let optionNames = Object.keys(options);

        for (let optionName of optionNames) {

            let methodName = `set${optionName[0].toUpperCase()}${optionName.substr(1)}`;

            if (!this[methodName])
                throw new Error(`Invalid option "${optionName}"`);

            needReset = this[methodName](options[optionName]) || needReset;

        }

        if (needReset) {
            this.reset();
        }

    };

    return { Position, TextLayout: lib.TextLayout };

};
