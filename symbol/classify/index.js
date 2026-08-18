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

const { classifyCppSymbol } = require('./cpp.js');

/**
 * @brief Classifies a resolved symbol that has no provider classification.
 *
 * @param {object} symbol The unresolved classification symbol.
 * @param {import('vscode').CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The symbol with classification and category fields.
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
