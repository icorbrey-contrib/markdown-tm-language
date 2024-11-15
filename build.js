/**
 * @import {Grammar} from '@wooorm/starry-night'
 */

/**
 * @typedef {Grammar['patterns'][number]} Rule
 *
 * @typedef {'autolink' | 'code-indented' | 'html'} ConditionCommonmark
 * @typedef {'directive' | 'frontmatter' | 'gfm' | 'github' | 'math' | 'mdx'} ConditionExtension
 * @typedef {ConditionCommonmark | ConditionExtension} Condition
 * @typedef {`!${Condition}`} NegatedCondition
 *
 * @typedef LanguageInfo
 *   Configuration for a language.
 * @property {Array<Condition>} conditions
 *   Conditions found in `grammar.yml` to choose.
 * @property {boolean | undefined} [embedTsx]
 *   Whether to embed a copy of the TypeScript grammar;
 *   the TypeScript grammar is required for MDX to work;
 *   this is normally assumed to be used  by the end user,
 *   but if that can’t be guaranteed,
 *   enable this flag.
 * @property {Array<string>} extensions
 *   List of file extensions, with dots;
 *   used in `starry-night` and `tmLanguage` file.
 * @property {string | undefined} [filename]
 *   Name of file, such as `text.md`;
 *   defaults to `scopeName`.
 * @property {Array<string>} names
 *   Names of language, used in the `starry-night` grammar.
 * @property {string} name
 *   Name of language;
 *   used in the `tmLanguage` file.
 * @property {string} scopeName
 *   Name of scope, such as `text.md`;
 *   when `source.mdx`, the suffix of all rules will be `.mdx`.
 * @property {string} uuid
 *   UUID to use for language;
 *   used in the `tmLanguage` file.
 */

/* eslint-disable complexity */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {common} from '@wooorm/starry-night'
import sourceClojure from '@wooorm/starry-night/source.clojure'
import sourceCoffee from '@wooorm/starry-night/source.coffee'
import sourceCssLess from '@wooorm/starry-night/source.css.less'
import sourceDockerfile from '@wooorm/starry-night/source.dockerfile'
import sourceElixir from '@wooorm/starry-night/source.elixir'
import sourceElm from '@wooorm/starry-night/source.elm'
import sourceErlang from '@wooorm/starry-night/source.erlang'
import sourceGitconfig from '@wooorm/starry-night/source.gitconfig'
import sourceHaskell from '@wooorm/starry-night/source.haskell'
import sourceJulia from '@wooorm/starry-night/source.julia'
import sourceRaku from '@wooorm/starry-night/source.raku'
import sourceScala from '@wooorm/starry-night/source.scala'
import sourceTsx from '@wooorm/starry-night/source.tsx'
import sourceToml from '@wooorm/starry-night/source.toml'
import textHtmlAsciidoc from '@wooorm/starry-night/text.html.asciidoc'
import textHtmlMarkdownSourceGfmApib from '@wooorm/starry-night/text.html.markdown.source.gfm.apib'
import textHtmlPhp from '@wooorm/starry-night/text.html.php'
import textPythonConsole from '@wooorm/starry-night/text.python.console'
import textShellSession from '@wooorm/starry-night/text.shell-session'
import {characterEntities} from 'character-entities'
import {characterEntitiesLegacy} from 'character-entities-legacy'
import escapeStringRegexp from 'escape-string-regexp'
import {nameToEmoji} from 'gemoji'
import {gzipSize} from 'gzip-size'
import {htmlBlockNames, htmlRawNames} from 'micromark-util-html-tag-name'
import plist from 'plist'
import prettyBytes from 'pretty-bytes'
import regexgen from 'regexgen'
import {fetch} from 'undici'
import {parse} from 'yaml'

/** @type {string | undefined} */
let file

// Crawl TypeScript grammar.
try {
  file = String(await fs.readFile('typescript-react.xml'))
} catch {
  const result = await fetch(
    'https://raw.githubusercontent.com/microsoft/TypeScript-TmLanguage/master/TypeScriptReact.tmLanguage'
  )
  file = await result.text()
  await fs.writeFile('typescript-react.xml', file)
}

