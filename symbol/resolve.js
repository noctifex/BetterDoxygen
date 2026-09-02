// symbol/resolve.js — betterdoxygen
// Resolves generic symbol context from the VS Code language service.
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

const { getCppLexicalRegion } = require('./classify/cpp/lexical.js');
const { getVscodeKindName } = require('./kind.js');

/**
 * @typedef {Object} ResolvedSource
 * @property {vscode.Uri} uri
 * @property {vscode.Position} position
 * @property {vscode.Range} range
 * @property {string} identifier
 */

/**
 * @typedef {Object} ResolvedTarget
 * @property {vscode.TextDocument} document
 * @property {vscode.Uri} uri
 * @property {vscode.Position} position
 * @property {vscode.Range} range
 * @property {string} identifier
 * @property {vscode.Location} location
 * @property {'declaration' | 'definition' | 'source'} resolvedBy
 */

/**
 * @typedef {Object} ProviderSymbolInfo
 * @property {string} name
 * @property {vscode.SymbolKind} symbolKind
 * @property {string | undefined} detail
 * @property {string | undefined} containerName
 * @property {vscode.Range} range
 * @property {vscode.Range} selectionRange
 */

/**
 * @typedef {Object} ResolvedSymbol
 * @property {string} languageId
 * @property {string} name
 * @property {ResolvedSource} source
 * @property {ResolvedTarget} target
 * @property {ProviderSymbolInfo | undefined} provider
 * @property {vscode.SymbolKind | undefined} vscodeKind
 * @property {string | undefined} vscodeKindName
 */

const documentSymbolCache = new WeakMap();

/**
 * @brief Retrieves cached document symbols or loads them if not cached.
 *
 * @param {vscode.TextDocument} document The document whose symbols are requested.
 * @returns {Promise<Array<vscode.DocumentSymbol | vscode.SymbolInformation> | undefined>} The document symbols, if available.
 */
function getCachedDocumentSymbols(document) {
  const cached = documentSymbolCache.get(document);

  if (cached?.version === document.version) {
    return cached.promise;
  }

  const promise = loadDocumentSymbols(document);
  const entry = {
    version: document.version,
    promise
  };

  documentSymbolCache.set(document, entry);

  promise.then(symbols => {
    if (!symbols?.length && documentSymbolCache.get(document) === entry) {
      documentSymbolCache.delete(document);
    }
  });

  return promise;
}

/**
 * @brief Loads document symbols for the given document.
 *
 * @param {vscode.TextDocument} document The document whose symbols are requested.
 * @returns {Promise<Array<vscode.DocumentSymbol | vscode.SymbolInformation> | undefined>} The loaded document symbols.
 */
async function loadDocumentSymbols(document) {
  try {
    return await vscode.commands.executeCommand(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    );
  } catch {
    return undefined;
  }
}

/**
 * @brief Resolves generic context for the symbol under the given position.
 *
 * @param {vscode.TextDocument} document The source document.
 * @param {vscode.Position} position The source position.
 * @param {vscode.CancellationToken} token The cancellation token.
 * @returns {Promise<ResolvedSymbol | undefined>} The resolved symbol context.
 */
async function resolveSymbol(document, position, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  const lexicalRegion = getCppRegion(document, position);
  if (lexicalRegion?.type === 'comment') {
    return undefined;
  }

  const sourceRange = getLiteralRange(document, lexicalRegion) ??
    document.getWordRangeAtPosition(position);
  if (!sourceRange) {
    return undefined;
  }

  const sourceIdentifier = document.getText(sourceRange);

  const target = await resolveTarget(
    document,
    position,
    sourceRange,
    sourceIdentifier,
    token
  );

  if (!target || token.isCancellationRequested) {
    return undefined;
  }

  const providerSymbol = await resolveProviderSymbol(
    target.document,
    target.position,
    target.identifier,
    token
  );

  if (token.isCancellationRequested) {
    return undefined;
  }

  const provider = providerSymbol
    ? normalizeProviderSymbol(providerSymbol)
    : undefined;
  const vscodeKind = provider?.symbolKind;

  return {
    languageId: target.document.languageId,
    name: target.identifier,

    source: {
      uri: document.uri,
      position,
      range: sourceRange,
      identifier: sourceIdentifier
    },

    target,

    provider,
    vscodeKind,
    vscodeKindName: getVscodeKindName(vscodeKind)
  };
}

/**
 * @brief Resolves the most appropriate target for a source identifier.
 * @note Resolution is attempted in the following order:
 *       declaration, definition, then the original source location.
 *
 * @param {vscode.TextDocument} document The source document.
 * @param {vscode.Position} position The source position.
 * @param {vscode.Range} sourceRange The source identifier range.
 * @param {string} sourceIdentifier The source identifier.
 * @param {vscode.CancellationToken} token The cancellation token.
 * @returns {Promise<ResolvedTarget | undefined>} The resolved target.
 */
