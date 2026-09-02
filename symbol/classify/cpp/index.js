// symbol/classify/cpp/index.js — betterdoxygen
// Classifies resolved C and C++ symbols.
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

const { getVscodeKindName } = require('../../kind.js');
const { getCppLexicalRegion } = require('./lexical.js');
const {
  findEnclosingOpeningParenthesis,
  getContainingTemplateHeader,
  getDeclarationContext,
  isDirectlyInsideScope
} = require('./context.js');
const { getDeclarationModifiers } = require('./modifiers.js');
const {
  createDeclarationPatterns,
  syntaxPatterns
} = require('./patterns.js');

const genericClassifications = new Set([
  'file:file',
  'module:module',
  'namespace:namespace',
  'enum:enum',
  'class:class',
  'variable:variable',
  'function:function',
  'symbol:unknown'
]);

const crossKindRefinements = new Set([
  'macro:variadic-function-like',
  'macro:function-like',
  'macro:object-like',
  'alias:using',
  'alias:typedef',
  'concept:concept',
  'template:deduction-guide',
  'label:label'
]);

/**
 * @brief Adds BetterDoxygen kind and category information to a C or C++ symbol.
 *
 * @param {object} symbol The resolved symbol to classify.
 * @param {import('vscode').CancellationToken} token The cancellation token.
 * @returns {Promise<object | undefined>} The symbol with vscodeKind, kind, and category fields.
 */
async function classifyCppSymbol(symbol, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  const literalClassification = getLiteralClassification(symbol);
  if (literalClassification) {
    return createClassifiedSymbol(symbol, literalClassification, []);
  }

  const context = getDeclarationContext(symbol);
  const patterns = createDeclarationPatterns(symbol.name);
  const declarationClassification = getDeclarationClassification(
    context,
    symbol,
    patterns
  );
  const providerClassification = getProviderClassification(symbol.vscodeKind);
  const classification = chooseClassification(
    declarationClassification,
    providerClassification
  );

  if (!classification || token.isCancellationRequested) {
    return undefined;
  }

  const modifiers = getDeclarationModifiers(
    context,
    classification,
    symbol.name
  );

  return createClassifiedSymbol(symbol, classification, modifiers);
}

/**
 * @brief Combines a symbol, its classification, and its C++ modifiers.
 *
 * @param {object} symbol The resolved symbol to classify.
 * @param {object} classification The BetterDoxygen classification.
 * @param {string[]} modifiers The C++ declaration modifiers.
 * @returns {object} The classified symbol.
 */
function createClassifiedSymbol(symbol, classification, modifiers) {
  const vscodeKind = symbol.vscodeKind ?? classification.vscodeKind;

  return {
    ...symbol,
    ...classification,
    vscodeKind,
    vscodeKindName: getVscodeKindName(vscodeKind),
    modifiers
  };
}

/**
 * @brief Chooses textual refinement over a generic provider classification.
 *
 * @param {object | undefined} declarationClassification The textual classification.
 * @param {object | undefined} providerClassification The provider classification.
 * @returns {object | undefined} The most specific available classification.
 */
function chooseClassification(declarationClassification, providerClassification) {
  if (!declarationClassification) {
    return providerClassification;
  }

  if (!providerClassification) {
    return declarationClassification;
  }

  const declarationKey =
    `${declarationClassification.kind}:${declarationClassification.category}`;
  const providerKey =
    `${providerClassification.kind}:${providerClassification.category}`;

  if (declarationClassification.kind !== providerClassification.kind &&
      !crossKindRefinements.has(declarationKey)) {
    return providerClassification;
  }

  if (genericClassifications.has(declarationKey) &&
      !genericClassifications.has(providerKey)) {
    return providerClassification;
  }

  return declarationClassification;
}

/**
 * @brief Maps a VS Code symbol kind to BetterDoxygen classification fields.
 *
 * @param {vscode.SymbolKind | undefined} vscodeKind The provider symbol kind.
 * @returns {{kind: string, category: string} | undefined} The BetterDoxygen classification.
 */
