# [![Mono-Layout](/logo.png?raw=true)](https://github.com/arcanis/mono-layout)

> Fast implementation of a browser-like text layout engine, for Node and browsers

[![](https://img.shields.io/npm/v/mono-layout.svg)]() [![](https://img.shields.io/npm/l/mono-layout.svg)]()

## Features

  - Soft-wraps any text to the given width
  - Automatically justifies the text to fit the specified width if requested
  - Can collapse text on demand (`white-space: pre`, but more configurable)
  - Keeps an internal state to map between the original and transformed text coordinates
  - Only updates the part of the text that has changed for better performances
  - Shipped as NPM package using WebAssembly (portable, even accross browsers)
  - Also available as a zero-dependencies C++ library

Currently not implemented:

  - Font width support (all characters are assumed monospaces)
  - Unicode support (all characters are assumed to be ASCII)

## Installation

```
$> yarn add mono-layout
```

## Usage

```js
const {TextLayout} = require(`mono-layout/sync`);
const faker = require(`faker`);

const textLayout = new TextLayout();
textLayout.setConfiguration({columns: 80, justifyText: true});
textLayout.setSource(faker.lorem.paragraphs(10, `\n\n`));

console.log(textLayout.getTransformedSource());
```

Note that the library is also available through an asynchronous endpoint (used by default when requiring `mono-layout`). You typically will want to use this endpoint if your code is expected to work within browsers, since they may disallow WebAssembly to be compiled in the main thread. Here's what the code looks like with the asynchronous initialization:

```js
const tlPromise = require(`mono-layout/async`);
const faker = require(`faker`);

tlPromise.then(({TextLayout}) => {
  const textLayout = new TextLayout();
  textLayout.setConfiguration({columns: 80, justifyText: true});
  textLayout.setSource(faker.lorem.paragraphs(10, `\n\n`));

  console.log(textLayout.getTransformedSource());
});
```

## Tests

### Testing the library

```
$> apt-get install catch
$> make tests DEBUG=1
```

### Testing the JS module

```
$> yarn
$> node sources/run-tests.js
```

## License (MIT)

> **Copyright © 2016 Maël Nison**
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
