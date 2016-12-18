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
        return this.x + ':' + this.y;
    };

    bind(`Position`, Position);

    patch(`TextLayout`, `getPositionAbove`, (self, original, position, amplitude = 1) => original.call(self, position, amplitude));
    patch(`TextLayout`, `getPositionBelow`, (self, original, position, amplitude = 1) => original.call(self, position, amplitude));

    return { Position, TextLayout: lib.TextLayout };

};
