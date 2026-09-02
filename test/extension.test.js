// test/extension.test.js — betterdoxygen
// Verifies C and C++ symbol resolution and classification.
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

const assert = require('assert');
const vscode = require('vscode');

const { classifyCppSymbol } = require('../symbol/classify/cpp/index.js');
const { resolveSymbol } = require('../symbol/resolve.js');

/**
 * @brief Creates a resolved-symbol fixture for classifier tests.
 *
 * @param {vscode.TextDocument} document The fixture document.
 * @param {string} identifier The target identifier.
 * @param {number} line The target line.
 * @param {number} [occurrence] The zero-based identifier occurrence.
 * @param {vscode.SymbolKind} [vscodeKind] An optional provider kind.
 * @returns {object} The resolved-symbol fixture.
 */
function createSymbol(document, identifier, line, occurrence = 0, vscodeKind) {
  const lineText = document.lineAt(line).text;
  let character = -1;

  for (let index = 0; index <= occurrence; index += 1) {
    character = lineText.indexOf(identifier, character + 1);
  }

  assert.notStrictEqual(character, -1, `Could not find ${identifier}`);

  const position = new vscode.Position(line, character);
  const range = new vscode.Range(
    position,
    position.translate(0, identifier.length)
  );
  const location = new vscode.Location(document.uri, range);

  return {
    languageId: document.languageId,
    name: identifier,
    source: {
      uri: document.uri,
      position,
      range,
      identifier
    },
    target: {
      document,
      uri: document.uri,
      position,
      range,
      identifier,
      location,
      resolvedBy: 'source'
    },
    provider: undefined,
    vscodeKind
  };
}

/**
 * @brief Classifies an identifier in an in-memory C++ document.
 *
 * @param {string} content The fixture source text.
 * @param {string} identifier The target identifier.
 * @param {number} line The target line.
 * @param {number} [occurrence] The zero-based identifier occurrence.
 * @param {vscode.SymbolKind} [vscodeKind] An optional provider kind.
 * @returns {Promise<object | undefined>} The classifier result.
 */
async function classify(
  content,
  identifier,
  line,
  occurrence = 0,
  vscodeKind
) {
  const document = await vscode.workspace.openTextDocument({
    language: 'cpp',
    content
  });
  const symbol = createSymbol(
    document,
    identifier,
    line,
    occurrence,
    vscodeKind
  );

  const tokenSource = new vscode.CancellationTokenSource();

  try {
    return await classifyCppSymbol(symbol, tokenSource.token);
  } finally {
    tokenSource.dispose();
  }
}

