module.exports = function (bind, lib) {

    let exports = {};

    let Position = function (x, y) {

        this.x = x;
        this.y = y;

    };

    Position.prototype.fromJS = function (output) {

        output(this.x, this.y);

    };

    Position.prototype.toString = function () {

        return this.x + ':' + this.y;

    };

    bind(`Position`, Position);

    exports.Position = Position;
    exports.TextLayout = lib.TextLayout;

    return exports;

};