function getProviderClassification(vscodeKind) {
  switch (vscodeKind) {
    case vscode.SymbolKind.File:
      return { kind: 'file', category: 'file' };

    case vscode.SymbolKind.Module:
      return { kind: 'module', category: 'module' };

    case vscode.SymbolKind.Namespace:
      return { kind: 'namespace', category: 'namespace' };

    case vscode.SymbolKind.Package:
      return { kind: 'module', category: 'package' };

    case vscode.SymbolKind.Enum:
      return { kind: 'enum', category: 'enum' };

    case vscode.SymbolKind.EnumMember:
      return { kind: 'enum', category: 'member' };

    case vscode.SymbolKind.Class:
      return { kind: 'class', category: 'class' };

    case vscode.SymbolKind.Struct:
      return { kind: 'class', category: 'struct' };

    case vscode.SymbolKind.Interface:
      return { kind: 'class', category: 'interface' };

    case vscode.SymbolKind.String:
      return { kind: 'literal', category: 'string' };

    case vscode.SymbolKind.Number:
      return { kind: 'literal', category: 'number' };

    case vscode.SymbolKind.Boolean:
      return { kind: 'literal', category: 'boolean' };

    case vscode.SymbolKind.Field:
      return { kind: 'variable', category: 'field' };

    case vscode.SymbolKind.Array:
      return { kind: 'variable', category: 'array' };

    case vscode.SymbolKind.Object:
      return { kind: 'literal', category: 'object' };

    case vscode.SymbolKind.Key:
      return { kind: 'symbol', category: 'key' };

    case vscode.SymbolKind.Null:
      return { kind: 'literal', category: 'null' };

    case vscode.SymbolKind.Constant:
      return { kind: 'variable', category: 'constant' };

    case vscode.SymbolKind.Property:
      return { kind: 'variable', category: 'property' };

    case vscode.SymbolKind.Variable:
      return { kind: 'variable', category: 'variable' };

    case vscode.SymbolKind.Method:
      return { kind: 'function', category: 'member' };

    case vscode.SymbolKind.Function:
      return { kind: 'function', category: 'function' };

    case vscode.SymbolKind.Operator:
      return { kind: 'function', category: 'operator' };

    case vscode.SymbolKind.Constructor:
      return { kind: 'function', category: 'constructor' };

    case vscode.SymbolKind.Event:
      return { kind: 'function', category: 'event' };

    case vscode.SymbolKind.TypeParameter:
      return { kind: 'template', category: 'type' };

    default:
      return vscodeKind === undefined
        ? undefined
        : { kind: 'symbol', category: 'unknown' };
  }
}

/**
 * @brief Classifies a literal at the resolved target position.
 *
 * @param {object} symbol The resolved symbol to classify.
 * @returns {object | undefined} The literal classification.
 */
function getLiteralClassification(symbol) {
  const { document, position } = symbol.target;
  const lexicalRegion = getCppLexicalRegion(document, position);

  if (lexicalRegion?.type === 'literal') {
    return {
      vscodeKind: lexicalRegion.category === 'number'
        ? vscode.SymbolKind.Number
        : vscode.SymbolKind.String,
      kind: 'literal',
      category: lexicalRegion.category
    };
  }

  if (symbol.name === 'true' || symbol.name === 'false') {
    return {
      vscodeKind: vscode.SymbolKind.Boolean,
      kind: 'literal',
      category: 'boolean'
    };
  }

  if (symbol.name === 'nullptr') {
    return {
      vscodeKind: vscode.SymbolKind.Null,
      kind: 'literal',
      category: 'null'
    };
  }

  return undefined;
}

/**
 * @brief Classifies a declaration from its target text and lexical scope.
 *
 * @param {object} context The extracted declaration context.
 * @param {object} symbol The resolved symbol to classify.
 * @param {object} patterns The identifier-specific declaration patterns.
 * @returns {object | undefined} The textual declaration classification.
 */
