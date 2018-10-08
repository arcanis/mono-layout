let ts = require(`@manaflair/term-strings`);
let fs = require(`fs`);
let glob = require(`glob`);
let vm = require(`vm`);

let bindings = require(`../sync`);

let ok = `${ts.style.color.front(`green`).in}✓${ts.style.color.front.out}`;
let ko = `${ts.style.color.front(`red`).in}✗${ts.style.color.front.out}`;

class TestSuite {

    constructor() {

        this.tests = [];

    }

    register(label) {

        let test = { label, fn: () => () => {} };
        this.tests.push(test);

        return test;

    }

    run(level = 0) {

        let indent = ` `.repeat(level * 4);

        if (level > 0 && this.tests.length > 0)
            console.log(``);

        for (let test of this.tests) {

            let testsuite = new TestSuite();

            try {
                test.fn(testsuite, makeEnv());
                console.log(`${indent} ${ok} ${test.label}`);
            } catch (err) {
                console.log(`${indent} ${ko} ${test.label} (${err.stack || err})`);
            }

            testsuite.run(level + 1);

        }

        if (level > 0 && this.tests.length > 0) {
            console.log(``);
        }

    }

}

function makeEnv() {

    let layout = new bindings.TextLayout();

    let otp = [ '' ];

    function APPLY(patch) {

        bindings.applyPatch(layout, patch, otp);

    }

    function SETUP_EMPTY() {

    }

    function SETUP(newStr) {

        str = newStr;

        APPLY(layout.setSource(newStr));

    }

    function RESET() {

        APPLY(layout.applyConfiguration());

    }

    function SPLICE(start, length, replacement) {

        APPLY(layout.spliceSource(start, length, replacement));

    }

    function APPEND(appendStr) {

        SPLICE(str.length, 0, appendStr);

    }

    function LINE_COUNT() {

        return otp.length;

    }

    function TEXT() {

        return otp.join(`\n`);

    }

    function REQUIRE(condition) {

        if (!condition) {
            throw new Error(`Assertion failed!`);
        }

    }

    function ASSERT_EQ(left, right) {

        REQUIRE(JSON.stringify(left) === JSON.stringify(right));

    }

    return { layout, SETUP_EMPTY, SETUP, RESET, SPLICE, APPEND, LINE_COUNT, TEXT, REQUIRE, ASSERT_EQ, Position: (x, y) => ({x, y}), PositionRet: (x, y, perfectFit) => [{x, y}, perfectFit] };

}

let testsuite = new TestSuite();

for (let file of glob.sync(`**/*.test.cc`, { cwd: __dirname })) {

    let content = fs.readFileSync(`${__dirname}/${file}`).toString();

    if (!content.includes(`ASSERT`))
        continue;

    content = content.replace(/^[ \t]*#.*/gm, ``);
    content = content.replace(/(TEST_CASE|SECTION)\((.*)\)$/gm, `testsuite.register($2).fn = (testsuite, env) =>`);
    content = content.replace(/FOR\(([^,]+),/g, `for (let $1 of `);
    content = content.replace(/([A-Z][A-Z_]*)\(/g, `env.$1(`);
    content = content.replace(/\b(layout|Position|PositionRet)\b/g, `env.$1`);
    content = content.replace(/([0-9])u/g, `$1`);
    content = content.replace(/\bauto\b/g, `let`);

    testsuite.register(file).fn = testsuite => {
        vm.runInNewContext(content, { console, JSON, testsuite });
    };

}

testsuite.run();