/* eslint-disable camelcase */
/** @type {Record<string, string>} */
const dynamicVariables = {
  character_reference_name_terminated: regexgen(Object.keys(characterEntities))
    .source,
  character_reference_name_unterminated: regexgen(characterEntitiesLegacy)
    .source,
  html_basic_name: regexgen(htmlBlockNames).source,
  html_raw_name: regexgen(htmlRawNames).source,
  github_gemoji_name: regexgen(Object.keys(nameToEmoji)).source
}
/* eslint-enable camelcase */

const document = String(await fs.readFile('grammar.yml'))

/** @type {Grammar} */
const grammar = parse(document)

// Rule injection
// Figure out embedded grammars.
const embeddedGrammars = [
  ...common,
  sourceClojure,
  sourceCoffee,
  sourceCssLess,
  sourceDockerfile,
  sourceElixir,
  sourceElm,
  sourceErlang,
  sourceGitconfig,
  sourceHaskell,
  sourceJulia,
  sourceRaku,
  sourceScala,
  sourceTsx,
  sourceToml,
  textHtmlAsciidoc,
  textHtmlMarkdownSourceGfmApib,
  textHtmlPhp,
  textPythonConsole,
  textShellSession
]
  .map((d) => {
    let id = d.scopeName.split('.').pop()
    assert(id, 'expected `id`')
    id =
      id === 'basic' ? 'html' : id === 'c++' ? 'cpp' : id === 'gfm' ? 'md' : id

    const grammar = {
      scopeNames: [d.scopeName],
      extensions: d.extensions,
      extensionsWithDot: d.extensionsWithDot || [],
      names: d.names,
      id
    }

    // Remove `.tsx`, that’s weird!
    if (id === 'xml') {
      grammar.extensions = grammar.extensions.filter((d) => d !== '.tsx')
    }

    if (id === 'cpp') {
      grammar.scopeNames.push('source.cpp')
    }

    if (id === 'svg') {
      grammar.scopeNames.push('text.xml')
    }

    if (id === 'md') {
      grammar.scopeNames = ['text.md', 'source.gfm', 'text.html.markdown']
      // Remove `.mdx`.
      grammar.extensions = grammar.extensions.filter((d) => d !== '.mdx')
    }

    return grammar
  })
  .filter(
    (d) =>
      d.names.length > 0 ||
      d.extensions.length > 0 ||
      (d.extensionsWithDot && d.extensionsWithDot.length > 0)
  )

embeddedGrammars.push({
  scopeNames: ['source.mdx'],
  extensions: ['.mdx'],
  extensionsWithDot: [],
  names: ['mdx'],
  id: 'mdx'
})

embeddedGrammars.sort((a, b) => a.id.localeCompare(b.id))

/**
 * The grammars included in:
 * <https://github.com/atom/language-gfm>
 */
const gfm = [
  'source.clojure',
  'source.coffee',
  'source.cpp',
  'source.cs',
  'source.css.less',
  'source.css',
  'source.c',
  'source.diff',
  'source.dockerfile',
  'source.elixir',
  'source.elm',
  'source.erlang',
  'source.gfm',
  'source.gitconfig',
  'source.go',
  'source.graphql',
  'source.haskell',
  'source.java',
  'source.json',
  'source.js',
  'source.julia',
  'source.kotlin',
  'source.makefile',
  'source.objc',
  'source.perl',
  'source.python',
  'source.raku',
  'source.r',
  'source.ruby',
  'source.rust',
  'source.scala',
  'source.shell',
  'source.sql',
  'source.swift',
  'source.toml',
  'source.ts',
  'source.yaml',
  'text.html.asciidoc',
  'text.html.basic',
  'text.html.markdown.source.gfm.apib',
  // Turned off: this could be embedded in `language-gfm`, but not actually used in linguist.
  // See: <https://github.com/atom/language-gfm/commit/513f85f9ff44b43e80d0962fcb9e0b516d121c43>.
  // 'text.html.markdown.source.gfm.mson',
  'text.html.php',
  'text.python.console',
  'text.shell-session',
  'text.xml'
]