function getDeclarationClassification(context, symbol, patterns) {
  const declaration = context.code;

  if (patterns.macroVariadic.test(declaration)) {
    return { kind: 'macro', category: 'variadic-function-like' };
  }

  if (patterns.macroFunction.test(declaration)) {
    return { kind: 'macro', category: 'function-like' };
  }

  if (patterns.macroObject.test(declaration)) {
    return { kind: 'macro', category: 'object-like' };
  }

  if (patterns.destructor.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Method,
      kind: 'function',
      category: 'destructor'
    };
  }

  if (isConstructorDeclaration(context, patterns)) {
    return {
      vscodeKind: vscode.SymbolKind.Constructor,
      kind: 'function',
      category: 'constructor'
    };
  }

  if (patterns.exportedModule.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Module,
      kind: 'module',
      category: 'interface'
    };
  }

  if (patterns.module.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Module,
      kind: 'module',
      category: 'implementation'
    };
  }

  if (patterns.import.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Module,
      kind: 'module',
      category: 'import'
    };
  }

  if (patterns.namespaceAlias.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Namespace,
      kind: 'namespace',
      category: 'alias'
    };
  }

  if (patterns.inlineNamespace.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Namespace,
      kind: 'namespace',
      category: 'inline'
    };
  }

  if (patterns.namespace.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Namespace,
      kind: 'namespace',
      category: 'namespace'
    };
  }

  if (patterns.usingAlias.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'alias',
      category: 'using'
    };
  }

  if (patterns.typedefAlias.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'alias',
      category: 'typedef'
    };
  }

  const templateHeader = getContainingTemplateHeader(context);

  if (templateHeader && patterns.templateTemplateParameter.test(templateHeader)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'template',
      category: 'template'
    };
  }

  if (templateHeader && patterns.templateTypePack.test(templateHeader)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'template',
      category: 'type-pack'
    };
  }

  if (templateHeader && patterns.templateTypeParameter.test(templateHeader)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'template',
      category: 'type'
    };
  }

  if (templateHeader && patterns.templateValueParameter.test(templateHeader)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'template',
      category: 'value'
    };
  }

  if (patterns.concept.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'concept',
      category: 'concept'
    };
  }

  if (symbol.name === 'operator' &&
      declaration.includes('operator')) {
    return {
      vscodeKind: vscode.SymbolKind.Operator,
      kind: 'function',
      category: syntaxPatterns.literalOperator.test(context.text)
        ? 'literal'
        : syntaxPatterns.conversionOperator.test(context.text)
          ? 'conversion'
          : 'operator'
    };
  }

  if (patterns.scopedEnum.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Enum,
      kind: 'enum',
      category: 'scoped'
    };
  }

  if (patterns.enum.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Enum,
      kind: 'enum',
      category: 'unscoped'
    };
  }

  if (patterns.class.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Class,
      kind: 'class',
      category: 'class'
    };
  }

  if (patterns.struct.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Struct,
      kind: 'class',
      category: 'struct'
    };
  }

  if (patterns.union.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Struct,
      kind: 'class',
      category: 'union'
    };
  }

  if (isEnumMember(context, patterns)) {
    return {
      vscodeKind: vscode.SymbolKind.EnumMember,
      kind: 'enum',
      category: 'member'
    };
  }

  if (patterns.deductionGuide.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.TypeParameter,
      kind: 'template',
      category: 'deduction-guide'
    };
  }

  if (patterns.callable.test(declaration) &&
      isFunctionDeclaration(context, patterns)) {
    return {
      vscodeKind: vscode.SymbolKind.Function,
      kind: 'function',
      category: patterns.qualifiedMember.test(declaration) ||
        isDirectlyInsideScope(context, 'class')
        ? 'member'
        : 'function'
    };
  }

  if (patterns.structuredBinding.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Variable,
      kind: 'variable',
      category: 'structured-binding'
    };
  }

  if (isParameterDeclaration(context, patterns)) {
    return {
      vscodeKind: vscode.SymbolKind.Variable,
      kind: 'variable',
      category: 'parameter'
    };
  }

  if (patterns.variableTemplate.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Variable,
      kind: 'variable',
      category: 'template'
    };
  }

  if (patterns.constant.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Constant,
      kind: 'variable',
      category: 'constant'
    };
  }

  if (patterns.array.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Array,
      kind: 'variable',
      category: 'array'
    };
  }

  if (patterns.bitfield.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Field,
      kind: 'variable',
      category: 'bitfield'
    };
  }

  if (patterns.label.test(declaration)) {
    return {
      vscodeKind: vscode.SymbolKind.Key,
      kind: 'label',
      category: 'label'
    };
  }

  if (patterns.variable.test(declaration)) {
    const isField = isDirectlyInsideScope(context, 'class');

    return {
      vscodeKind: isField
        ? vscode.SymbolKind.Field
        : vscode.SymbolKind.Variable,
      kind: 'variable',
      category: isField ? 'field' : 'variable'
    };
  }

  return undefined;
}

