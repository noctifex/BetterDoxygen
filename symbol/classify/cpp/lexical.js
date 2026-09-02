// symbol/classify/cpp/lexical.js — betterdoxygen
// Masks comments and literals while preserving C and C++ source offsets.
//
// Copyright (C) 2026 Noctifex
//
// Licensed under the GNU General Public License v3.0.
// See <https://www.gnu.org/licenses/> for the full text.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

const { createNumericLiteralPattern } = require('./patterns.js');

const lexicalCache = new WeakMap();

const rawStringPrefixes = ['u8R"', 'uR"', 'UR"', 'LR"', 'R"'];
const quotedLiteralPrefixes = [
  ['u8"', 'string'],
  ['u"', 'string'],
  ['U"', 'string'],
  ['L"', 'string'],
  ['"', 'string'],
  ['u8\'', 'character'],
  ['u\'', 'character'],
  ['U\'', 'character'],
  ['L\'', 'character'],
  ['\'', 'character']
];

/**
 * @brief Gets cached lexical information for a C or C++ document.
 *
 * @param {import('vscode').TextDocument} document The source document.
 * @returns {{text: string, code: string, regions: object[]}} The lexical document information.
 */
function getCppLexicalDocument(document) {
  const cached = lexicalCache.get(document);

  if (cached?.version === document.version) {
    return cached.value;
  }

  const value = scanCppText(document.getText());
  lexicalCache.set(document, {
    version: document.version,
    value
  });

  return value;
}

/**
 * @brief Gets the comment or literal region containing a document position.
 *
 * @param {import('vscode').TextDocument} document The source document.
 * @param {import('vscode').Position} position The position to inspect.
 * @returns {object | undefined} The containing lexical region.
 */
function getCppLexicalRegion(document, position) {
  const lexical = getCppLexicalDocument(document);
  const offset = document.offsetAt(position);
  const region = findLexicalRegion(lexical.regions, offset);

  return region ?? getNumericLiteralRegion(document, position, lexical);
}

/**
 * @brief Finds a containing lexical region using its sorted source offsets.
 *
 * @param {object[]} regions The sorted lexical regions.
 * @param {number} offset The source offset to locate.
 * @returns {object | undefined} The containing lexical region.
 */
function findLexicalRegion(regions, offset) {
  let lower = 0;
  let upper = regions.length - 1;

  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2);
    const region = regions[middle];

    if (offset < region.start) {
      upper = middle - 1;
    } else if (offset >= region.end) {
      lower = middle + 1;
    } else {
      return region;
    }
  }

  return undefined;
}

/**
 * @brief Gets a numeric literal region containing a document position.
 *
 * @param {import('vscode').TextDocument} document The source document.
 * @param {import('vscode').Position} position The position to inspect.
 * @param {{code: string}} lexical The cached lexical document information.
 * @returns {object | undefined} The numeric literal region.
 */
function getNumericLiteralRegion(document, position, lexical) {
  const targetOffset = document.offsetAt(position);
  const lineStart = targetOffset - position.character;
  const line = lexical.code.slice(
    lineStart,
    lineStart + document.lineAt(position.line).text.length
  );

  for (const match of line.matchAll(createNumericLiteralPattern())) {
    const start = lineStart + match.index;
    const end = start + match[0].length;

    if (start <= targetOffset && targetOffset < end) {
      return {
        start,
        end,
        type: 'literal',
        category: 'number'
      };
    }
  }

  return undefined;
}

/**
 * @brief Scans C or C++ source and masks comments and quoted literals.
 *
 * @param {string} text The source text.
 * @returns {{text: string, code: string, regions: object[]}} The scanned source information.
 */