// Make sure we embed everything that `atom/language-gfm` did.
for (const scopeName of gfm) {
  const found = embeddedGrammars.find((d) => d.scopeNames.includes(scopeName))
  assert(found, scopeName)
}

// Inject grammars for code blocks with embedded grammars.
assert(grammar.repository, 'expected `repository`')
const codeFencedUnknown = grammar.repository['commonmark-code-fenced-unknown']
assert(codeFencedUnknown, 'expected `codeFencedUnknown` rule in `repository`')
assert(
  'patterns' in codeFencedUnknown && codeFencedUnknown.patterns,
  'expected `patterns` in `commonmark-code-fenced-unknown` rule'
)
const backtick = codeFencedUnknown.patterns[0]
const tilde = codeFencedUnknown.patterns[1]
assert(
  'begin' in backtick &&
    'end' in backtick &&
    backtick.begin &&
    backtick.end &&
    !('include' in backtick),
  'expected `begin`, `end` in backtick rule'
)
assert(/`/.test(backtick.begin), 'expected `` ` `` in `backtick` rule')
assert(
  'begin' in tilde &&
    'end' in tilde &&
    tilde.begin &&
    tilde.end &&
    !('include' in tilde),
  'expected `begin`, `end` in tilde rule'
)
assert(/~/.test(tilde.begin), 'expected `~` in `tilde` rule')

const codeFenced = grammar.repository['commonmark-code-fenced']
assert(codeFenced, 'expected `codeFenced` rule in `repository`')
assert(
  'patterns' in codeFenced && codeFenced.patterns,
  'expected `patterns` rule in `codeFenced`'
)

/** @type {Array<Rule>} */
const includes = []

for (const embedded of embeddedGrammars) {
  const id = 'commonmark-code-fenced-' + embedded.id

  const extensions = embedded.extensions
    .map((d) => d.slice(1))
    .sort()
    .map((d) => escapeStringRegexp(d))
  const extensionsWithDot = embedded.extensionsWithDot
    .map((d) => d.slice(1))
    .sort()
    .map((d) => escapeStringRegexp(d))
  const uniqueNames = embedded.names
    .filter((d) => !extensions.includes(d))
    .sort()
    .map((d) => escapeStringRegexp(d))

  // Dot is optional for extensions.
  // . const extensionsSource = '\\.?(?:' + regexgen(extensions).source + ')'
  const extensionsSource =
    extensions.length === 0
      ? ''
      : '(?:.*\\.)?' +
        (extensions.length === 1
          ? extensions[0]
          : '(?:' + extensions.join('|') + ')')
  const extensionsWithDotSource =
    extensionsWithDot.length === 0
      ? ''
      : '.*\\.' +
        (extensionsWithDot.length === 1
          ? extensionsWithDot[0]
          : '(?:' + extensionsWithDot.join('|') + ')')
  const regex =
    '(?i:' +
    [...uniqueNames, extensionsSource, extensionsWithDotSource]
      .filter(Boolean)
      .join('|') +
    ')'

  const backtickCopy = structuredClone(backtick)
  const tildeCopy = structuredClone(tilde)
  assert(backtickCopy.begin, 'expected begin')
  backtickCopy.begin = backtickCopy.begin
    .replace(/var\(char_code_info_tick\)\+/, regex)
    .replace(/\)\?\)\?/, ')?)')
  delete backtickCopy.contentName
  backtickCopy.name = 'markup.code.' + embedded.id + '.var(suffix)'
  backtickCopy.patterns = structuredClone([
    {
      begin: '(^|\\G)(\\s*)(.*)',
      while: '(^|\\G)(?![\\t ]*([`~]{3,})[\\t ]*$)',
      contentName: 'meta.embedded.' + embedded.id,
      patterns: embedded.scopeNames.map((d) => ({include: d}))
    }
  ])

  assert(tildeCopy.begin, 'expected begin')
  tildeCopy.begin = tildeCopy.begin
    .replace(/var\(char_code_info_tilde\)\+/, regex)
    .replace(/\)\?\)\?/, ')?)')
  delete tildeCopy.contentName
  tildeCopy.name = structuredClone(backtickCopy.name)
  tildeCopy.patterns = structuredClone(backtickCopy.patterns)

  grammar.repository[id] = {patterns: [backtickCopy, tildeCopy]}
  includes.push({include: '#' + id})
}