/**
 * @brief Determines whether a declaration represents a constructor.
 *
 * @param {object} context The declaration context.
 * @param {object} patterns The identifier-specific declaration patterns.
 * @returns {boolean} True when the declaration is a constructor.
 */
function isConstructorDeclaration(context, patterns) {
  return patterns.qualifiedConstructor.test(context.code) ||
    patterns.unqualifiedConstructor.test(context.code) &&
      isDirectlyInsideScope(context, 'class');
}

/**
 * @brief Determines whether an identifier has declaration-like function context.
 *
 * @param {object} context The declaration context.
 * @param {object} patterns The identifier-specific declaration patterns.
 * @returns {boolean} True when the identifier declares a function.
 */
function isFunctionDeclaration(context, patterns) {
  const match = patterns.callable.exec(context.code);
  if (!match) {
    return false;
  }

  const prefix = context.code.slice(0, match.index).trim();
  if (!prefix || syntaxPatterns.rejectedFunctionPrefix.test(prefix)) {
    return false;
  }

  return !syntaxPatterns.qualifiedPrefix.test(prefix) || /\s/.test(prefix);
}

/**
 * @brief Determines whether the target is an enum member.
 *
 * @param {object} context The declaration context.
 * @param {object} patterns The identifier-specific declaration patterns.
 * @returns {boolean} True when the target is an enum member.
 */
function isEnumMember(context, patterns) {
  if (!patterns.enumMember.test(context.code)) {
    return false;
  }

  return patterns.inlineEnumMember.test(context.code) ||
    isDirectlyInsideScope(context, 'enum');
}

/**
 * @brief Determines whether the target is a callable parameter.
 *
 * @param {object} context The declaration context.
 * @param {object} patterns The identifier-specific declaration patterns.
 * @returns {boolean} True when the target declares a parameter.
 */
function isParameterDeclaration(context, patterns) {
  if (!patterns.parameter.test(context.code)) {
    return false;
  }

  const openingOffset = findEnclosingOpeningParenthesis(
    context.code,
    context.identifierOffset
  );

  if (openingOffset === -1) {
    return false;
  }

  const prefix = context.code.slice(0, openingOffset).trimEnd();
  if (syntaxPatterns.lambdaCapture.test(prefix) ||
      syntaxPatterns.functionPointer.test(prefix)) {
    return true;
  }

  const callable = syntaxPatterns.callableBeforeParameters.exec(prefix);
  if (!callable) {
    return false;
  }

  const callablePrefix = prefix.slice(0, callable.index).trim();
  if (syntaxPatterns.controlStatementPrefix.test(callablePrefix) ||
      syntaxPatterns.rejectedFunctionPrefix.test(callablePrefix)) {
    return false;
  }

  if (callablePrefix || callable[0].includes('::')) {
    return true;
  }

  return isDirectlyInsideScope(context, 'class');
}

module.exports = {
  classifyCppSymbol
};
