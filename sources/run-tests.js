let ts = require(`@manaflair/term-strings`);
let fs = require(`fs`);
let glob = require(`glob`);
let vm = require(`vm`);

let bindings = require(`./entry-${process.argv[2]}`);

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

    let str = '';
    let otp = [ '' ];

    function APPLY(patch) {

        patch.apply(otp);

    }

    function SETUP_EMPTY() {

    }

    function SETUP(newStr) {

        layout.setCharacterGetter(offset => str.charCodeAt(offset));
        layout.setCharacterCountGetter(() => str.length);

        str = newStr;

        APPLY(layout.reset());

    }

    function RESET() {

        APPLY(layout.reset());

    }

    function SPLICE(start, length, replacement) {

        str = str.substr(0, start) + replacement + str.substr(start + length);
        APPLY(layout.update(start, length, replacement.length));

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

    return { layout, SETUP_EMPTY, SETUP, RESET, SPLICE, APPEND, LINE_COUNT, TEXT, REQUIRE, Position: (x, y) => new bindings.Position(x, y) };

}

let testsuite = new TestSuite();

for (let file of glob.sync(`**/*.test.cc`, { cwd: __dirname })) {

    let content = fs.readFileSync(`${__dirname}/${file}`).toString();

    if (!content.includes(`REQUIRE`))
        continue;

    content = content.replace(/^[ \t]*#.*/gm, ``);
    content = content.replace(/(TEST_CASE|SECTION)\((.*)\)$/gm, `testsuite.register($2).fn = (testsuite, env) =>`);
    content = content.replace(/FOR\(([^,]+),/g, `for (let $1 of `);
    content = content.replace(/([A-Z][A-Z_]*)\(/g, `env.$1(`);
    content = content.replace(/==/g, `+''==''+`);
    content = content.replace(/\b(layout|Position)\b/g, `env.$1`);
    content = content.replace(/([0-9])u/g, `$1`);
    content = content.replace(/\bauto\b/g, `let`);

    testsuite.register(file).fn = testsuite => {
        vm.runInNewContext(content, { console, JSON, testsuite });
    };

}

testsuite.run();
