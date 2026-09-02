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
const { getMacroInfo } = require('./handlers/macro.js');
const { getClassInfo } = require('./handlers/class.js');
const { getLiteralInfo } = require('./handlers/literal.js');
const { getGenericInfo } = require('./handlers/generic.js');
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
  if (symbol.kind === undefined || symbol.category === undefined) {
    symbol = await classifySymbol(symbol, token);
  }

  if (token.isCancellationRequested) {
    return undefined;
  }

  if (!symbol) {
    symbol = resolvedSymbol;
  }

  switch (symbol.kind) {
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
    case 'macro':
      return getMacroInfo(symbol, token);
    case 'file':
    case 'module':
    case 'namespace':
    case 'alias':
    case 'template':
    case 'concept':
    case 'label':
    case 'symbol':
      return getGenericInfo(symbol, token);

    default:
      return getGenericInfo(symbol, token);
  }
}

module.exports = {
  getSymbolInfo
};
