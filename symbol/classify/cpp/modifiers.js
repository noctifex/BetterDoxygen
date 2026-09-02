// symbol/classify/cpp/modifiers.js — betterdoxygen
// Extracts C and C++ declaration modifiers from safe declaration sections.
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

const { findMatchingParenthesis } = require('./context.js');
const { modifierPatterns } = require('./patterns.js');

/**
 * @brief Extracts declaration modifiers without inspecting parameters or bodies.
 *
 * @param {object} context The declaration context.
 * @param {object} classification The chosen symbol classification.
 * @param {string} identifier The resolved identifier.
 * @returns {string[]} The declaration modifiers.
 */
function getDeclarationModifiers(context, classification, identifier) {
  if (classification.kind === 'literal' || classification.kind === 'macro') {
    return [];
  }

  const sections = getDeclarationSections(context, classification, identifier);

  return modifierPatterns
    .filter(({ pattern, section }) => pattern.test(sections[section]))
    .map(({ modifier }) => modifier);
}

/**
 * @brief Splits a declaration into modifier-safe regions.
 *
 * @param {object} context The declaration context.
 * @param {object} classification The chosen symbol classification.
 * @param {string} identifier The resolved identifier.
 * @returns {object} The declaration sections.
 */
function getDeclarationSections(context, classification, identifier) {
  const identifierEnd = context.identifierOffset + identifier.length;
  const prefix = context.code.slice(0, identifierEnd);
  let suffix = context.code.slice(identifierEnd);
  let outsideParameters = context.code;
  let cv = prefix;

  if (classification.kind === 'function') {
    const openingOffset = context.code.indexOf('(', identifierEnd);
    const closingOffset = findMatchingParenthesis(context.code, openingOffset);

    if (openingOffset !== -1 && closingOffset !== -1) {
      suffix = context.code.slice(closingOffset + 1);
      outsideParameters =
        `${context.code.slice(0, openingOffset)} ${suffix}`;
      cv = suffix;
    }
  }

  return {
    prefix,
    suffix,
    cv,
    'outside-parameters': outsideParameters
  };
}

module.exports = {
  getDeclarationModifiers
};