async function resolveTarget(document, position, sourceRange, sourceIdentifier, token) {
  const resolutionStages = [
    {
      command: 'vscode.executeDeclarationProvider',
      resolvedBy: 'declaration'
    },
    {
      command: 'vscode.executeDefinitionProvider',
      resolvedBy: 'definition'
    }
  ];

  for (const stage of resolutionStages) {
    if (token.isCancellationRequested) {
      return undefined;
    }

    const locations = await resolveLocations(stage.command, document, position);

    if (token.isCancellationRequested) {
      return undefined;
    }

    for (const location of locations) {
      const target = await createResolvedTarget(
        location,
        stage.resolvedBy,
        sourceIdentifier,
        token
      );

      if (token.isCancellationRequested) {
        return undefined;
      }

      if (target) {
        return target;
      }
    }
  }

  return {
    document,
    uri: document.uri,
    position: sourceRange.start,
    range: sourceRange,
    identifier: sourceIdentifier,
    location: new vscode.Location(
      document.uri,
      sourceRange
    ),
    resolvedBy: 'source'
  };
}

/**
 * @brief Creates a resolved target from a language-service location.
 *
 * @param {vscode.Location} location The resolved location.
 * @param {'declaration' | 'definition'} resolvedBy The resolution source.
 * @param {string} expectedIdentifier The expected identifier at the target.
 * @param {vscode.CancellationToken} token The cancellation token.
 * @returns {Promise<ResolvedTarget | undefined>} The resolved target.
 */
async function createResolvedTarget(location, resolvedBy, expectedIdentifier, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  let document;
  try {
    document = await vscode.workspace.openTextDocument(location.uri);
  } catch {
    return undefined;
  }

  if (token.isCancellationRequested) {
    return undefined;
  }

  const range = findIdentifierRange(document, location.range, expectedIdentifier);
  if (!range) {
    return undefined;
  }

  return {
    document,
    uri: document.uri,
    position: range.start,
    range,
    identifier: document.getText(range),
    location,
    resolvedBy
  };
}

/**
 * @brief Normalizes a Location or LocationLink into a Location.
 *
 * @param {vscode.Location | vscode.LocationLink} value The provider result.
 * @returns {vscode.Location | undefined} The normalized location.
 */
function normalizeProviderLocation(value) {
  if (value instanceof vscode.Location) {
    return value;
  }

  if (!value?.targetUri) {
    return undefined;
  }

  const range =
    value.targetSelectionRange ??
    value.targetRange;

  if (!range) {
    return undefined;
  }

  return new vscode.Location(
    value.targetUri,
    range
  );
}

/**
 * @brief Attempts to retrieve exact symbol metadata from the document
 *        symbol provider.
 * @note Failure to find a provider symbol does not make symbol resolution fail.
 *
 * @param {vscode.TextDocument} document The target document.
 * @param {vscode.Position} position The target position.
 * @param {string} identifier The resolved identifier.
 * @param {vscode.CancellationToken} token The cancellation token.
 * @returns {Promise<vscode.DocumentSymbol | vscode.SymbolInformation | undefined>} Matching provider symbol metadata, if available.
 */
async function resolveProviderSymbol(document, position, identifier, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  const requestedVersion = document.version;
  const symbols = await getCachedDocumentSymbols(document);
  if (!symbols?.length || token.isCancellationRequested || document.version !== requestedVersion) {
    return undefined;
  }

  return findProviderSymbol(
    symbols,
    document,
    position,
    identifier,
    token
  );
}

/**
 * @brief Searches provider symbols for an exact identifier match.
 *
 * @param {Array<vscode.DocumentSymbol | vscode.SymbolInformation>} symbols The provider symbols.
 * @param {vscode.TextDocument} document The containing document.
 * @param {vscode.Position} position The target position.
 * @param {string} identifier The target identifier.
 * @param {vscode.CancellationToken} token The cancellation token.
 * @returns {vscode.DocumentSymbol | vscode.SymbolInformation | undefined} The matching provider symbol.
 */
function findProviderSymbol(symbols, document, position, identifier, token) {
  if (token.isCancellationRequested) {
    return undefined;
  }

  for (const symbol of symbols) {
    if (isDocumentSymbol(symbol)) {
      if (!symbol.range.contains(position)) {
        continue;
      }

      const nested = findProviderSymbol(symbol.children, document, position, identifier, token);
      if (nested) {
        return nested;
      }

      const selectionText = document.getText(
        symbol.selectionRange
      );

      if (symbol.selectionRange.contains(position) &&
          selectionText === identifier) {
        return symbol;
      }

      continue;
    }

    if (symbol instanceof vscode.SymbolInformation) {
      if (symbol.location.uri.toString() !== document.uri.toString()) {
        continue;
      }

      if (!symbol.location.range.contains(position)) {
        continue;
      }

      if (symbol.name === identifier) {
        return symbol;
      }

      const rangeText = getExactRangeText(
        document,
        symbol.location.range
      );

      if (rangeText === identifier) {
        return symbol;
      }
    }
  }

  return undefined;
}

