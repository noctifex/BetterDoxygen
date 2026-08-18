// symbol/index.js — betterdoxygen
// Resolves symbols and delegates them to classifiers and specialized handlers.
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

const { resolveSymbol } = require('./resolve.js');
const { classifySymbol } = require('./classify/index.js');

const { getEnumInfo } = require('./handlers/enum.js');
const { getClassInfo } = require('./handlers/class.js');
const { getLiteralInfo } = require('./handlers/literal.js');
const { getVariableInfo } = require('./handlers/variable.js');
const { getFunctionInfo } = require('./handlers/function.js');

/**
 * @brief Resolves a symbol and delegates it to the appropriate handler.
 *
 * @param {vscode.TextDocument} document The source document.
 * @param {vscode.Position} position The source position.
 * @param {vscode.CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The extracted symbol information.
 */
async function getSymbolInfo(document, position, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  const resolvedSymbol = await resolveSymbol(document, position, token);
  if (!resolvedSymbol || token.isCancellationRequested) {
    return undefined;
  }

  let symbol = resolvedSymbol;
  if (symbol.classification === undefined) {
    symbol = await classifySymbol(symbol, token);
  }

  if (token.isCancellationRequested) {
    return undefined;
  }

  if (!symbol) {
    return getUnclassifiedSymbolInfo(resolvedSymbol);
  }

  if (symbol.classification === undefined || symbol.category === undefined) {
    return getUnclassifiedSymbolInfo(symbol);
  }

  switch (symbol.category) {
    case 'enum':
      return getEnumInfo(symbol, token);
    case 'class':
      return getClassInfo(symbol, token);
    case 'literal':
      return getLiteralInfo(symbol, token);
    case 'variable':
      return getVariableInfo(symbol, token);
    case 'function':
      return getFunctionInfo(symbol, token);

    default:
      return getUnsupportedSymbolInfo(symbol);
  }
}

/**
 * @brief Creates basic information for a resolved but unclassified symbol.
 *
 * @param {object} symbol The generic resolved symbol.
 * @returns {object} Basic unclassified symbol information.
 */
function getUnclassifiedSymbolInfo(symbol) {
  return {
    kind: 'unclassified',
    name: symbol.identifier,

    languageId: symbol.languageId,
    classification: symbol.classification,
    category: symbol.category,

    source: {
      uri: symbol.source.uri,
      position: symbol.source.position,
      wordRange: symbol.source.wordRange,
      identifier: symbol.source.identifier
    },

    target: {
      uri: symbol.target.uri,
      position: symbol.target.position,
      wordRange: symbol.target.wordRange,
      identifier: symbol.target.identifier,
      location: symbol.target.location,
      resolvedBy: symbol.target.resolvedBy
    },

    provider: symbol.provider
  };
}

/**
 * @brief Creates basic information for a symbol with an unsupported category.
 *
 * @param {object} symbol The generic resolved symbol.
 * @returns {object} Basic unsupported symbol information.
 */
function getUnsupportedSymbolInfo(symbol) {
  return {
    kind: 'unsupported',
    name: symbol.identifier,

    languageId: symbol.languageId,
    classification: symbol.classification,
    category: symbol.category,

    source: {
      uri: symbol.source.uri,
      position: symbol.source.position,
      wordRange: symbol.source.wordRange,
      identifier: symbol.source.identifier
    },

    target: {
      uri: symbol.target.uri,
      position: symbol.target.position,
      wordRange: symbol.target.wordRange,
      identifier: symbol.target.identifier,
      location: symbol.target.location,
      resolvedBy: symbol.target.resolvedBy
    },

    provider: symbol.provider
  };
}

module.exports = {
  getSymbolInfo
};
