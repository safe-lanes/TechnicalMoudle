// Offline provider harness: execute the actual TSX with deterministic hooks,
// real encrypted storage, and explicit fakes for every external side effect.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const CryptoJS = require('crypto-js');
const probe = require('./severeSourceProbe.cjs');

const metadataKeys = ['isSync', 'createdByUuid', 'updatedByUuid', 'isDeleted', 'sortOrder'];
const source = fs.readFileSync('client/src/contexts/AuthContext.tsx', 'utf8');
// Reconstruct the previous objects for differential behavior checks. Fail if
// the bounded patch changes: this must remove precisely the fifteen additions.
let removed = 0;
const previous = source.replace(
  /^ +(?:isSync|createdByUuid|updatedByUuid|isDeleted|sortOrder): (?:null|user\.\w+ \?\? null),\n/gm,
  () => { removed++; return ''; },
);
if (removed !== 15) throw new Error(`Expected fifteen metadata additions, found ${removed}`);

function storage() {
  const values = {};
  Object.defineProperties(values, {
    getItem: { value: key => values[key] ?? null },
    setItem: { value: (key, value) => { values[key] = String(value); } },
    removeItem: { value: key => { delete values[key]; } },
  });
  return values;
}

function harness({ before = false, replit = false, profile, userType, plaintext,
  corrupt = false, marker = false, domain = 'tenant-fixture', rankChanged = true } = {}) {
  const localStorage = storage(), sessionStorage = storage();
  const events = [], states = [], effects = [], reads = [];
  const secure = probe.evaluate(
    probe.source('client/src/utils/secureStorage.ts').replaceAll('import.meta.env', '({ PROD: false })'),
    { localStorage, sessionStorage }, { 'crypto-js': { default: CryptoJS } },
  );
  if (profile) localStorage.setItem('userProfile', secure.encryptValue(profile));
  if (userType) localStorage.setItem('userType', secure.encryptValue(userType));
  if (plaintext) {
    localStorage.setItem('userProfile', JSON.stringify(plaintext));
    localStorage.setItem('userType', JSON.stringify('Office'));
  }
  if (corrupt) {
    localStorage.setItem('userProfile', 'invalid-ciphertext');
    localStorage.setItem('userType', 'invalid-ciphertext');
  }
  if (marker) secure.setLoggedOutMarker();
  if (domain) localStorage.setItem('domain', secure.encryptValue(domain));
  let index = 0, mounted = false, value;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => value,
    useState: initial => {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], next => {
        states[slot] = next;
        events.push(['state', slot, next]);
      }];
    },
    useEffect: callback => { if (!mounted) effects.push(callback); },
  };
  const imports = {
    react,
    'react/jsx-runtime': { jsx: (_type, props) => ({ props }) },
    '@/hooks/useViewModeResolution': {
      useViewModeResolution: (type, role) => {
        events.push(['viewMode', type, role]);
        return { uiRole: type === 'Ship' ? 'Ship' : role === 'Sail Admin' ? 'Sail_Admin' : 'Office',
          status: type && role ? 'resolved' : 'idle', reason: null, retry() {} };
      },
    },
    '@/utils/secureStorage': {
      ...secure,
      secureGetItem: key => { reads.push(key); return secure.secureGetItem(key); },
      clearLoggedOutMarker: () => { events.push(['clearMarker']); secure.clearLoggedOutMarker(); },
    },
    '@/lib/env': { isReplit: () => replit },
    '@/utils/localStorageAnalyzer': { analyzeLocalStorage: () => events.push(['analyze']) },
    '@/lib/activeRank': {
      setActiveRank: rank => { events.push(['rank', rank]); return rankChanged; },
      setActiveIdentity: identity => events.push(['identity', identity]),
    },
    '@/lib/queryClient': {
      queryClient: {
        invalidateQueries: options => events.push(['invalidate', [
          '/technical/api/scoped-operation-data', '/technical/api/scoped-operation-data/ship',
          '/technical/api/other', 42,
        ].map(key => options.predicate({ queryKey: [key] }))]),
        clear: () => events.push(['clearQueries']),
      },
      apiRequest: async (...args) => { events.push(['request', ...args]); },
    },
  };
  const module = { exports: {} };
  const code = ts.transpileModule((before ? previous : source).replaceAll('import.meta.env.DEV', 'false'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-01-01T00:00:00.000Z'])); }
  }
  vm.runInNewContext(code, {
    module, exports: module.exports, localStorage, sessionStorage, Date: FixedDate,
    console: { log() {}, warn() {}, error() {} },
    require: id => {
      if (!(id in imports)) throw new Error(`Auth probe blocked import: ${id}`);
      return imports[id];
    },
  }, { timeout: 15000 });
  function render() {
    index = 0;
    value = module.exports.AuthProvider({ children: null }).props.value;
  }
  render();
  effects.forEach(effect => effect());
  mounted = true;
  render();
  return { get value() { return value; }, render, events, reads, localStorage, sessionStorage };
}

function withoutMetadata(value) {
  return JSON.parse(JSON.stringify(value, (key, item) =>
    metadataKeys.includes(key) ? undefined : item));
}

module.exports = { harness, metadataKeys, withoutMetadata };
