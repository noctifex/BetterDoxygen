// symbol/handlers/common.js — betterdoxygen
// Builds fields shared by all specialized symbol information.

// Copyright (C) 2026 Noctifex

// Licensed under the GNU General Public License v3.0.
// See <https://www.gnu.org/licenses/> for the full text.

/**
 * @brief Builds the common identifying fields returned by symbol handlers.
 *
 * @param {object} symbol The classified resolved symbol.
 * @returns {object} Common symbol information.
 */
function getCommonSymbolInformation(symbol) {
  return {
    kind: symbol.category,
    name: symbol.identifier,
    languageId: symbol.languageId,
    classification: symbol.classification,
    category: symbol.category,
    source: {
      uri: symbol.source.uri,
      position: symbol.source.position,
      wordRange: symbol.source.wordRange,
      identifier: symbol.source.identifier
    },
    target: {
      uri: symbol.target.uri,
      position: symbol.target.position,
      wordRange: symbol.target.wordRange,
      identifier: symbol.target.identifier,
      location: symbol.target.location,
      resolvedBy: symbol.target.resolvedBy
    },
    provider: symbol.provider
  };
}

module.exports = {
  getCommonSymbolInformation
};
