// hover/content.js — betterdoxygen
// Builds the content displayed in the hover.
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
 * @brief Renders the content for the hover.
 *
 * @param {vscode.TextDocument} _document The text document.
 * @param {vscode.Position} _position The position in the document.
 * @param {vscode.CancellationToken} _token The cancellation token.
 * @returns {Promise<vscode.MarkdownString>} The rendered hover content.
 */
async function buildHoverContent(_document, _position, _token) {
  const markdown = new vscode.MarkdownString();
  markdown.supportHtml = true;

  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="150"
      height="150"
      viewBox="0 0 150 150">

      <path d="M0 25 V0 H25"
        stroke="white"
        stroke-width="4"
        fill="none"
        stroke-linecap="square"/>

      <path d="M125 0 H150 V25"
        stroke="white"
        stroke-width="4"
        fill="none"
        stroke-linecap="square"/>

      <path d="M0 125 V150 H25"
        stroke="white"
        stroke-width="4"
        fill="none"
        stroke-linecap="square"/>

      <path d="M125 150 H150 V125"
        stroke="white"
        stroke-width="4"
        fill="none"
        stroke-linecap="square"/>

      <text x="75"
        y="81"
        text-anchor="middle"
        font-size="18"
        font-weight="700"
        fill="white"
        font-family="Arial, sans-serif">
        BetterDoxygen
      </text>
    </svg>
  `);

  markdown.appendMarkdown(
    `<img src="data:image/svg+xml,${svg}" width="150" height="150">`
  );

  return markdown;
}

module.exports = {
  buildHoverContent
};
