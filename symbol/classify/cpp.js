// symbol/classify/cpp.js — betterdoxygen
// Classifies resolved C and C++ symbols.
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

/**
 * @brief Classifies a resolved C or C++ symbol.
 *
 * @param {object} symbol The unresolved classification symbol.
 * @param {import('vscode').CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The symbol with classification and category fields.
 */
async function classifyCppSymbol(symbol, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  // TODO: Assign classification and category.
  return {
    ...symbol,
    classification: undefined,
    category: undefined
  };
}

module.exports = {
  classifyCppSymbol
};
