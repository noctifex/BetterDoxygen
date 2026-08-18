// symbol/handlers/function.js — betterdoxygen
// Extracts information specific to callable symbols.
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

const { getCommonSymbolInformation } = require('./common.js');

/**
 * @brief Extracts information about a classified function symbol.
 *
 * @param {object} symbol The classified resolved symbol.
 * @param {import('vscode').CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The extracted function information.
 */
async function getFunctionInfo(symbol, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  // TODO: Extract function-specific information.

  return {
    ...getCommonSymbolInformation(symbol)
  };
}

module.exports = {
  getFunctionInfo
};
