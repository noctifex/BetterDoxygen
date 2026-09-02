// symbol/classify/cpp/patterns.js — betterdoxygen
// Declarative regular-expression patterns used by the C and C++ classifier.
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

const modifierPatterns = [
  { modifier: 'export', pattern: /\bexport\b/, section: 'prefix' },
  { modifier: 'friend', pattern: /\bfriend\b/, section: 'prefix' },
  { modifier: 'explicit', pattern: /\bexplicit\b/, section: 'prefix' },
  { modifier: 'static', pattern: /\bstatic\b/, section: 'prefix' },
  { modifier: 'thread-local', pattern: /\bthread_local\b/, section: 'prefix' },
  { modifier: 'inline', pattern: /\binline\b/, section: 'prefix' },
  { modifier: 'virtual', pattern: /\bvirtual\b/, section: 'prefix' },
  { modifier: 'constexpr', pattern: /\bconstexpr\b/, section: 'prefix' },
  { modifier: 'consteval', pattern: /\bconsteval\b/, section: 'prefix' },
  { modifier: 'constinit', pattern: /\bconstinit\b/, section: 'prefix' },
  { modifier: 'const', pattern: /\bconst\b/, section: 'cv' },
  { modifier: 'volatile', pattern: /\bvolatile\b/, section: 'cv' },
  { modifier: 'noexcept', pattern: /\bnoexcept\b/, section: 'suffix' },
  { modifier: 'override', pattern: /\boverride\b/, section: 'suffix' },
  { modifier: 'final', pattern: /\bfinal\b/, section: 'outside-parameters' },
  { modifier: 'requires', pattern: /\brequires\b/, section: 'outside-parameters' },
  { modifier: 'mutable', pattern: /\bmutable\b/, section: 'prefix' },
  {
    modifier: 'deprecated',
    pattern: /\[\[\s*deprecated(?:\s*\([^\]]*\))?\s*\]\]/,
    section: 'outside-parameters'
  },
  { modifier: 'defaulted', pattern: /=\s*default\s*;/, section: 'suffix' },
  { modifier: 'deleted', pattern: /=\s*delete\s*;/, section: 'suffix' },
  { modifier: 'pure-virtual', pattern: /=\s*0\s*;/, section: 'suffix' }
];

