// symbol/kind.js — betterdoxygen
// Provides readable names for VS Code symbol kinds.
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

const vscode = require('vscode');

/**
 * @brief Gets the VS Code enum name for a symbol kind value.
 *
 * @param {vscode.SymbolKind | undefined} vscodeKind The VS Code symbol kind.
 * @returns {string | undefined} The symbolic VS Code kind name.
 */
function getVscodeKindName(vscodeKind) {
  if (vscodeKind === undefined) {
    return undefined;
  }

  return Object.entries(vscode.SymbolKind)
    .find(([, value]) => value === vscodeKind)
    ?.[0];
}

module.exports = {
  getVscodeKindName
};
