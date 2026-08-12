// hover/provider.js — betterdoxygen
// Builds the hover and attaches content to it.
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

const { buildHoverContent } = require('./content.js');

/**
 * @brief Creates the hover and returns it with the content to display.
 * 
 * @param {vscode.TextDocument} document The text document.
 * @param {vscode.Position} position The position in the document.
 * @param {vscode.CancellationToken} token A token to cancel the operation.
 * @returns {vscode.Hover | undefined} The hover to display.
 */
function provideHover(document, position, token) { 
  const content = buildHoverContent(document, position, token);

  if (!content) {
    return undefined;
  }

  return new vscode.Hover(content);
}

module.exports = {
  provideHover
};