const syntaxPatterns = {
  conversionOperator: /\boperator\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:<[^(){};]*>)?\s*\(/m,
  literalOperator: /\boperator\s*""\s*[A-Za-z_]\w*\s*\(/m,
  rejectedFunctionPrefix: /(?:=|\.|->|\(|,|;|\breturn|\bco_return|\bnew)\s*$/,
  qualifiedPrefix: /::\s*$/,
  callableBeforeParameters: /(?:~?[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*|operator\s*(?:""\s*[A-Za-z_]\w*|[^\s(]+))\s*$/,
  controlStatementPrefix: /\b(?:if|for|while|switch|catch)\s*$/,
  lambdaCapture: /\[[^\]]*\]\s*$/,
  functionPointer: /\(\s*[*&]\s*[A-Za-z_]\w*\s*\)\s*$/,
  classScope: /\b(?:class|struct|union)\b[^;{}()]*$/m,
  enumScope: /\benum(?:\s+(?:class|struct))?\b[^;{}()]*$/m,
  templateStart: /\btemplate\s*</g,
  accessLabel: /(?:^|\n)\s*(?:public|protected|private)\s*:\s*/g,
  preprocessorDefine: /^\s*#\s*define\b/,
  continuedPreprocessorLine: /\\\s*$/
};

/**
 * @brief Creates declaration patterns for a resolved identifier.
 *
 * @param {string} identifier The resolved identifier.
 * @returns {object} The identifier-specific declaration patterns.
 */
function createDeclarationPatterns(identifier) {
  const escapedIdentifier = escapeRegularExpression(identifier);

  return {
    macroVariadic: createPattern(`^\\s*#\\s*define\\s+${escapedIdentifier}\\([^)]*\\.\\.\\.`),
    macroFunction: createPattern(`^\\s*#\\s*define\\s+${escapedIdentifier}\\(`),
    macroObject: createPattern(`^\\s*#\\s*define\\s+${escapedIdentifier}\\b`),
    destructor: createPattern(`~\\s*${escapedIdentifier}\\s*\\(`),
    qualifiedConstructor: createPattern(`\\b${escapedIdentifier}(?:\\s*<[^;{}()]*>)?\\s*::\\s*${escapedIdentifier}\\s*\\(`),
    unqualifiedConstructor: createPattern(`^\\s*(?:template\\s*<[^;{}]*>\\s*)*(?:\\[\\[[^\\]]*\\]\\]\\s*)*(?:(?:explicit(?:\\s*\\([^;{}]*\\))?|constexpr|consteval|inline)\\s+)*${escapedIdentifier}\\s*\\(`),
    exportedModule: createPattern(`\\bexport\\s+module\\s+${escapedIdentifier}(?:\\b|\\s*:)`),
    module: createPattern(`\\bmodule\\s+${escapedIdentifier}(?:\\b|\\s*:)`),
    import: createPattern(`\\b(?:export\\s+)?import\\s+${escapedIdentifier}\\b`),
    namespaceAlias: createPattern(`\\bnamespace\\s+${escapedIdentifier}\\s*=`),
    inlineNamespace: createPattern(`\\binline\\s+namespace\\s+${escapedIdentifier}\\b`),
    namespace: createPattern(`\\bnamespace\\s+${escapedIdentifier}\\b`),
    usingAlias: createPattern(`\\busing\\s+${escapedIdentifier}\\s*=`),
    typedefAlias: createPattern(`\\btypedef\\b[^;]*\\b${escapedIdentifier}\\b`),
    templateTemplateParameter: createPattern(`\\btemplate\\s*<[\\s\\S]*\\btemplate\\s*<[^;{}]*>\\s*(?:typename|class)\\s+${escapedIdentifier}\\b`),
    templateTypePack: createPattern(`\\btemplate\\s*<[^;{}]*\\b(?:typename|class)\\s*\\.\\.\\.\\s*${escapedIdentifier}\\b`),
    templateTypeParameter: createPattern(`\\btemplate\\s*<[^;{}]*\\b(?:typename|class)\\s+${escapedIdentifier}\\b`),
    templateValueParameter: createPattern(`\\btemplate\\s*<[^;{}]*\\b(?:auto|[A-Za-z_]\\w*(?:::[A-Za-z_]\\w*)*(?:<[^;{}]*>)?)\\s+(?:\\.\\.\\.\\s*)?${escapedIdentifier}\\b`),
    concept: createPattern(`\\bconcept\\s+${escapedIdentifier}\\b`),
    scopedEnum: createPattern(`\\benum\\s+(?:class|struct)\\s+${escapedIdentifier}\\b`),
    enum: createPattern(`\\benum(?:\\s+(?:class|struct))?\\s+${escapedIdentifier}\\b`),
    class: createPattern(`\\bclass\\s+${escapedIdentifier}\\b`),
    struct: createPattern(`\\bstruct\\s+${escapedIdentifier}\\b`),
    union: createPattern(`\\bunion\\s+${escapedIdentifier}\\b`),
    enumMember: createPattern(`\\b${escapedIdentifier}\\s*(?:=|,|})`),
    inlineEnumMember: createPattern(`\\benum(?:\\s+(?:class|struct))?[^;{]*{[^}]*\\b${escapedIdentifier}\\b`),
    deductionGuide: createPattern(`\\b${escapedIdentifier}\\s*\\([^;{}]*\\)\\s*->`),
    callable: createPattern(`\\b${escapedIdentifier}\\s*(?:<[^(){};]*>)?\\s*\\(`),
    qualifiedMember: createPattern(`\\b[A-Za-z_]\\w*(?:\\s*<[^;{}()]*>)?\\s*::\\s*${escapedIdentifier}\\s*(?:<[^(){};]*>)?\\s*\\(`),
    variableTemplate: createPattern(`\\btemplate\\s*<[^;{}]*>[^;]*\\b${escapedIdentifier}\\s*(?:=|;)`),
    constant: createPattern(`\\b(?:constexpr|const)\\b[^;]*\\b${escapedIdentifier}\\b`),
    array: createPattern(`\\b${escapedIdentifier}\\s*\\[`),
    bitfield: createPattern(`\\b${escapedIdentifier}\\s*:\\s*\\d+`),
    structuredBinding: createPattern(`\\[[^\\]]*\\b${escapedIdentifier}\\b[^\\]]*\\]\\s*(?:=|\\{|;)`),
    label: createPattern(`^\\s*${escapedIdentifier}\\s*:`),
    variable: createPattern(`\\b${escapedIdentifier}\\s*(?:=|;|,|\\[|\\))`),
    parameter: createPattern(`\\b${escapedIdentifier}\\s*(?:=|,|\\)|\\[)`)
  };
}

/**
 * @brief Creates a numeric literal pattern with an independent match state.
 *
 * @returns {RegExp} A global C and C++ numeric literal pattern.
 */
function createNumericLiteralPattern() {
  const digits = "\\d(?:'?\\d)*";
  const hexadecimalDigits = "[0-9A-Fa-f](?:'?[0-9A-Fa-f])*";
  const binaryDigits = "[01](?:'?[01])*";
  const exponent = `[eE][+-]?${digits}`;
  const hexadecimalExponent = `[pP][+-]?${digits}`;
  const decimalFloat = `(?:(?:${digits})\\.(?:${digits})?|(?:${digits})?\\.${digits})(?:${exponent})?`;
  const hexadecimal = `0[xX]${hexadecimalDigits}(?:\\.(?:${hexadecimalDigits})?)?(?:${hexadecimalExponent})?`;
  const suffix = '(?:[A-Za-z_]\\w*)?';

  return new RegExp(
    `(?<![\\w.])(?:${hexadecimal}|0[bB]${binaryDigits}|${decimalFloat}|${digits}${exponent}|${digits})${suffix}(?![\\w.])`,
    'g'
  );
}

/**
 * @brief Creates a multiline regular expression.
 *
 * @param {string} source The regular expression source.
 * @returns {RegExp} The compiled pattern.
 */
function createPattern(source) {
  return new RegExp(source, 'm');
}

/**
 * @brief Escapes an identifier for use in a regular expression.
 *
 * @param {string} value The identifier to escape.
 * @returns {string} The escaped regular expression text.
 */
function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  createDeclarationPatterns,
  createNumericLiteralPattern,
  modifierPatterns,
  syntaxPatterns
};
