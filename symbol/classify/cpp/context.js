// symbol/classify/cpp/context.js — betterdoxygen
// Extracts declaration and lexical scope context for C and C++ symbols.
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

const { getCppLexicalDocument } = require('./lexical.js');
const { syntaxPatterns } = require('./patterns.js');

/**
 * @brief Extracts one declaration surrounding the resolved target.
 *
 * @param {object} symbol The resolved symbol to classify.
 * @returns {object} The declaration context.
 */
function getDeclarationContext(symbol) {
  const { document, position } = symbol.target;
  const lexical = getCppLexicalDocument(document);
  const targetOffset = document.offsetAt(position);
  const lineText = document.lineAt(position.line).text;
  const lineStart = document.offsetAt(new vscode.Position(position.line, 0));
  const prefixOnLine = lineText.slice(0, position.character);
  let startOffset;
  let endOffset;

  if (syntaxPatterns.preprocessorDefine.test(prefixOnLine)) {
    startOffset = lineStart;
    endOffset = getPreprocessorDeclarationEnd(document, position.line);
  } else {
    startOffset = findDeclarationStart(lexical.code, targetOffset);
    startOffset = skipAccessLabels(
      lexical.code,
      startOffset,
      targetOffset
    );
    endOffset = findDeclarationEnd(
      lexical.code,
      startOffset,
      targetOffset
    );
  }

  return {
    text: lexical.text.slice(startOffset, endOffset),
    code: lexical.code.slice(startOffset, endOffset),
    identifierOffset: targetOffset - startOffset,
    scopes: getOpenScopes(lexical.code, targetOffset)
  };
}

/**
 * @brief Finds the declaration boundary preceding a target offset.
 *
 * @param {string} code The masked source code.
 * @param {number} targetOffset The target source offset.
 * @returns {number} The declaration start offset.
 */
function findDeclarationStart(code, targetOffset) {
  for (let offset = targetOffset - 1; offset >= 0; offset -= 1) {
    if (code[offset] === ';' || code[offset] === '{' || code[offset] === '}') {
      return offset + 1;
    }
  }

  return 0;
}

/**
 * @brief Skips an access label between a declaration boundary and target.
 *
 * @param {string} code The masked source code.
 * @param {number} startOffset The current declaration start.
 * @param {number} targetOffset The target source offset.
 * @returns {number} The adjusted declaration start.
 */
function skipAccessLabels(code, startOffset, targetOffset) {
  const prefix = code.slice(startOffset, targetOffset);
  const pattern = new RegExp(
    syntaxPatterns.accessLabel.source,
    syntaxPatterns.accessLabel.flags
  );
  let adjustedOffset = startOffset;

  for (const match of prefix.matchAll(pattern)) {
    adjustedOffset = startOffset + match.index + match[0].length;
  }

  return adjustedOffset;
}

/**
 * @brief Finds the first declaration terminator following a target.
 *
 * @param {string} code The masked source code.
 * @param {number} startOffset The declaration start offset.
 * @param {number} targetOffset The target source offset.
 * @returns {number} The exclusive declaration end offset.
 */
function findDeclarationEnd(code, startOffset, targetOffset) {
  let parenthesisDepth = 0;
  let bracketDepth = 0;

  for (let offset = startOffset; offset < targetOffset; offset += 1) {
    [parenthesisDepth, bracketDepth] = updateNestingDepth(
      code[offset],
      parenthesisDepth,
      bracketDepth
    );
  }

  for (let offset = targetOffset; offset < code.length; offset += 1) {
    const character = code[offset];
    [parenthesisDepth, bracketDepth] = updateNestingDepth(
      character,
      parenthesisDepth,
      bracketDepth
    );

    if (parenthesisDepth === 0 && bracketDepth === 0 &&
        (character === ';' || character === '{' || character === '}')) {
      return offset + 1;
    }
  }

  return code.length;
}

/**
 * @brief Updates parenthesis and bracket nesting depths.
 *
 * @param {string} character The current source character.
 * @param {number} parenthesisDepth The current parenthesis depth.
 * @param {number} bracketDepth The current bracket depth.
 * @returns {number[]} The updated depths.
 */
function updateNestingDepth(character, parenthesisDepth, bracketDepth) {
  if (character === '(') {
    parenthesisDepth += 1;
  } else if (character === ')') {
    parenthesisDepth = Math.max(0, parenthesisDepth - 1);
  } else if (character === '[') {
    bracketDepth += 1;
  } else if (character === ']') {
    bracketDepth = Math.max(0, bracketDepth - 1);
  }

  return [parenthesisDepth, bracketDepth];
}

/**
 * @brief Gets the end of a possibly continued preprocessor declaration.
 *
 * @param {vscode.TextDocument} document The source document.
 * @param {number} startLine The first preprocessor line.
 * @returns {number} The exclusive declaration end offset.
 */
function getPreprocessorDeclarationEnd(document, startLine) {
  let endLine = startLine;

  while (endLine < document.lineCount - 1 &&
         syntaxPatterns.continuedPreprocessorLine.test(
           document.lineAt(endLine).text
         )) {
    endLine += 1;
  }

  const line = document.lineAt(endLine);
  return document.offsetAt(line.range.end);
}

