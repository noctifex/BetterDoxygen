// extension.js — betterdoxygen
// Entry point for the extension.
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

const config = require('./config.json');
const { provideHover } = require('./hover/provider.js');

/**
 * @brief Activates the extension and registers the hover provider.
 *
 * @param {vscode.ExtensionContext} context The extension context.
 */
function activate(context) {
  console.log('BetterDoxygen: Extension is now active');

  const hoverProvider = vscode.languages.registerHoverProvider(
    config.targets,
    { provideHover }
  );

  context.subscriptions.push(hoverProvider);

  console.log('BetterDoxygen: Hover provider registered');
}

/**
 * @brief Called when the extension is deactivated.
 */
function deactivate() {}

module.exports = {
  activate,
  deactivate
};
