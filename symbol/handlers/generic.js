// symbol/handlers/generic.js — betterdoxygen
// Extracts information for symbols without a specialized handler.
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
 * @brief Returns a symbol that does not need specialized extraction.
 *
 * @param {object} symbol The classified resolved symbol.
 * @param {import('vscode').CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The extracted generic symbol information.
 */
async function getGenericInfo(symbol, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  return symbol;
}

module.exports = {
  getGenericInfo
};