codeFenced.patterns = [...includes, ...codeFenced.patterns]

// Just use the `source.tsx` scope normally, and only optionally embed it.
/** @type {Grammar} */
// @ts-expect-error: fine.
const tsx = plist.parse(file)

// Rename all rule names so that they don’t conflict with our grammar and we
// can later optionally rename `source.ts#` to `#source-ts-`.
visit(tsx, '#', (rule) => {
  // Rename definitions:
  if ('repository' in rule && rule.repository) {
    /** @type {Record<string, Rule>} */
    const replacement = {}
    /** @type {string} */
    let key

    for (key in rule.repository) {
      if (Object.hasOwn(rule.repository, key)) {
        replacement['source-ts-' + key] = rule.repository[key]
      }
    }

    rule.repository = replacement
  }

  if ('include' in rule && rule.include && rule.include.startsWith('#')) {
    rule.include = '#source-ts-' + rule.include.slice(1)
  }

  // Fix scopes.
  // Extensions of scopes used in the TS grammar are `jsdoc`, `regexp`, and `tsx`.
  if ('name' in rule && rule.name) {
    rule.name = rule.name.replace(/\.tsx$/, '.jsx')
  }

  if ('contentName' in rule && rule.contentName) {
    rule.contentName = rule.contentName.replace(/\.tsx$/, '.jsx')
  }
})

assert(tsx.repository, 'expected repository in `ecmascript` grammar')

/** @type {Array<LanguageInfo>} */
const languages = [
  {
    // Extensions for markdown (from `github/linguist`).
    extensions: [
      '.md',
      '.livemd',
      '.markdown',
      '.mdown',
      '.mdwn',
      '.mkd',
      '.mkdn',
      '.mkdown',
      '.ronn',
      '.scd',
      '.workbook'
    ],
    conditions: [
      // CM defaults:
      'autolink',
      'code-indented',
      'html',
      // Extensions:
      'directive',
      'frontmatter',
      'gfm',
      'github',
      'math'
    ],
    // Names for the language (from `github/linguist`).
    names: ['markdown', 'md', 'pandoc'],
    name: 'markdown',
    // Which scope to use?
    // In Atom, GitHub used `source.gfm`, which is often included in the
    // grammars from `github/linguist`, and the `source.*` prefix is the
    // most common prefix.
    // In VS Code, Microsoft uses `text.html.markdown`.
    // The latter was also used before Atom.
    // But it has a problem: it “inherits” from HTML.
    // Which we specifically don’t want.
    // Especially, because we also care about MDX.
    //
    // So, we go with the same mechanism, but don’t force GFM:
    scopeName: 'text.md',
    // See: <https://superuser.com/questions/258770/how-to-change-the-default-file-format-for-saving-files-in-text-mate>
    uuid: '0A1D9874-B448-11D9-BD50-000D93B6E43C'
  },
  {
    extensions: ['.mdx'],
    conditions: [
      // Extensions:
      'frontmatter',
      'gfm',
      'github',
      'math',
      'mdx'
    ],
    names: ['mdx'],
    name: 'MDX',
    scopeName: 'source.mdx',
    // Just a random ID I created just now!
    uuid: 'fe65e2cd-7c73-4a27-8b5e-5902893626aa'
  }
]

