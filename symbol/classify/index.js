// symbol/classify/index.js — betterdoxygen
// Delegates symbol classification to language-specific classifiers.
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

const { classifyCppSymbol } = require('./cpp/index.js');

/**
 * @brief Adds BetterDoxygen kind and category information to a resolved symbol.
 *
 * @param {object} symbol The resolved symbol to classify.
 * @param {import('vscode').CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The symbol with vscodeKind, kind, and category fields.
 */
async function classifySymbol(symbol, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  switch (symbol.languageId) {
    case 'c':
    case 'cpp':
      return classifyCppSymbol(symbol, token);

    default:
      return undefined;
  }
}

module.exports = {
  classifySymbol
};