/**
 * @brief Gets the open brace scopes at a target offset.
 *
 * @param {string} code The masked source code.
 * @param {number} targetOffset The target source offset.
 * @returns {string[]} The open scope types.
 */
function getOpenScopes(code, targetOffset) {
  const scopes = [];
  let headerStart = 0;

  for (let offset = 0; offset < targetOffset; offset += 1) {
    const character = code[offset];

    if (character === '{') {
      const header = stripTemplateHeaders(
        code.slice(headerStart, offset)
      );

      if (syntaxPatterns.enumScope.test(header)) {
        scopes.push('enum');
      } else if (syntaxPatterns.classScope.test(header)) {
        scopes.push('class');
      } else {
        scopes.push('other');
      }

      headerStart = offset + 1;
    } else if (character === '}') {
      scopes.pop();
      headerStart = offset + 1;
    } else if (character === ';') {
      headerStart = offset + 1;
    }
  }

  return scopes;
}

/**
 * @brief Finds the unmatched opening parenthesis containing an offset.
 *
 * @param {string} code The declaration code.
 * @param {number} targetOffset The target offset within the declaration.
 * @returns {number} The opening parenthesis offset, or -1.
 */
function findEnclosingOpeningParenthesis(code, targetOffset) {
  const openings = [];

  for (let offset = 0; offset < targetOffset; offset += 1) {
    if (code[offset] === '(') {
      openings.push(offset);
    } else if (code[offset] === ')') {
      openings.pop();
    }
  }

  return openings.at(-1) ?? -1;
}

/**
 * @brief Gets the template parameter list containing the target identifier.
 *
 * @param {object} context The declaration context.
 * @returns {string | undefined} The containing template header.
 */
function getContainingTemplateHeader(context) {
  const pattern = createTemplateStartPattern();

  for (const match of context.code.matchAll(pattern)) {
    const openingOffset = context.code.indexOf('<', match.index);
    const closingOffset = findMatchingAngleBracket(
      context.code,
      openingOffset
    );

    if (openingOffset < context.identifierOffset &&
        context.identifierOffset < closingOffset) {
      return context.code.slice(match.index, closingOffset + 1);
    }
  }

  return undefined;
}

/**
 * @brief Masks template headers without consuming the following declaration.
 *
 * @param {string} header The brace header to inspect.
 * @returns {string} The header with template parameter lists masked.
 */
function stripTemplateHeaders(header) {
  const result = [...header];

  for (const match of header.matchAll(createTemplateStartPattern())) {
    const openingOffset = header.indexOf('<', match.index);
    const closingOffset = findMatchingAngleBracket(header, openingOffset);

    if (closingOffset === -1) {
      continue;
    }

    for (let offset = match.index; offset <= closingOffset; offset += 1) {
      if (result[offset] !== '\n' && result[offset] !== '\r') {
        result[offset] = ' ';
      }
    }
  }

  return result.join('');
}

/**
 * @brief Creates an independent template-start pattern.
 *
 * @returns {RegExp} The template-start pattern.
 */
function createTemplateStartPattern() {
  return new RegExp(
    syntaxPatterns.templateStart.source,
    syntaxPatterns.templateStart.flags
  );
}

/**
 * @brief Finds a template header's matching closing angle bracket.
 *
 * @param {string} code The declaration code.
 * @param {number} openingOffset The opening angle bracket offset.
 * @returns {number} The closing angle bracket offset, or -1.
 */
function findMatchingAngleBracket(code, openingOffset) {
  let depth = 0;
  let parenthesisDepth = 0;
  let bracketDepth = 0;

  for (let offset = openingOffset; offset < code.length; offset += 1) {
    if (code[offset] === '(') {
      parenthesisDepth += 1;
    } else if (code[offset] === ')') {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    } else if (code[offset] === '[') {
      bracketDepth += 1;
    } else if (code[offset] === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (code[offset] === '<' &&
               parenthesisDepth === 0 && bracketDepth === 0) {
      depth += 1;
    } else if (code[offset] === '>' &&
               parenthesisDepth === 0 && bracketDepth === 0) {
      depth -= 1;

      if (depth === 0) {
        return offset;
      }
    }
  }

  return -1;
}

/**
 * @brief Determines whether the target is directly inside a scope type.
 *
 * @param {object} context The declaration context.
 * @param {string} scope The expected innermost scope.
 * @returns {boolean} True when the innermost scope matches.
 */
function isDirectlyInsideScope(context, scope) {
  return context.scopes.at(-1) === scope;
}

/**
 * @brief Finds the closing parenthesis matching an opening offset.
 *
 * @param {string} code The declaration code.
 * @param {number} openingOffset The opening parenthesis offset.
 * @returns {number} The closing parenthesis offset, or -1.
 */
function findMatchingParenthesis(code, openingOffset) {
  if (openingOffset === -1) {
    return -1;
  }

  let depth = 0;

  for (let offset = openingOffset; offset < code.length; offset += 1) {
    if (code[offset] === '(') {
      depth += 1;
    } else if (code[offset] === ')') {
      depth -= 1;

      if (depth === 0) {
        return offset;
      }
    }
  }

  return -1;
}

module.exports = {
  findEnclosingOpeningParenthesis,
  findMatchingParenthesis,
  getContainingTemplateHeader,
  getDeclarationContext,
  isDirectlyInsideScope
};