for (const language of languages) {
  const generatedGrammar = structuredClone(grammar)

  /** @type {Record<string, string>} */
  const variables = {
    // @ts-expect-error: hush
    ...generatedGrammar.variables,
    ...dynamicVariables
  }

  // If indented code is enabled (default), we don’t mark stuff that’s
  // indented too far.
  variables.before = language.conditions.includes('code-indented')
    ? '(?:^|\\G)[ ]{0,3}'
    : '(?:^|\\G)[\\t ]*'

  variables.suffix = language.scopeName === 'source.mdx' ? 'mdx' : 'md'

  visit(generatedGrammar, '#', (rule) => {
    // Conditional rules.
    if ('if' in rule) {
      /** @type {Condition | NegatedCondition | Array<Condition | NegatedCondition>} */
      // @ts-expect-error: custom.
      const condition = rule.if
      const conditions = typeof condition === 'string' ? [condition] : condition
      /** @type {Array<Condition>} */
      const apply = []
      /** @type {Array<Condition>} */
      const negate = []

      for (const value of conditions) {
        if (value.startsWith('!')) {
          // @ts-expect-error: fine
          negate.push(value.slice(1))
        } else {
          // @ts-expect-error: fine
          apply.push(value)
        }
      }

      const include =
        (apply.length === 0 ||
          apply.some((d) => language.conditions.includes(d))) &&
        (negate.length === 0 ||
          negate.some((d) => !language.conditions.includes(d)))

      if (!include) {
        return false
      }

      // Fine, but delete the non-standard field
      delete rule.if
    }

    // Expand variables
    if ('name' in rule && rule.name) {
      rule.name = expand(rule.name, variables)
    }

    if ('contentName' in rule && rule.contentName) {
      rule.contentName = expand(rule.contentName, variables)
    }

    if (rule.match) {
      rule.match = expand(rule.match, variables)
    }

    if (rule.begin) {
      rule.begin = expand(rule.begin, variables)
    }

    if ('end' in rule && rule.end) {
      rule.end = expand(rule.end, variables)
    }

    if ('while' in rule && rule.while) {
      rule.while = expand(rule.while, variables)
    }

    // Use our own embedded big TypeScript/JavaScript grammar:
    // 1. it might be better than the other ones,
    // 2. so we can highlight JS inside code the same as JS in
    //    ESM/expressions/etc.
    if (
      language.embedTsx &&
      'include' in rule &&
      rule.include &&
      // Use it for anything that looks like JS/TS to get uniform highlighting.
      /^source\.(jsx?|tsx?)(?=#|$)/i.test(rule.include)
    ) {
      const hash = rule.include.indexOf('#')
      rule.include =
        '#source-ts-' + (hash === -1 ? 'program' : rule.include.slice(hash + 1))
    }
  })

  // Inject TSX grammar.
  if (language.embedTsx) {
    // Inject all subrules.
    Object.assign(grammar.repository, tsx.repository)
    // Inject a rule to get the entire embedded TSX grammar.
    grammar.repository['source-ts-program'] = {patterns: tsx.patterns}
  }

  const {referenced, defined} = analyze(generatedGrammar)

  for (const key of referenced) {
    if (!defined.has(key)) {
      console.warn(
        '%s: includes undefined `%s`, it’s probably removed by some condition, but still referenced somewhere',
        language.scopeName,
        key
      )
    }
  }

  for (const key of defined) {
    if (!referenced.has(key)) {
      console.warn(
        '%s: includes unreferenced `%s`, consider adding a condition to it',
        language.scopeName,
        key
      )
    }
  }

  const tmLanguage = {
    fileTypes: language.extensions.map((d) => {
      assert(d.startsWith('.'), 'expected `.`')
      return d.slice(1)
    }),
    name: language.name,
    patterns: generatedGrammar.patterns,
    repository: generatedGrammar.repository,
    scopeName: language.scopeName,
    uuid: language.uuid
  }

  /** @typedef {Grammar} */
  const starryNightGrammar = {
    extensions: language.extensions,
    names: language.names,
    patterns: generatedGrammar.patterns,
    repository: generatedGrammar.repository,
    scopeName: language.scopeName
  }

  const filename = language.filename || language.scopeName
  const size = prettyBytes(await gzipSize(JSON.stringify(tmLanguage) + '\n'))

  console.log('gzip-size:', filename, size)

  // Write files.
  await fs.writeFile(
    new URL(filename + '.tmLanguage', import.meta.url),
    // @ts-expect-error: fine, it’s serializable.
    plist.build(tmLanguage) + '\n'
  )
  await fs.writeFile(
    new URL(filename + '.js', import.meta.url),
    [
      '/* eslint-disable no-template-curly-in-string */',
      '/**',
      ' * @import {Grammar} from "@wooorm/starry-night"',
      ' */',
      '',
      '/** @type {Grammar} */',
      'const grammar = ' + JSON.stringify(starryNightGrammar, null, 2),
      'export default grammar',
      ''
    ].join('\n')
  )
}

/**
 * @param {Rule} rule
 * @returns {{referenced: Set<string>, defined: Set<string>}}
 */
function analyze(rule) {
  /** @type {Set<string>} */
  const defined = new Set()
  /** @type {Set<string>} */
  const referenced = new Set()

  visit(rule, '#', (rule) => {
    if ('repository' in rule && rule.repository) {
      for (const key of Object.keys(rule.repository)) {
        defined.add(key)
      }
    }

    if ('include' in rule && rule.include && rule.include.startsWith('#')) {
      referenced.add(rule.include.slice(1))
    }
  })

  return {referenced, defined}
}

/**
 *
 * @param {Rule} rule
 * @param {string} key
 * @param {(rule: Rule) => boolean | undefined | void} callback
 * @returns {boolean}
 */
function visit(rule, key, callback) {
  const result = callback(rule)

  if (result === false) {
    return result
  }

  if ('captures' in rule && rule.captures) map(rule.captures, key + '.captures')
  if ('beginCaptures' in rule && rule.beginCaptures)
    map(rule.beginCaptures, key + '.beginCaptures')
  if ('endCaptures' in rule && rule.endCaptures)
    map(rule.endCaptures, key + '.endCaptures')
  if ('whileCaptures' in rule && rule.whileCaptures)
    map(rule.whileCaptures, key + '.whileCaptures')
  if ('repository' in rule && rule.repository)
    map(rule.repository, key + '.repository')
  if ('injections' in rule && rule.injections)
    map(rule.injections, key + '.injections')
  if ('patterns' in rule && rule.patterns) set(rule.patterns, key + '.patterns')

  // Keep.
  return true

  /**
   * @param {Array<Rule>} values
   * @param {string} key
   */
  function set(values, key) {
    let index = -1
    while (++index < values.length) {
      const result = visit(values[index], key + '.' + index, callback)
      if (result === false) {
        values.splice(index, 1)
        index--
      }
    }
  }

  /**
   * @param {Record<string, Rule>} values
   * @param {string} parentKey
   */
  function map(values, parentKey) {
    /** @type {string} */
    let key

    for (key in values) {
      if (Object.hasOwn(values, key)) {
        const result = visit(values[key], parentKey + '.' + key, callback)
        if (result === false) {
          delete values[key]
        }
      }
    }
  }
}

/**
 * @param {string} value
 * @param {Record<string, string>} variables
 * @returns {string}
 */
function expand(value, variables) {
  let done = false

  // Support recursion.
  while (!done) {
    done = true
    value = replace(value)
  }

  return value

  /**
   * @param {string} value
   */
  function replace(value) {
    return value.replace(/var\(([^)]+)\)/g, replacer)
  }

  /**
   * @param {string} _
   * @param {string} key
   * @returns {string}
   */
  function replacer(_, key) {
    if (!Object.hasOwn(variables, key)) {
      throw new Error('Cannot expand variable `' + key + '`')
    }

    done = false
    return variables[key]
  }
}
