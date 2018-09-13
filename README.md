# [![Text-Layout](/logo.png?raw=true)](https://github.com/manaflair/text-layout)

> Fast implementation of a browser-like text layout engine, for Node and browsers

[![](https://img.shields.io/npm/v/@manaflair/text-layout.svg)]() [![](https://img.shields.io/npm/l/@manaflair/text-layout.svg)]()

[Check out our other OSS projects!](https://manaflair.github.io)

## Features

  - Soft-wrap any text
  - Can collapse text on demand
  - Keep an internal state to map between the original and transformed coordinates
  - Automatically justify the text to fit the specified width if requested
  - Only relayout the part of the text that have changed
  - Shipped as NPM module (w/ an asmjs fallback for browsers)
  - Also available as a zero-dependencies C++ library

Currently not implemented:

  - Font width support
  - Unicode support

## Installation

```
$> yarn add @manaflair/text-layout
```

## Usage

```js
const {TextLayout} = require(`@manaflair/text-layout`);
const faker = require(`faker`);

const textLayout = new TextLayout();
textLayout.setConfiguration({columns: 80, justifyText: true});
textLayout.reset(faker.lorem.paragraphs(10, `\n\n`));

for (const line of textLayout) {
  console.log(line);
}
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

> **Copyright © 2016 Maël Nison & Manaflair**
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
