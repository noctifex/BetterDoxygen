// symbol/handlers/literal.js — betterdoxygen
// Extracts information specific to literal symbols.
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
 * @brief Extracts information about a classified literal-like symbol.
 *
 * @param {object} symbol The classified resolved symbol.
 * @param {import('vscode').CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The extracted literal information.
 */
async function getLiteralInfo(symbol, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  // TODO: Extract literal-specific information.

  return {
    ...getCommonSymbolInformation(symbol)
  };
}

module.exports = {
  getLiteralInfo
};