/**
 * @brief Normalizes provider-specific symbol metadata.
 *
 * @param {vscode.DocumentSymbol | vscode.SymbolInformation} symbol The provider symbol.
 * @returns {ProviderSymbolInfo} The normalized provider metadata.
 */
function normalizeProviderSymbol(symbol) {
  if (isDocumentSymbol(symbol)) {
    return {
      name: symbol.name,
      symbolKind: symbol.kind,
      detail: symbol.detail || undefined,
      containerName: undefined,
      range: symbol.range,
      selectionRange: symbol.selectionRange
    };
  }

  return {
    name: symbol.name,
    symbolKind: symbol.kind,
    detail: undefined,
    containerName:
      symbol.containerName || undefined,
    range: symbol.location.range,
    selectionRange: symbol.location.range
  };
}

/**
 * @brief Gets lexical information for a C or C++ position.
 *
 * @param {vscode.TextDocument} document The source document.
 * @param {vscode.Position} position The position to inspect.
 * @returns {object | undefined} The containing lexical region.
 */
function getCppRegion(document, position) {
  if (document.languageId !== 'c' && document.languageId !== 'cpp') {
    return undefined;
  }

  return getCppLexicalRegion(document, position);
}

/**
 * @brief Creates a source range for a quoted or numeric literal.
 *
 * @param {vscode.TextDocument} document The source document.
 * @param {object | undefined} lexicalRegion The containing lexical region.
 * @returns {vscode.Range | undefined} The literal source range.
 */
function getLiteralRange(document, lexicalRegion) {
  if (lexicalRegion?.type !== 'literal') {
    return undefined;
  }

  return new vscode.Range(
    document.positionAt(lexicalRegion.start),
    document.positionAt(lexicalRegion.end)
  );
}

/**
 * @brief Reads a range only when it is suitable for exact identifier matching.
 *
 * @param {vscode.TextDocument} document The containing document.
 * @param {vscode.Range} range The range to read.
 * @returns {string | undefined} The exact range text.
 */
function getExactRangeText(document, range) {
  if (range.start.line !== range.end.line) {
    return undefined;
  }

  const text = document.getText(range).trim();

  if (!text || text.length > 256) {
    return undefined;
  }

  return text;
}

/**
 * @brief Determines if a symbol is a DocumentSymbol.
 *
 * @param {vscode.DocumentSymbol | vscode.SymbolInformation} symbol The symbol to check.
 * @returns {boolean} True if the symbol is a DocumentSymbol, false otherwise.
 */
function isDocumentSymbol(symbol) {
  return Boolean(
    symbol &&
    symbol.range &&
    symbol.selectionRange &&
    Array.isArray(symbol.children)
  );
}

/**
 * @brief Finds the expected identifier within a provider range.
 *
 * @param {vscode.TextDocument} document The target document.
 * @param {vscode.Range} searchRange The provider-supplied range.
 * @param {string} identifier The expected identifier.
 * @returns {vscode.Range | undefined} The exact identifier range.
 */
function findIdentifierRange(document, searchRange, identifier) {
  if (!identifier) {
    return undefined;
  }

  const rangeAtStart = document.getWordRangeAtPosition(searchRange.start);
  if (rangeAtStart && document.getText(rangeAtStart) === identifier) {
    return rangeAtStart;
  }

  const searchText = document.getText(searchRange);
  const baseOffset = document.offsetAt(searchRange.start);
  let relativeOffset = searchText.indexOf(identifier);

  while (relativeOffset !== -1) {
    const candidatePosition = document.positionAt(baseOffset + relativeOffset);
    const candidateRange = document.getWordRangeAtPosition(candidatePosition);

    if (candidateRange &&
        searchRange.contains(candidateRange.end) &&
        searchRange.contains(candidateRange.start) &&
        document.getText(candidateRange) === identifier) {
      return candidateRange;
    }

    relativeOffset = searchText.indexOf(identifier, relativeOffset + identifier.length);
  }

  return undefined;
}

/**
 * @brief Resolves locations for a given command, document, and position.
 *
 * @param {string} command The VS Code provider command.
 * @param {vscode.TextDocument} document The source document.
 * @param {vscode.Position} position The source position.
 * @returns {Promise<vscode.Location[]>} The resolved locations.
 */
async function resolveLocations(command, document, position) {
  try {
    const results = await vscode.commands.executeCommand(command, document.uri, position);
    if (!results?.length) {
      return [];
    }

    return results
      .map(normalizeProviderLocation)
      .filter(location => location !== undefined);
  } catch {
    return [];
  }
}

module.exports = {
  resolveSymbol
};