suite('C++ symbol classification', () => {
  test('classifies built-in literal categories', async () => {
    const stringLiteral = await classify(
      'const char* value = R"tag(hello)tag";',
      'hello',
      0
    );
    const characterLiteral = await classify("char value = 'x';", 'x', 0);
    const numberLiteral = await classify("auto value = 1'000u;", "1'000u", 0);
    const booleanLiteral = await classify('auto value = true;', 'true', 0);
    const nullLiteral = await classify('auto value = nullptr;', 'nullptr', 0);

    assert.strictEqual(stringLiteral.category, 'string');
    assert.strictEqual(characterLiteral.category, 'character');
    assert.strictEqual(numberLiteral.category, 'number');
    assert.strictEqual(booleanLiteral.category, 'boolean');
    assert.strictEqual(nullLiteral.category, 'null');

    for (const literal of [
      stringLiteral,
      characterLiteral,
      numberLiteral,
      booleanLiteral,
      nullLiteral
    ]) {
      assert.strictEqual(literal.kind, 'literal');
    }
  });

  test('refines provider kinds with C++ declaration details', async () => {
    const scopedEnum = await classify(
      'enum class Mode { first };',
      'Mode',
      0,
      0,
      vscode.SymbolKind.Enum
    );
    const union = await classify(
      'union Value { int integer; float decimal; };',
      'Value',
      0,
      0,
      vscode.SymbolKind.Struct
    );
    const bitfield = await classify(
      'struct Flags {\n  unsigned enabled : 1;\n};',
      'enabled',
      1,
      0,
      vscode.SymbolKind.Field
    );

    assert.strictEqual(scopedEnum.category, 'scoped');
    assert.strictEqual(scopedEnum.vscodeKind, vscode.SymbolKind.Enum);
    assert.strictEqual(union.category, 'union');
    assert.strictEqual(union.vscodeKind, vscode.SymbolKind.Struct);
    assert.strictEqual(bitfield.category, 'bitfield');
  });

  test('keeps modifiers within the current declaration', async () => {
    const result = await classify(
      'void function(const int value);\nstatic int later;',
      'function',
      0
    );

    assert.deepStrictEqual(result.modifiers, []);
  });

  test('recognizes trailing function modifiers only', async () => {
    const result = await classify(
      'class Owner {\npublic:\n  const Owner& value() const noexcept;\n};',
      'value',
      2
    );

    assert.strictEqual(result.category, 'member');
    assert.deepStrictEqual(result.modifiers, ['const', 'noexcept']);
  });

  test('tracks class scope without a line limit or literal brace leakage', async () => {
    const longClass = [
      'class Large {',
      '  const char* brace = "}";',
      ...Array(300).fill(''),
      '  void member();',
      '};'
    ].join('\n');
    const result = await classify(longClass, 'member', 302);

    assert.strictEqual(result.kind, 'function');
    assert.strictEqual(result.category, 'member');
  });

  test('distinguishes fields from locals in member functions', async () => {
    const content = [
      'class Owner {',
      '  int field;',
      '  void function() {',
      '    int local;',
      '  }',
      '};'
    ].join('\n');
    const field = await classify(content, 'field', 1);
    const local = await classify(content, 'local', 3);

    assert.strictEqual(field.category, 'field');
    assert.strictEqual(local.category, 'variable');
  });

  test('recognizes complex constructors without classifying expressions', async () => {
    const constructor = await classify([
      'template<class T>',
      'class Widget {',
      'public:',
      '  template<class U>',
      '  explicit(sizeof(U) > 0) Widget(U&& value) noexcept;',
      '};'
    ].join('\n'), 'Widget', 4);
    const expression = await classify('Widget(value);', 'Widget', 0);

    assert.strictEqual(constructor.category, 'constructor');
    assert.strictEqual(expression, undefined);
  });

  test('classifies providerless parameters', async () => {
    const parameter = await classify(
      'void function(const int value);',
      'value',
      0
    );

    assert.strictEqual(parameter.kind, 'variable');
    assert.strictEqual(parameter.category, 'parameter');
    assert.deepStrictEqual(parameter.modifiers, ['const']);
  });

  test('covers representative C++ declaration categories', async () => {
    const cases = [
      ['#define LOG(...) sink(__VA_ARGS__)', 'LOG', 0, 'macro', 'variadic-function-like'],
      ['using Count = unsigned;', 'Count', 0, 'alias', 'using'],
      ['template<typename T> class Box;', 'T', 0, 'template', 'type'],
      ['template<typename T> concept Value = true;', 'Value', 0, 'concept', 'concept'],
      ['long double operator"" _unit(long double);', 'operator', 0, 'function', 'literal'],
      ['enum class Mode {\n  first,\n  second\n};', 'first', 1, 'enum', 'member'],
      ['auto [first, second] = pair;', 'first', 0, 'variable', 'structured-binding']
    ];

    for (const [content, identifier, line, kind, category] of cases) {
      const result = await classify(content, identifier, line);
      assert.strictEqual(result?.kind, kind, identifier);
      assert.strictEqual(result?.category, category, identifier);
    }
  });

  test('does not resolve words inside comments as symbols', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'cpp',
      content: '/** @brief Documentation only. */'
    });
    const position = new vscode.Position(0, 5);
    const tokenSource = new vscode.CancellationTokenSource();

    try {
      const result = await resolveSymbol(document, position, tokenSource.token);
      assert.strictEqual(result, undefined);
    } finally {
      tokenSource.dispose();
    }
  });

  test('resolves literals that do not contain a word', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'cpp',
      content: 'const char* value = "";'
    });
    const position = new vscode.Position(0, 20);
    const tokenSource = new vscode.CancellationTokenSource();

    try {
      const symbol = await resolveSymbol(document, position, tokenSource.token);
      const result = await classifyCppSymbol(symbol, tokenSource.token);

      assert.strictEqual(symbol.name, '""');
      assert.strictEqual(Object.hasOwn(symbol.source, 'document'), false);
      assert.strictEqual(symbol.target.document, document);
      assert.strictEqual(Object.hasOwn(symbol, 'kind'), false);
      assert.strictEqual(Object.hasOwn(symbol, 'category'), false);
      assert.strictEqual(Object.hasOwn(symbol, 'modifiers'), false);
      assert.strictEqual(result.kind, 'literal');
      assert.strictEqual(result.category, 'string');
    } finally {
      tokenSource.dispose();
    }
  });
});