function scanCppText(text) {
  const code = [...text];
  const regions = [];
  let offset = 0;

  while (offset < text.length) {
    if (text.startsWith('//', offset)) {
      const lineEnd = text.indexOf('\n', offset + 2);
      const end = lineEnd === -1 ? text.length : lineEnd;
      addRegion(code, regions, offset, end, 'comment');
      offset = end;
      continue;
    }

    if (text.startsWith('/*', offset)) {
      const closingOffset = text.indexOf('*/', offset + 2);
      const end = closingOffset === -1 ? text.length : closingOffset + 2;
      addRegion(code, regions, offset, end, 'comment');
      offset = end;
      continue;
    }

    const rawLiteral = readRawStringLiteral(text, offset);
    if (rawLiteral) {
      addRegion(code, regions, offset, rawLiteral.end, 'literal', 'string');
      offset = rawLiteral.end;
      continue;
    }

    const quotedLiteral = readQuotedLiteral(text, offset);
    if (quotedLiteral) {
      addRegion(
        code,
        regions,
        offset,
        quotedLiteral.end,
        'literal',
        quotedLiteral.category
      );
      offset = quotedLiteral.end;
      continue;
    }

    offset += 1;
  }

  return {
    text,
    code: code.join(''),
    regions
  };
}

/**
 * @brief Reads a raw string literal beginning at an offset.
 *
 * @param {string} text The source text.
 * @param {number} offset The candidate literal offset.
 * @returns {{end: number} | undefined} The literal end offset.
 */
function readRawStringLiteral(text, offset) {
  const prefix = rawStringPrefixes.find(value => text.startsWith(value, offset));
  if (!prefix) {
    return undefined;
  }

  const delimiterStart = offset + prefix.length;
  const openingParenthesis = text.indexOf('(', delimiterStart);
  if (openingParenthesis === -1 || openingParenthesis - delimiterStart > 16) {
    return undefined;
  }

  const delimiter = text.slice(delimiterStart, openingParenthesis);
  if (/[\s()\\]/.test(delimiter)) {
    return undefined;
  }

  const closingSequence = `)${delimiter}"`;
  const closingOffset = text.indexOf(closingSequence, openingParenthesis + 1);

  return {
    end: closingOffset === -1
      ? text.length
      : closingOffset + closingSequence.length
  };
}

/**
 * @brief Reads an escaped string or character literal beginning at an offset.
 *
 * @param {string} text The source text.
 * @param {number} offset The candidate literal offset.
 * @returns {{end: number, category: string} | undefined} The literal information.
 */
function readQuotedLiteral(text, offset) {
  const entry = quotedLiteralPrefixes.find(([prefix]) =>
    text.startsWith(prefix, offset)
  );

  if (!entry) {
    return undefined;
  }

  const [prefix, category] = entry;
  const quote = prefix.at(-1);

  if (quote === '\'' && prefix === '\'' &&
      /[0-9A-Fa-f]/.test(text[offset - 1] ?? '') &&
      /[0-9A-Fa-f]/.test(text[offset + 1] ?? '')) {
    return undefined;
  }

  let cursor = offset + prefix.length;

  while (cursor < text.length) {
    if (text[cursor] === '\\') {
      cursor += 2;
      continue;
    }

    if (text[cursor] === quote) {
      return {
        end: cursor + 1,
        category
      };
    }

    cursor += 1;
  }

  return {
    end: text.length,
    category
  };
}

/**
 * @brief Adds a lexical region and masks its non-newline characters.
 *
 * @param {string[]} code The mutable source character array.
 * @param {object[]} regions The collected lexical regions.
 * @param {number} start The inclusive region start.
 * @param {number} end The exclusive region end.
 * @param {string} type The lexical region type.
 * @param {string} [category] The literal category.
 * @returns {void}
 */
function addRegion(code, regions, start, end, type, category) {
  regions.push({ start, end, type, category });

  for (let offset = start; offset < end; offset += 1) {
    if (code[offset] !== '\n' && code[offset] !== '\r') {
      code[offset] = ' ';
    }
  }
}

module.exports = {
  getCppLexicalDocument,
  getCppLexicalRegion
};
