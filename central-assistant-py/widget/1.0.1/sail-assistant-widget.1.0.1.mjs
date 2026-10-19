var qi = typeof globalThis != "undefined" ? globalThis : typeof window != "undefined" ? window : typeof global != "undefined" ? global : typeof self != "undefined" ? self : {};
function df(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var hf = { exports: {} }, H = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ii = Symbol.for("react.element"), Hh = Symbol.for("react.portal"), Vh = Symbol.for("react.fragment"), Wh = Symbol.for("react.strict_mode"), Qh = Symbol.for("react.profiler"), Kh = Symbol.for("react.provider"), qh = Symbol.for("react.context"), Yh = Symbol.for("react.forward_ref"), Xh = Symbol.for("react.suspense"), Gh = Symbol.for("react.memo"), Zh = Symbol.for("react.lazy"), ia = Symbol.iterator;
function Jh(e) {
  return e === null || typeof e != "object" ? null : (e = ia && e[ia] || e["@@iterator"], typeof e == "function" ? e : null);
}
var mf = { isMounted: function() {
  return !1;
}, enqueueForceUpdate: function() {
}, enqueueReplaceState: function() {
}, enqueueSetState: function() {
} }, gf = Object.assign, yf = {};
function lr(e, t, n) {
  this.props = e, this.context = t, this.refs = yf, this.updater = n || mf;
}
lr.prototype.isReactComponent = {};
lr.prototype.setState = function(e, t) {
  if (typeof e != "object" && typeof e != "function" && e != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
  this.updater.enqueueSetState(this, e, t, "setState");
};
lr.prototype.forceUpdate = function(e) {
  this.updater.enqueueForceUpdate(this, e, "forceUpdate");
};
function kf() {
}
kf.prototype = lr.prototype;
function Bu(e, t, n) {
  this.props = e, this.context = t, this.refs = yf, this.updater = n || mf;
}
var Uu = Bu.prototype = new kf();
Uu.constructor = Bu;
gf(Uu, lr.prototype);
Uu.isPureReactComponent = !0;
var la = Array.isArray, vf = Object.prototype.hasOwnProperty, $u = { current: null }, xf = { key: !0, ref: !0, __self: !0, __source: !0 };
function wf(e, t, n) {
  var r, i = {}, l = null, o = null;
  if (t != null) for (r in t.ref !== void 0 && (o = t.ref), t.key !== void 0 && (l = "" + t.key), t) vf.call(t, r) && !xf.hasOwnProperty(r) && (i[r] = t[r]);
  var u = arguments.length - 2;
  if (u === 1) i.children = n;
  else if (1 < u) {
    for (var s = Array(u), a = 0; a < u; a++) s[a] = arguments[a + 2];
    i.children = s;
  }
  if (e && e.defaultProps) for (r in u = e.defaultProps, u) i[r] === void 0 && (i[r] = u[r]);
  return { $$typeof: ii, type: e, key: l, ref: o, props: i, _owner: $u.current };
}
function em(e, t) {
  return { $$typeof: ii, type: e.type, key: t, ref: e.ref, props: e.props, _owner: e._owner };
}
function Hu(e) {
  return typeof e == "object" && e !== null && e.$$typeof === ii;
}
function tm(e) {
  var t = { "=": "=0", ":": "=2" };
  return "$" + e.replace(/[=:]/g, function(n) {
    return t[n];
  });
}
var oa = /\/+/g;
function Wl(e, t) {
  return typeof e == "object" && e !== null && e.key != null ? tm("" + e.key) : t.toString(36);
}
function Di(e, t, n, r, i) {
  var l = typeof e;
  (l === "undefined" || l === "boolean") && (e = null);
  var o = !1;
  if (e === null) o = !0;
  else switch (l) {
    case "string":
    case "number":
      o = !0;
      break;
    case "object":
      switch (e.$$typeof) {
        case ii:
        case Hh:
          o = !0;
      }
  }
  if (o) return o = e, i = i(o), e = r === "" ? "." + Wl(o, 0) : r, la(i) ? (n = "", e != null && (n = e.replace(oa, "$&/") + "/"), Di(i, t, n, "", function(a) {
    return a;
  })) : i != null && (Hu(i) && (i = em(i, n + (!i.key || o && o.key === i.key ? "" : ("" + i.key).replace(oa, "$&/") + "/") + e)), t.push(i)), 1;
  if (o = 0, r = r === "" ? "." : r + ":", la(e)) for (var u = 0; u < e.length; u++) {
    l = e[u];
    var s = r + Wl(l, u);
    o += Di(l, t, n, s, i);
  }
  else if (s = Jh(e), typeof s == "function") for (e = s.call(e), u = 0; !(l = e.next()).done; ) l = l.value, s = r + Wl(l, u++), o += Di(l, t, n, s, i);
  else if (l === "object") throw t = String(e), Error("Objects are not valid as a React child (found: " + (t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t) + "). If you meant to render a collection of children, use an array instead.");
  return o;
}
function di(e, t, n) {
  if (e == null) return e;
  var r = [], i = 0;
  return Di(e, r, "", "", function(l) {
    return t.call(n, l, i++);
  }), r;
}
function nm(e) {
  if (e._status === -1) {
    var t = e._result;
    t = t(), t.then(function(n) {
      (e._status === 0 || e._status === -1) && (e._status = 1, e._result = n);
    }, function(n) {
      (e._status === 0 || e._status === -1) && (e._status = 2, e._result = n);
    }), e._status === -1 && (e._status = 0, e._result = t);
  }
  if (e._status === 1) return e._result.default;
  throw e._result;
}
var Ae = { current: null }, Ri = { transition: null }, rm = { ReactCurrentDispatcher: Ae, ReactCurrentBatchConfig: Ri, ReactCurrentOwner: $u };
function Sf() {
  throw Error("act(...) is not supported in production builds of React.");
}
H.Children = { map: di, forEach: function(e, t, n) {
  di(e, function() {
    t.apply(this, arguments);
  }, n);
}, count: function(e) {
  var t = 0;
  return di(e, function() {
    t++;
  }), t;
}, toArray: function(e) {
  return di(e, function(t) {
    return t;
  }) || [];
}, only: function(e) {
  if (!Hu(e)) throw Error("React.Children.only expected to receive a single React element child.");
  return e;
} };
H.Component = lr;
H.Fragment = Vh;
H.Profiler = Qh;
H.PureComponent = Bu;
H.StrictMode = Wh;
H.Suspense = Xh;
H.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = rm;
H.act = Sf;
H.cloneElement = function(e, t, n) {
  if (e == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + e + ".");
  var r = gf({}, e.props), i = e.key, l = e.ref, o = e._owner;
  if (t != null) {
    if (t.ref !== void 0 && (l = t.ref, o = $u.current), t.key !== void 0 && (i = "" + t.key), e.type && e.type.defaultProps) var u = e.type.defaultProps;
    for (s in t) vf.call(t, s) && !xf.hasOwnProperty(s) && (r[s] = t[s] === void 0 && u !== void 0 ? u[s] : t[s]);
  }
  var s = arguments.length - 2;
  if (s === 1) r.children = n;
  else if (1 < s) {
    u = Array(s);
    for (var a = 0; a < s; a++) u[a] = arguments[a + 2];
    r.children = u;
  }
  return { $$typeof: ii, type: e.type, key: i, ref: l, props: r, _owner: o };
};
H.createContext = function(e) {
  return e = { $$typeof: qh, _currentValue: e, _currentValue2: e, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, e.Provider = { $$typeof: Kh, _context: e }, e.Consumer = e;
};
H.createElement = wf;
H.createFactory = function(e) {
  var t = wf.bind(null, e);
  return t.type = e, t;
};
H.createRef = function() {
  return { current: null };
};
H.forwardRef = function(e) {
  return { $$typeof: Yh, render: e };
};
H.isValidElement = Hu;
H.lazy = function(e) {
  return { $$typeof: Zh, _payload: { _status: -1, _result: e }, _init: nm };
};
H.memo = function(e, t) {
  return { $$typeof: Gh, type: e, compare: t === void 0 ? null : t };
};
H.startTransition = function(e) {
  var t = Ri.transition;
  Ri.transition = {};
  try {
    e();
  } finally {
    Ri.transition = t;
  }
};
H.unstable_act = Sf;
H.useCallback = function(e, t) {
  return Ae.current.useCallback(e, t);
};
H.useContext = function(e) {
  return Ae.current.useContext(e);
};
H.useDebugValue = function() {
};
H.useDeferredValue = function(e) {
  return Ae.current.useDeferredValue(e);
};
H.useEffect = function(e, t) {
  return Ae.current.useEffect(e, t);
};
H.useId = function() {
  return Ae.current.useId();
};
H.useImperativeHandle = function(e, t, n) {
  return Ae.current.useImperativeHandle(e, t, n);
};
H.useInsertionEffect = function(e, t) {
  return Ae.current.useInsertionEffect(e, t);
};
H.useLayoutEffect = function(e, t) {
  return Ae.current.useLayoutEffect(e, t);
};
H.useMemo = function(e, t) {
  return Ae.current.useMemo(e, t);
};
H.useReducer = function(e, t, n) {
  return Ae.current.useReducer(e, t, n);
};
H.useRef = function(e) {
  return Ae.current.useRef(e);
};
H.useState = function(e) {
  return Ae.current.useState(e);
};
H.useSyncExternalStore = function(e, t, n) {
  return Ae.current.useSyncExternalStore(e, t, n);
};
H.useTransition = function() {
  return Ae.current.useTransition();
};
H.version = "18.3.1";
hf.exports = H;
var Ve = hf.exports, Cf = { exports: {} }, Xe = {}, Ef = { exports: {} }, Tf = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function(e) {
  function t(N, j) {
    var k = N.length;
    N.push(j);
    e: for (; 0 < k; ) {
      var q = k - 1 >>> 1, G = N[q];
      if (0 < i(G, j)) N[q] = j, N[k] = G, k = q;
      else break e;
    }
  }
  function n(N) {
    return N.length === 0 ? null : N[0];
  }
  function r(N) {
    if (N.length === 0) return null;
    var j = N[0], k = N.pop();
    if (k !== j) {
      N[0] = k;
      e: for (var q = 0, G = N.length, v = G >>> 1; q < v; ) {
        var ge = 2 * (q + 1) - 1, lt = N[ge], re = ge + 1, mt = N[re];
        if (0 > i(lt, k)) re < G && 0 > i(mt, lt) ? (N[q] = mt, N[re] = k, q = re) : (N[q] = lt, N[ge] = k, q = ge);
        else if (re < G && 0 > i(mt, k)) N[q] = mt, N[re] = k, q = re;
        else break e;
      }
    }
    return j;
  }
  function i(N, j) {
    var k = N.sortIndex - j.sortIndex;
    return k !== 0 ? k : N.id - j.id;
  }
  if (typeof performance == "object" && typeof performance.now == "function") {
    var l = performance;
    e.unstable_now = function() {
      return l.now();
    };
  } else {
    var o = Date, u = o.now();
    e.unstable_now = function() {
      return o.now() - u;
    };
  }
  var s = [], a = [], f = 1, c = null, p = 3, d = !1, g = !1, x = !1, T = typeof setTimeout == "function" ? setTimeout : null, h = typeof clearTimeout == "function" ? clearTimeout : null, m = typeof setImmediate != "undefined" ? setImmediate : null;
  typeof navigator != "undefined" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
  function y(N) {
    for (var j = n(a); j !== null; ) {
      if (j.callback === null) r(a);
      else if (j.startTime <= N) r(a), j.sortIndex = j.expirationTime, t(s, j);
      else break;
      j = n(a);
    }
  }
  function C(N) {
    if (x = !1, y(N), !g) if (n(s) !== null) g = !0, de(_);
    else {
      var j = n(a);
      j !== null && fe(C, j.startTime - N);
    }
  }
  function _(N, j) {
    g = !1, x && (x = !1, h(L), L = -1), d = !0;
    var k = p;
    try {
      for (y(j), c = n(s); c !== null && (!(c.expirationTime > j) || N && !A()); ) {
        var q = c.callback;
        if (typeof q == "function") {
          c.callback = null, p = c.priorityLevel;
          var G = q(c.expirationTime <= j);
          j = e.unstable_now(), typeof G == "function" ? c.callback = G : c === n(s) && r(s), y(j);
        } else r(s);
        c = n(s);
      }
      if (c !== null) var v = !0;
      else {
        var ge = n(a);
        ge !== null && fe(C, ge.startTime - j), v = !1;
      }
      return v;
    } finally {
      c = null, p = k, d = !1;
    }
  }
  var w = !1, P = null, L = -1, M = 5, S = -1;
  function A() {
    return !(e.unstable_now() - S < M);
  }
  function R() {
    if (P !== null) {
      var N = e.unstable_now();
      S = N;
      var j = !0;
      try {
        j = P(!0, N);
      } finally {
        j ? K() : (w = !1, P = null);
      }
    } else w = !1;
  }
  var K;
  if (typeof m == "function") K = function() {
    m(R);
  };
  else if (typeof MessageChannel != "undefined") {
    var ee = new MessageChannel(), V = ee.port2;
    ee.port1.onmessage = R, K = function() {
      V.postMessage(null);
    };
  } else K = function() {
    T(R, 0);
  };
  function de(N) {
    P = N, w || (w = !0, K());
  }
  function fe(N, j) {
    L = T(function() {
      N(e.unstable_now());
    }, j);
  }
  e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(N) {
    N.callback = null;
  }, e.unstable_continueExecution = function() {
    g || d || (g = !0, de(_));
  }, e.unstable_forceFrameRate = function(N) {
    0 > N || 125 < N ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : M = 0 < N ? Math.floor(1e3 / N) : 5;
  }, e.unstable_getCurrentPriorityLevel = function() {
    return p;
  }, e.unstable_getFirstCallbackNode = function() {
    return n(s);
  }, e.unstable_next = function(N) {
    switch (p) {
      case 1:
      case 2:
      case 3:
        var j = 3;
        break;
      default:
        j = p;
    }
    var k = p;
    p = j;
    try {
      return N();
    } finally {
      p = k;
    }
  }, e.unstable_pauseExecution = function() {
  }, e.unstable_requestPaint = function() {
  }, e.unstable_runWithPriority = function(N, j) {
    switch (N) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        break;
      default:
        N = 3;
    }
    var k = p;
    p = N;
    try {
      return j();
    } finally {
      p = k;
    }
  }, e.unstable_scheduleCallback = function(N, j, k) {
    var q = e.unstable_now();
    switch (typeof k == "object" && k !== null ? (k = k.delay, k = typeof k == "number" && 0 < k ? q + k : q) : k = q, N) {
      case 1:
        var G = -1;
        break;
      case 2:
        G = 250;
        break;
      case 5:
        G = 1073741823;
        break;
      case 4:
        G = 1e4;
        break;
      default:
        G = 5e3;
    }
    return G = k + G, N = { id: f++, callback: j, priorityLevel: N, startTime: k, expirationTime: G, sortIndex: -1 }, k > q ? (N.sortIndex = k, t(a, N), n(s) === null && N === n(a) && (x ? (h(L), L = -1) : x = !0, fe(C, k - q))) : (N.sortIndex = G, t(s, N), g || d || (g = !0, de(_))), N;
  }, e.unstable_shouldYield = A, e.unstable_wrapCallback = function(N) {
    var j = p;
    return function() {
      var k = p;
      p = j;
      try {
        return N.apply(this, arguments);
      } finally {
        p = k;
      }
    };
  };
})(Tf);
Ef.exports = Tf;
var im = Ef.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var lm = Ve, Ye = im;
function I(e) {
  for (var t = "https://reactjs.org/docs/error-decoder.html?invariant=" + e, n = 1; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
  return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
var _f = /* @__PURE__ */ new Set(), jr = {};
function Cn(e, t) {
  Gn(e, t), Gn(e + "Capture", t);
}
function Gn(e, t) {
  for (jr[e] = t, e = 0; e < t.length; e++) _f.add(t[e]);
}
var Lt = !(typeof window == "undefined" || typeof window.document == "undefined" || typeof window.document.createElement == "undefined"), Do = Object.prototype.hasOwnProperty, om = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, ua = {}, sa = {};
function um(e) {
  return Do.call(sa, e) ? !0 : Do.call(ua, e) ? !1 : om.test(e) ? sa[e] = !0 : (ua[e] = !0, !1);
}
function sm(e, t, n, r) {
  if (n !== null && n.type === 0) return !1;
  switch (typeof t) {
    case "function":
    case "symbol":
      return !0;
    case "boolean":
      return r ? !1 : n !== null ? !n.acceptsBooleans : (e = e.toLowerCase().slice(0, 5), e !== "data-" && e !== "aria-");
    default:
      return !1;
  }
}
function am(e, t, n, r) {
  if (t === null || typeof t == "undefined" || sm(e, t, n, r)) return !0;
  if (r) return !1;
  if (n !== null) switch (n.type) {
    case 3:
      return !t;
    case 4:
      return t === !1;
    case 5:
      return isNaN(t);
    case 6:
      return isNaN(t) || 1 > t;
  }
  return !1;
}
function De(e, t, n, r, i, l, o) {
  this.acceptsBooleans = t === 2 || t === 3 || t === 4, this.attributeName = r, this.attributeNamespace = i, this.mustUseProperty = n, this.propertyName = e, this.type = t, this.sanitizeURL = l, this.removeEmptyString = o;
}
var Ce = {};
"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e) {
  Ce[e] = new De(e, 0, !1, e, null, !1, !1);
});
[["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(e) {
  var t = e[0];
  Ce[t] = new De(t, 1, !1, e[1], null, !1, !1);
});
["contentEditable", "draggable", "spellCheck", "value"].forEach(function(e) {
  Ce[e] = new De(e, 2, !1, e.toLowerCase(), null, !1, !1);
});
["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(e) {
  Ce[e] = new De(e, 2, !1, e, null, !1, !1);
});
"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e) {
  Ce[e] = new De(e, 3, !1, e.toLowerCase(), null, !1, !1);
});
["checked", "multiple", "muted", "selected"].forEach(function(e) {
  Ce[e] = new De(e, 3, !0, e, null, !1, !1);
});
["capture", "download"].forEach(function(e) {
  Ce[e] = new De(e, 4, !1, e, null, !1, !1);
});
["cols", "rows", "size", "span"].forEach(function(e) {
  Ce[e] = new De(e, 6, !1, e, null, !1, !1);
});
["rowSpan", "start"].forEach(function(e) {
  Ce[e] = new De(e, 5, !1, e.toLowerCase(), null, !1, !1);
});
var Vu = /[\-:]([a-z])/g;
function Wu(e) {
  return e[1].toUpperCase();
}
"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e) {
  var t = e.replace(
    Vu,
    Wu
  );
  Ce[t] = new De(t, 1, !1, e, null, !1, !1);
});
"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e) {
  var t = e.replace(Vu, Wu);
  Ce[t] = new De(t, 1, !1, e, "http://www.w3.org/1999/xlink", !1, !1);
});
["xml:base", "xml:lang", "xml:space"].forEach(function(e) {
  var t = e.replace(Vu, Wu);
  Ce[t] = new De(t, 1, !1, e, "http://www.w3.org/XML/1998/namespace", !1, !1);
});
["tabIndex", "crossOrigin"].forEach(function(e) {
  Ce[e] = new De(e, 1, !1, e.toLowerCase(), null, !1, !1);
});
Ce.xlinkHref = new De("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1);
["src", "href", "action", "formAction"].forEach(function(e) {
  Ce[e] = new De(e, 1, !1, e.toLowerCase(), null, !0, !0);
});
function Qu(e, t, n, r) {
  var i = Ce.hasOwnProperty(t) ? Ce[t] : null;
  (i !== null ? i.type !== 0 : r || !(2 < t.length) || t[0] !== "o" && t[0] !== "O" || t[1] !== "n" && t[1] !== "N") && (am(t, n, i, r) && (n = null), r || i === null ? um(t) && (n === null ? e.removeAttribute(t) : e.setAttribute(t, "" + n)) : i.mustUseProperty ? e[i.propertyName] = n === null ? i.type === 3 ? !1 : "" : n : (t = i.attributeName, r = i.attributeNamespace, n === null ? e.removeAttribute(t) : (i = i.type, n = i === 3 || i === 4 && n === !0 ? "" : "" + n, r ? e.setAttributeNS(r, t, n) : e.setAttribute(t, n))));
}
var Dt = lm.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, hi = Symbol.for("react.element"), Nn = Symbol.for("react.portal"), An = Symbol.for("react.fragment"), Ku = Symbol.for("react.strict_mode"), Ro = Symbol.for("react.profiler"), If = Symbol.for("react.provider"), Pf = Symbol.for("react.context"), qu = Symbol.for("react.forward_ref"), Fo = Symbol.for("react.suspense"), Oo = Symbol.for("react.suspense_list"), Yu = Symbol.for("react.memo"), jt = Symbol.for("react.lazy"), zf = Symbol.for("react.offscreen"), aa = Symbol.iterator;
function pr(e) {
  return e === null || typeof e != "object" ? null : (e = aa && e[aa] || e["@@iterator"], typeof e == "function" ? e : null);
}
var ae = Object.assign, Ql;
function Cr(e) {
  if (Ql === void 0) try {
    throw Error();
  } catch (n) {
    var t = n.stack.trim().match(/\n( *(at )?)/);
    Ql = t && t[1] || "";
  }
  return `
` + Ql + e;
}
var Kl = !1;
function ql(e, t) {
  if (!e || Kl) return "";
  Kl = !0;
  var n = Error.prepareStackTrace;
  Error.prepareStackTrace = void 0;
  try {
    if (t) if (t = function() {
      throw Error();
    }, Object.defineProperty(t.prototype, "props", { set: function() {
      throw Error();
    } }), typeof Reflect == "object" && Reflect.construct) {
      try {
        Reflect.construct(t, []);
      } catch (a) {
        var r = a;
      }
      Reflect.construct(e, [], t);
    } else {
      try {
        t.call();
      } catch (a) {
        r = a;
      }
      e.call(t.prototype);
    }
    else {
      try {
        throw Error();
      } catch (a) {
        r = a;
      }
      e();
    }
  } catch (a) {
    if (a && r && typeof a.stack == "string") {
      for (var i = a.stack.split(`
`), l = r.stack.split(`
`), o = i.length - 1, u = l.length - 1; 1 <= o && 0 <= u && i[o] !== l[u]; ) u--;
      for (; 1 <= o && 0 <= u; o--, u--) if (i[o] !== l[u]) {
        if (o !== 1 || u !== 1)
          do
            if (o--, u--, 0 > u || i[o] !== l[u]) {
              var s = `
` + i[o].replace(" at new ", " at ");
              return e.displayName && s.includes("<anonymous>") && (s = s.replace("<anonymous>", e.displayName)), s;
            }
          while (1 <= o && 0 <= u);
        break;
      }
    }
  } finally {
    Kl = !1, Error.prepareStackTrace = n;
  }
  return (e = e ? e.displayName || e.name : "") ? Cr(e) : "";
}
function cm(e) {
  switch (e.tag) {
    case 5:
      return Cr(e.type);
    case 16:
      return Cr("Lazy");
    case 13:
      return Cr("Suspense");
    case 19:
      return Cr("SuspenseList");
    case 0:
    case 2:
    case 15:
      return e = ql(e.type, !1), e;
    case 11:
      return e = ql(e.type.render, !1), e;
    case 1:
      return e = ql(e.type, !0), e;
    default:
      return "";
  }
}
function Mo(e) {
  if (e == null) return null;
  if (typeof e == "function") return e.displayName || e.name || null;
  if (typeof e == "string") return e;
  switch (e) {
    case An:
      return "Fragment";
    case Nn:
      return "Portal";
    case Ro:
      return "Profiler";
    case Ku:
      return "StrictMode";
    case Fo:
      return "Suspense";
    case Oo:
      return "SuspenseList";
  }
  if (typeof e == "object") switch (e.$$typeof) {
    case Pf:
      return (e.displayName || "Context") + ".Consumer";
    case If:
      return (e._context.displayName || "Context") + ".Provider";
    case qu:
      var t = e.render;
      return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
    case Yu:
      return t = e.displayName || null, t !== null ? t : Mo(e.type) || "Memo";
    case jt:
      t = e._payload, e = e._init;
      try {
        return Mo(e(t));
      } catch {
      }
  }
  return null;
}
function fm(e) {
  var t = e.type;
  switch (e.tag) {
    case 24:
      return "Cache";
    case 9:
      return (t.displayName || "Context") + ".Consumer";
    case 10:
      return (t._context.displayName || "Context") + ".Provider";
    case 18:
      return "DehydratedFragment";
    case 11:
      return e = t.render, e = e.displayName || e.name || "", t.displayName || (e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef");
    case 7:
      return "Fragment";
    case 5:
      return t;
    case 4:
      return "Portal";
    case 3:
      return "Root";
    case 6:
      return "Text";
    case 16:
      return Mo(t);
    case 8:
      return t === Ku ? "StrictMode" : "Mode";
    case 22:
      return "Offscreen";
    case 12:
      return "Profiler";
    case 21:
      return "Scope";
    case 13:
      return "Suspense";
    case 19:
      return "SuspenseList";
    case 25:
      return "TracingMarker";
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
      if (typeof t == "function") return t.displayName || t.name || null;
      if (typeof t == "string") return t;
  }
  return null;
}
function Jt(e) {
  switch (typeof e) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return e;
    case "object":
      return e;
    default:
      return "";
  }
}
function Lf(e) {
  var t = e.type;
  return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
}
function pm(e) {
  var t = Lf(e) ? "checked" : "value", n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t), r = "" + e[t];
  if (!e.hasOwnProperty(t) && typeof n != "undefined" && typeof n.get == "function" && typeof n.set == "function") {
    var i = n.get, l = n.set;
    return Object.defineProperty(e, t, { configurable: !0, get: function() {
      return i.call(this);
    }, set: function(o) {
      r = "" + o, l.call(this, o);
    } }), Object.defineProperty(e, t, { enumerable: n.enumerable }), { getValue: function() {
      return r;
    }, setValue: function(o) {
      r = "" + o;
    }, stopTracking: function() {
      e._valueTracker = null, delete e[t];
    } };
  }
}
function mi(e) {
  e._valueTracker || (e._valueTracker = pm(e));
}
function bf(e) {
  if (!e) return !1;
  var t = e._valueTracker;
  if (!t) return !0;
  var n = t.getValue(), r = "";
  return e && (r = Lf(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n ? (t.setValue(e), !0) : !1;
}
function Yi(e) {
  if (e = e || (typeof document != "undefined" ? document : void 0), typeof e == "undefined") return null;
  try {
    return e.activeElement || e.body;
  } catch {
    return e.body;
  }
}
function jo(e, t) {
  var n = t.checked;
  return ae({}, t, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: n != null ? n : e._wrapperState.initialChecked });
}
function ca(e, t) {
  var n = t.defaultValue == null ? "" : t.defaultValue, r = t.checked != null ? t.checked : t.defaultChecked;
  n = Jt(t.value != null ? t.value : n), e._wrapperState = { initialChecked: r, initialValue: n, controlled: t.type === "checkbox" || t.type === "radio" ? t.checked != null : t.value != null };
}
function Nf(e, t) {
  t = t.checked, t != null && Qu(e, "checked", t, !1);
}
function Bo(e, t) {
  Nf(e, t);
  var n = Jt(t.value), r = t.type;
  if (n != null) r === "number" ? (n === 0 && e.value === "" || e.value != n) && (e.value = "" + n) : e.value !== "" + n && (e.value = "" + n);
  else if (r === "submit" || r === "reset") {
    e.removeAttribute("value");
    return;
  }
  t.hasOwnProperty("value") ? Uo(e, t.type, n) : t.hasOwnProperty("defaultValue") && Uo(e, t.type, Jt(t.defaultValue)), t.checked == null && t.defaultChecked != null && (e.defaultChecked = !!t.defaultChecked);
}
function fa(e, t, n) {
  if (t.hasOwnProperty("value") || t.hasOwnProperty("defaultValue")) {
    var r = t.type;
    if (!(r !== "submit" && r !== "reset" || t.value !== void 0 && t.value !== null)) return;
    t = "" + e._wrapperState.initialValue, n || t === e.value || (e.value = t), e.defaultValue = t;
  }
  n = e.name, n !== "" && (e.name = ""), e.defaultChecked = !!e._wrapperState.initialChecked, n !== "" && (e.name = n);
}
function Uo(e, t, n) {
  (t !== "number" || Yi(e.ownerDocument) !== e) && (n == null ? e.defaultValue = "" + e._wrapperState.initialValue : e.defaultValue !== "" + n && (e.defaultValue = "" + n));
}
var Er = Array.isArray;
function Vn(e, t, n, r) {
  if (e = e.options, t) {
    t = {};
    for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
    for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
  } else {
    for (n = "" + Jt(n), t = null, i = 0; i < e.length; i++) {
      if (e[i].value === n) {
        e[i].selected = !0, r && (e[i].defaultSelected = !0);
        return;
      }
      t !== null || e[i].disabled || (t = e[i]);
    }
    t !== null && (t.selected = !0);
  }
}
function $o(e, t) {
  if (t.dangerouslySetInnerHTML != null) throw Error(I(91));
  return ae({}, t, { value: void 0, defaultValue: void 0, children: "" + e._wrapperState.initialValue });
}
function pa(e, t) {
  var n = t.value;
  if (n == null) {
    if (n = t.children, t = t.defaultValue, n != null) {
      if (t != null) throw Error(I(92));
      if (Er(n)) {
        if (1 < n.length) throw Error(I(93));
        n = n[0];
      }
      t = n;
    }
    t == null && (t = ""), n = t;
  }
  e._wrapperState = { initialValue: Jt(n) };
}
function Af(e, t) {
  var n = Jt(t.value), r = Jt(t.defaultValue);
  n != null && (n = "" + n, n !== e.value && (e.value = n), t.defaultValue == null && e.defaultValue !== n && (e.defaultValue = n)), r != null && (e.defaultValue = "" + r);
}
function da(e) {
  var t = e.textContent;
  t === e._wrapperState.initialValue && t !== "" && t !== null && (e.value = t);
}
function Df(e) {
  switch (e) {
    case "svg":
      return "http://www.w3.org/2000/svg";
    case "math":
      return "http://www.w3.org/1998/Math/MathML";
    default:
      return "http://www.w3.org/1999/xhtml";
  }
}
function Ho(e, t) {
  return e == null || e === "http://www.w3.org/1999/xhtml" ? Df(t) : e === "http://www.w3.org/2000/svg" && t === "foreignObject" ? "http://www.w3.org/1999/xhtml" : e;
}
var gi, Rf = function(e) {
  return typeof MSApp != "undefined" && MSApp.execUnsafeLocalFunction ? function(t, n, r, i) {
    MSApp.execUnsafeLocalFunction(function() {
      return e(t, n, r, i);
    });
  } : e;
}(function(e, t) {
  if (e.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML" in e) e.innerHTML = t;
  else {
    for (gi = gi || document.createElement("div"), gi.innerHTML = "<svg>" + t.valueOf().toString() + "</svg>", t = gi.firstChild; e.firstChild; ) e.removeChild(e.firstChild);
    for (; t.firstChild; ) e.appendChild(t.firstChild);
  }
});
function Br(e, t) {
  if (t) {
    var n = e.firstChild;
    if (n && n === e.lastChild && n.nodeType === 3) {
      n.nodeValue = t;
      return;
    }
  }
  e.textContent = t;
}
var Ir = {
  animationIterationCount: !0,
  aspectRatio: !0,
  borderImageOutset: !0,
  borderImageSlice: !0,
  borderImageWidth: !0,
  boxFlex: !0,
  boxFlexGroup: !0,
  boxOrdinalGroup: !0,
  columnCount: !0,
  columns: !0,
  flex: !0,
  flexGrow: !0,
  flexPositive: !0,
  flexShrink: !0,
  flexNegative: !0,
  flexOrder: !0,
  gridArea: !0,
  gridRow: !0,
  gridRowEnd: !0,
  gridRowSpan: !0,
  gridRowStart: !0,
  gridColumn: !0,
  gridColumnEnd: !0,
  gridColumnSpan: !0,
  gridColumnStart: !0,
  fontWeight: !0,
  lineClamp: !0,
  lineHeight: !0,
  opacity: !0,
  order: !0,
  orphans: !0,
  tabSize: !0,
  widows: !0,
  zIndex: !0,
  zoom: !0,
  fillOpacity: !0,
  floodOpacity: !0,
  stopOpacity: !0,
  strokeDasharray: !0,
  strokeDashoffset: !0,
  strokeMiterlimit: !0,
  strokeOpacity: !0,
  strokeWidth: !0
}, dm = ["Webkit", "ms", "Moz", "O"];
Object.keys(Ir).forEach(function(e) {
  dm.forEach(function(t) {
    t = t + e.charAt(0).toUpperCase() + e.substring(1), Ir[t] = Ir[e];
  });
});
function Ff(e, t, n) {
  return t == null || typeof t == "boolean" || t === "" ? "" : n || typeof t != "number" || t === 0 || Ir.hasOwnProperty(e) && Ir[e] ? ("" + t).trim() : t + "px";
}
function Of(e, t) {
  e = e.style;
  for (var n in t) if (t.hasOwnProperty(n)) {
    var r = n.indexOf("--") === 0, i = Ff(n, t[n], r);
    n === "float" && (n = "cssFloat"), r ? e.setProperty(n, i) : e[n] = i;
  }
}
var hm = ae({ menuitem: !0 }, { area: !0, base: !0, br: !0, col: !0, embed: !0, hr: !0, img: !0, input: !0, keygen: !0, link: !0, meta: !0, param: !0, source: !0, track: !0, wbr: !0 });
function Vo(e, t) {
  if (t) {
    if (hm[e] && (t.children != null || t.dangerouslySetInnerHTML != null)) throw Error(I(137, e));
    if (t.dangerouslySetInnerHTML != null) {
      if (t.children != null) throw Error(I(60));
      if (typeof t.dangerouslySetInnerHTML != "object" || !("__html" in t.dangerouslySetInnerHTML)) throw Error(I(61));
    }
    if (t.style != null && typeof t.style != "object") throw Error(I(62));
  }
}
function Wo(e, t) {
  if (e.indexOf("-") === -1) return typeof t.is == "string";
  switch (e) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return !1;
    default:
      return !0;
  }
}
var Qo = null;
function Xu(e) {
  return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
}
var Ko = null, Wn = null, Qn = null;
function ha(e) {
  if (e = ui(e)) {
    if (typeof Ko != "function") throw Error(I(280));
    var t = e.stateNode;
    t && (t = Il(t), Ko(e.stateNode, e.type, t));
  }
}
function Mf(e) {
  Wn ? Qn ? Qn.push(e) : Qn = [e] : Wn = e;
}
function jf() {
  if (Wn) {
    var e = Wn, t = Qn;
    if (Qn = Wn = null, ha(e), t) for (e = 0; e < t.length; e++) ha(t[e]);
  }
}
function Bf(e, t) {
  return e(t);
}
function Uf() {
}
var Yl = !1;
function $f(e, t, n) {
  if (Yl) return e(t, n);
  Yl = !0;
  try {
    return Bf(e, t, n);
  } finally {
    Yl = !1, (Wn !== null || Qn !== null) && (Uf(), jf());
  }
}
function Ur(e, t) {
  var n = e.stateNode;
  if (n === null) return null;
  var r = Il(n);
  if (r === null) return null;
  n = r[t];
  e: switch (t) {
    case "onClick":
    case "onClickCapture":
    case "onDoubleClick":
    case "onDoubleClickCapture":
    case "onMouseDown":
    case "onMouseDownCapture":
    case "onMouseMove":
    case "onMouseMoveCapture":
    case "onMouseUp":
    case "onMouseUpCapture":
    case "onMouseEnter":
      (r = !r.disabled) || (e = e.type, r = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !r;
      break e;
    default:
      e = !1;
  }
  if (e) return null;
  if (n && typeof n != "function") throw Error(I(231, t, typeof n));
  return n;
}
var qo = !1;
if (Lt) try {
  var dr = {};
  Object.defineProperty(dr, "passive", { get: function() {
    qo = !0;
  } }), window.addEventListener("test", dr, dr), window.removeEventListener("test", dr, dr);
} catch {
  qo = !1;
}
function mm(e, t, n, r, i, l, o, u, s) {
  var a = Array.prototype.slice.call(arguments, 3);
  try {
    t.apply(n, a);
  } catch (f) {
    this.onError(f);
  }
}
var Pr = !1, Xi = null, Gi = !1, Yo = null, gm = { onError: function(e) {
  Pr = !0, Xi = e;
} };
function ym(e, t, n, r, i, l, o, u, s) {
  Pr = !1, Xi = null, mm.apply(gm, arguments);
}
function km(e, t, n, r, i, l, o, u, s) {
  if (ym.apply(this, arguments), Pr) {
    if (Pr) {
      var a = Xi;
      Pr = !1, Xi = null;
    } else throw Error(I(198));
    Gi || (Gi = !0, Yo = a);
  }
}
function En(e) {
  var t = e, n = e;
  if (e.alternate) for (; t.return; ) t = t.return;
  else {
    e = t;
    do
      t = e, t.flags & 4098 && (n = t.return), e = t.return;
    while (e);
  }
  return t.tag === 3 ? n : null;
}
function Hf(e) {
  if (e.tag === 13) {
    var t = e.memoizedState;
    if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
  }
  return null;
}
function ma(e) {
  if (En(e) !== e) throw Error(I(188));
}
function vm(e) {
  var t = e.alternate;
  if (!t) {
    if (t = En(e), t === null) throw Error(I(188));
    return t !== e ? null : e;
  }
  for (var n = e, r = t; ; ) {
    var i = n.return;
    if (i === null) break;
    var l = i.alternate;
    if (l === null) {
      if (r = i.return, r !== null) {
        n = r;
        continue;
      }
      break;
    }
    if (i.child === l.child) {
      for (l = i.child; l; ) {
        if (l === n) return ma(i), e;
        if (l === r) return ma(i), t;
        l = l.sibling;
      }
      throw Error(I(188));
    }
    if (n.return !== r.return) n = i, r = l;
    else {
      for (var o = !1, u = i.child; u; ) {
        if (u === n) {
          o = !0, n = i, r = l;
          break;
        }
        if (u === r) {
          o = !0, r = i, n = l;
          break;
        }
        u = u.sibling;
      }
      if (!o) {
        for (u = l.child; u; ) {
          if (u === n) {
            o = !0, n = l, r = i;
            break;
          }
          if (u === r) {
            o = !0, r = l, n = i;
            break;
          }
          u = u.sibling;
        }
        if (!o) throw Error(I(189));
      }
    }
    if (n.alternate !== r) throw Error(I(190));
  }
  if (n.tag !== 3) throw Error(I(188));
  return n.stateNode.current === n ? e : t;
}
function Vf(e) {
  return e = vm(e), e !== null ? Wf(e) : null;
}
function Wf(e) {
  if (e.tag === 5 || e.tag === 6) return e;
  for (e = e.child; e !== null; ) {
    var t = Wf(e);
    if (t !== null) return t;
    e = e.sibling;
  }
  return null;
}
var Qf = Ye.unstable_scheduleCallback, ga = Ye.unstable_cancelCallback, xm = Ye.unstable_shouldYield, wm = Ye.unstable_requestPaint, pe = Ye.unstable_now, Sm = Ye.unstable_getCurrentPriorityLevel, Gu = Ye.unstable_ImmediatePriority, Kf = Ye.unstable_UserBlockingPriority, Zi = Ye.unstable_NormalPriority, Cm = Ye.unstable_LowPriority, qf = Ye.unstable_IdlePriority, Cl = null, xt = null;
function Em(e) {
  if (xt && typeof xt.onCommitFiberRoot == "function") try {
    xt.onCommitFiberRoot(Cl, e, void 0, (e.current.flags & 128) === 128);
  } catch {
  }
}
var ft = Math.clz32 ? Math.clz32 : Im, Tm = Math.log, _m = Math.LN2;
function Im(e) {
  return e >>>= 0, e === 0 ? 32 : 31 - (Tm(e) / _m | 0) | 0;
}
var yi = 64, ki = 4194304;
function Tr(e) {
  switch (e & -e) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return e & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return e & 130023424;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 1073741824;
    default:
      return e;
  }
}
function Ji(e, t) {
  var n = e.pendingLanes;
  if (n === 0) return 0;
  var r = 0, i = e.suspendedLanes, l = e.pingedLanes, o = n & 268435455;
  if (o !== 0) {
    var u = o & ~i;
    u !== 0 ? r = Tr(u) : (l &= o, l !== 0 && (r = Tr(l)));
  } else o = n & ~i, o !== 0 ? r = Tr(o) : l !== 0 && (r = Tr(l));
  if (r === 0) return 0;
  if (t !== 0 && t !== r && !(t & i) && (i = r & -r, l = t & -t, i >= l || i === 16 && (l & 4194240) !== 0)) return t;
  if (r & 4 && (r |= n & 16), t = e.entangledLanes, t !== 0) for (e = e.entanglements, t &= r; 0 < t; ) n = 31 - ft(t), i = 1 << n, r |= e[n], t &= ~i;
  return r;
}
function Pm(e, t) {
  switch (e) {
    case 1:
    case 2:
    case 4:
      return t + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return t + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function zm(e, t) {
  for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, l = e.pendingLanes; 0 < l; ) {
    var o = 31 - ft(l), u = 1 << o, s = i[o];
    s === -1 ? (!(u & n) || u & r) && (i[o] = Pm(u, t)) : s <= t && (e.expiredLanes |= u), l &= ~u;
  }
}
function Xo(e) {
  return e = e.pendingLanes & -1073741825, e !== 0 ? e : e & 1073741824 ? 1073741824 : 0;
}
function Yf() {
  var e = yi;
  return yi <<= 1, !(yi & 4194240) && (yi = 64), e;
}
function Xl(e) {
  for (var t = [], n = 0; 31 > n; n++) t.push(e);
  return t;
}
function li(e, t, n) {
  e.pendingLanes |= t, t !== 536870912 && (e.suspendedLanes = 0, e.pingedLanes = 0), e = e.eventTimes, t = 31 - ft(t), e[t] = n;
}
function Lm(e, t) {
  var n = e.pendingLanes & ~t;
  e.pendingLanes = t, e.suspendedLanes = 0, e.pingedLanes = 0, e.expiredLanes &= t, e.mutableReadLanes &= t, e.entangledLanes &= t, t = e.entanglements;
  var r = e.eventTimes;
  for (e = e.expirationTimes; 0 < n; ) {
    var i = 31 - ft(n), l = 1 << i;
    t[i] = 0, r[i] = -1, e[i] = -1, n &= ~l;
  }
}
function Zu(e, t) {
  var n = e.entangledLanes |= t;
  for (e = e.entanglements; n; ) {
    var r = 31 - ft(n), i = 1 << r;
    i & t | e[r] & t && (e[r] |= t), n &= ~i;
  }
}
var X = 0;
function Xf(e) {
  return e &= -e, 1 < e ? 4 < e ? e & 268435455 ? 16 : 536870912 : 4 : 1;
}
var Gf, Ju, Zf, Jf, ep, Go = !1, vi = [], Wt = null, Qt = null, Kt = null, $r = /* @__PURE__ */ new Map(), Hr = /* @__PURE__ */ new Map(), Ut = [], bm = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
function ya(e, t) {
  switch (e) {
    case "focusin":
    case "focusout":
      Wt = null;
      break;
    case "dragenter":
    case "dragleave":
      Qt = null;
      break;
    case "mouseover":
    case "mouseout":
      Kt = null;
      break;
    case "pointerover":
    case "pointerout":
      $r.delete(t.pointerId);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      Hr.delete(t.pointerId);
  }
}
function hr(e, t, n, r, i, l) {
  return e === null || e.nativeEvent !== l ? (e = { blockedOn: t, domEventName: n, eventSystemFlags: r, nativeEvent: l, targetContainers: [i] }, t !== null && (t = ui(t), t !== null && Ju(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
}
function Nm(e, t, n, r, i) {
  switch (t) {
    case "focusin":
      return Wt = hr(Wt, e, t, n, r, i), !0;
    case "dragenter":
      return Qt = hr(Qt, e, t, n, r, i), !0;
    case "mouseover":
      return Kt = hr(Kt, e, t, n, r, i), !0;
    case "pointerover":
      var l = i.pointerId;
      return $r.set(l, hr($r.get(l) || null, e, t, n, r, i)), !0;
    case "gotpointercapture":
      return l = i.pointerId, Hr.set(l, hr(Hr.get(l) || null, e, t, n, r, i)), !0;
  }
  return !1;
}
function tp(e) {
  var t = pn(e.target);
  if (t !== null) {
    var n = En(t);
    if (n !== null) {
      if (t = n.tag, t === 13) {
        if (t = Hf(n), t !== null) {
          e.blockedOn = t, ep(e.priority, function() {
            Zf(n);
          });
          return;
        }
      } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
        e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
        return;
      }
    }
  }
  e.blockedOn = null;
}
function Fi(e) {
  if (e.blockedOn !== null) return !1;
  for (var t = e.targetContainers; 0 < t.length; ) {
    var n = Zo(e.domEventName, e.eventSystemFlags, t[0], e.nativeEvent);
    if (n === null) {
      n = e.nativeEvent;
      var r = new n.constructor(n.type, n);
      Qo = r, n.target.dispatchEvent(r), Qo = null;
    } else return t = ui(n), t !== null && Ju(t), e.blockedOn = n, !1;
    t.shift();
  }
  return !0;
}
function ka(e, t, n) {
  Fi(e) && n.delete(t);
}
function Am() {
  Go = !1, Wt !== null && Fi(Wt) && (Wt = null), Qt !== null && Fi(Qt) && (Qt = null), Kt !== null && Fi(Kt) && (Kt = null), $r.forEach(ka), Hr.forEach(ka);
}
function mr(e, t) {
  e.blockedOn === t && (e.blockedOn = null, Go || (Go = !0, Ye.unstable_scheduleCallback(Ye.unstable_NormalPriority, Am)));
}
function Vr(e) {
  function t(i) {
    return mr(i, e);
  }
  if (0 < vi.length) {
    mr(vi[0], e);
    for (var n = 1; n < vi.length; n++) {
      var r = vi[n];
      r.blockedOn === e && (r.blockedOn = null);
    }
  }
  for (Wt !== null && mr(Wt, e), Qt !== null && mr(Qt, e), Kt !== null && mr(Kt, e), $r.forEach(t), Hr.forEach(t), n = 0; n < Ut.length; n++) r = Ut[n], r.blockedOn === e && (r.blockedOn = null);
  for (; 0 < Ut.length && (n = Ut[0], n.blockedOn === null); ) tp(n), n.blockedOn === null && Ut.shift();
}
var Kn = Dt.ReactCurrentBatchConfig, el = !0;
function Dm(e, t, n, r) {
  var i = X, l = Kn.transition;
  Kn.transition = null;
  try {
    X = 1, es(e, t, n, r);
  } finally {
    X = i, Kn.transition = l;
  }
}
function Rm(e, t, n, r) {
  var i = X, l = Kn.transition;
  Kn.transition = null;
  try {
    X = 4, es(e, t, n, r);
  } finally {
    X = i, Kn.transition = l;
  }
}
function es(e, t, n, r) {
  if (el) {
    var i = Zo(e, t, n, r);
    if (i === null) oo(e, t, r, tl, n), ya(e, r);
    else if (Nm(i, e, t, n, r)) r.stopPropagation();
    else if (ya(e, r), t & 4 && -1 < bm.indexOf(e)) {
      for (; i !== null; ) {
        var l = ui(i);
        if (l !== null && Gf(l), l = Zo(e, t, n, r), l === null && oo(e, t, r, tl, n), l === i) break;
        i = l;
      }
      i !== null && r.stopPropagation();
    } else oo(e, t, r, null, n);
  }
}
var tl = null;
function Zo(e, t, n, r) {
  if (tl = null, e = Xu(r), e = pn(e), e !== null) if (t = En(e), t === null) e = null;
  else if (n = t.tag, n === 13) {
    if (e = Hf(t), e !== null) return e;
    e = null;
  } else if (n === 3) {
    if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
    e = null;
  } else t !== e && (e = null);
  return tl = e, null;
}
function np(e) {
  switch (e) {
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return 1;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return 4;
    case "message":
      switch (Sm()) {
        case Gu:
          return 1;
        case Kf:
          return 4;
        case Zi:
        case Cm:
          return 16;
        case qf:
          return 536870912;
        default:
          return 16;
      }
    default:
      return 16;
  }
}
var Ht = null, ts = null, Oi = null;
function rp() {
  if (Oi) return Oi;
  var e, t = ts, n = t.length, r, i = "value" in Ht ? Ht.value : Ht.textContent, l = i.length;
  for (e = 0; e < n && t[e] === i[e]; e++) ;
  var o = n - e;
  for (r = 1; r <= o && t[n - r] === i[l - r]; r++) ;
  return Oi = i.slice(e, 1 < r ? 1 - r : void 0);
}
function Mi(e) {
  var t = e.keyCode;
  return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
}
function xi() {
  return !0;
}
function va() {
  return !1;
}
function Ge(e) {
  function t(n, r, i, l, o) {
    this._reactName = n, this._targetInst = i, this.type = r, this.nativeEvent = l, this.target = o, this.currentTarget = null;
    for (var u in e) e.hasOwnProperty(u) && (n = e[u], this[u] = n ? n(l) : l[u]);
    return this.isDefaultPrevented = (l.defaultPrevented != null ? l.defaultPrevented : l.returnValue === !1) ? xi : va, this.isPropagationStopped = va, this;
  }
  return ae(t.prototype, { preventDefault: function() {
    this.defaultPrevented = !0;
    var n = this.nativeEvent;
    n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = xi);
  }, stopPropagation: function() {
    var n = this.nativeEvent;
    n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = xi);
  }, persist: function() {
  }, isPersistent: xi }), t;
}
var or = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(e) {
  return e.timeStamp || Date.now();
}, defaultPrevented: 0, isTrusted: 0 }, ns = Ge(or), oi = ae({}, or, { view: 0, detail: 0 }), Fm = Ge(oi), Gl, Zl, gr, El = ae({}, oi, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: rs, button: 0, buttons: 0, relatedTarget: function(e) {
  return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
}, movementX: function(e) {
  return "movementX" in e ? e.movementX : (e !== gr && (gr && e.type === "mousemove" ? (Gl = e.screenX - gr.screenX, Zl = e.screenY - gr.screenY) : Zl = Gl = 0, gr = e), Gl);
}, movementY: function(e) {
  return "movementY" in e ? e.movementY : Zl;
} }), xa = Ge(El), Om = ae({}, El, { dataTransfer: 0 }), Mm = Ge(Om), jm = ae({}, oi, { relatedTarget: 0 }), Jl = Ge(jm), Bm = ae({}, or, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), Um = Ge(Bm), $m = ae({}, or, { clipboardData: function(e) {
  return "clipboardData" in e ? e.clipboardData : window.clipboardData;
} }), Hm = Ge($m), Vm = ae({}, or, { data: 0 }), wa = Ge(Vm), Wm = {
  Esc: "Escape",
  Spacebar: " ",
  Left: "ArrowLeft",
  Up: "ArrowUp",
  Right: "ArrowRight",
  Down: "ArrowDown",
  Del: "Delete",
  Win: "OS",
  Menu: "ContextMenu",
  Apps: "ContextMenu",
  Scroll: "ScrollLock",
  MozPrintableKey: "Unidentified"
}, Qm = {
  8: "Backspace",
  9: "Tab",
  12: "Clear",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  19: "Pause",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  45: "Insert",
  46: "Delete",
  112: "F1",
  113: "F2",
  114: "F3",
  115: "F4",
  116: "F5",
  117: "F6",
  118: "F7",
  119: "F8",
  120: "F9",
  121: "F10",
  122: "F11",
  123: "F12",
  144: "NumLock",
  145: "ScrollLock",
  224: "Meta"
}, Km = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
function qm(e) {
  var t = this.nativeEvent;
  return t.getModifierState ? t.getModifierState(e) : (e = Km[e]) ? !!t[e] : !1;
}
function rs() {
  return qm;
}
var Ym = ae({}, oi, { key: function(e) {
  if (e.key) {
    var t = Wm[e.key] || e.key;
    if (t !== "Unidentified") return t;
  }
  return e.type === "keypress" ? (e = Mi(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? Qm[e.keyCode] || "Unidentified" : "";
}, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: rs, charCode: function(e) {
  return e.type === "keypress" ? Mi(e) : 0;
}, keyCode: function(e) {
  return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
}, which: function(e) {
  return e.type === "keypress" ? Mi(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
} }), Xm = Ge(Ym), Gm = ae({}, El, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), Sa = Ge(Gm), Zm = ae({}, oi, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: rs }), Jm = Ge(Zm), eg = ae({}, or, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), tg = Ge(eg), ng = ae({}, El, {
  deltaX: function(e) {
    return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
  },
  deltaY: function(e) {
    return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
  },
  deltaZ: 0,
  deltaMode: 0
}), rg = Ge(ng), ig = [9, 13, 27, 32], is = Lt && "CompositionEvent" in window, zr = null;
Lt && "documentMode" in document && (zr = document.documentMode);
var lg = Lt && "TextEvent" in window && !zr, ip = Lt && (!is || zr && 8 < zr && 11 >= zr), Ca = " ", Ea = !1;
function lp(e, t) {
  switch (e) {
    case "keyup":
      return ig.indexOf(t.keyCode) !== -1;
    case "keydown":
      return t.keyCode !== 229;
    case "keypress":
    case "mousedown":
    case "focusout":
      return !0;
    default:
      return !1;
  }
}
function op(e) {
  return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
}
var Dn = !1;
function og(e, t) {
  switch (e) {
    case "compositionend":
      return op(t);
    case "keypress":
      return t.which !== 32 ? null : (Ea = !0, Ca);
    case "textInput":
      return e = t.data, e === Ca && Ea ? null : e;
    default:
      return null;
  }
}
function ug(e, t) {
  if (Dn) return e === "compositionend" || !is && lp(e, t) ? (e = rp(), Oi = ts = Ht = null, Dn = !1, e) : null;
  switch (e) {
    case "paste":
      return null;
    case "keypress":
      if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
        if (t.char && 1 < t.char.length) return t.char;
        if (t.which) return String.fromCharCode(t.which);
      }
      return null;
    case "compositionend":
      return ip && t.locale !== "ko" ? null : t.data;
    default:
      return null;
  }
}
var sg = { color: !0, date: !0, datetime: !0, "datetime-local": !0, email: !0, month: !0, number: !0, password: !0, range: !0, search: !0, tel: !0, text: !0, time: !0, url: !0, week: !0 };
function Ta(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return t === "input" ? !!sg[e.type] : t === "textarea";
}
function up(e, t, n, r) {
  Mf(r), t = nl(t, "onChange"), 0 < t.length && (n = new ns("onChange", "change", null, n, r), e.push({ event: n, listeners: t }));
}
var Lr = null, Wr = null;
function ag(e) {
  kp(e, 0);
}
function Tl(e) {
  var t = On(e);
  if (bf(t)) return e;
}
function cg(e, t) {
  if (e === "change") return t;
}
var sp = !1;
if (Lt) {
  var eo;
  if (Lt) {
    var to = "oninput" in document;
    if (!to) {
      var _a = document.createElement("div");
      _a.setAttribute("oninput", "return;"), to = typeof _a.oninput == "function";
    }
    eo = to;
  } else eo = !1;
  sp = eo && (!document.documentMode || 9 < document.documentMode);
}
function Ia() {
  Lr && (Lr.detachEvent("onpropertychange", ap), Wr = Lr = null);
}
function ap(e) {
  if (e.propertyName === "value" && Tl(Wr)) {
    var t = [];
    up(t, Wr, e, Xu(e)), $f(ag, t);
  }
}
function fg(e, t, n) {
  e === "focusin" ? (Ia(), Lr = t, Wr = n, Lr.attachEvent("onpropertychange", ap)) : e === "focusout" && Ia();
}
function pg(e) {
  if (e === "selectionchange" || e === "keyup" || e === "keydown") return Tl(Wr);
}
function dg(e, t) {
  if (e === "click") return Tl(t);
}
function hg(e, t) {
  if (e === "input" || e === "change") return Tl(t);
}
function mg(e, t) {
  return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
}
var ht = typeof Object.is == "function" ? Object.is : mg;
function Qr(e, t) {
  if (ht(e, t)) return !0;
  if (typeof e != "object" || e === null || typeof t != "object" || t === null) return !1;
  var n = Object.keys(e), r = Object.keys(t);
  if (n.length !== r.length) return !1;
  for (r = 0; r < n.length; r++) {
    var i = n[r];
    if (!Do.call(t, i) || !ht(e[i], t[i])) return !1;
  }
  return !0;
}
function Pa(e) {
  for (; e && e.firstChild; ) e = e.firstChild;
  return e;
}
function za(e, t) {
  var n = Pa(e);
  e = 0;
  for (var r; n; ) {
    if (n.nodeType === 3) {
      if (r = e + n.textContent.length, e <= t && r >= t) return { node: n, offset: t - e };
      e = r;
    }
    e: {
      for (; n; ) {
        if (n.nextSibling) {
          n = n.nextSibling;
          break e;
        }
        n = n.parentNode;
      }
      n = void 0;
    }
    n = Pa(n);
  }
}
function cp(e, t) {
  return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? cp(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
}
function fp() {
  for (var e = window, t = Yi(); t instanceof e.HTMLIFrameElement; ) {
    try {
      var n = typeof t.contentWindow.location.href == "string";
    } catch {
      n = !1;
    }
    if (n) e = t.contentWindow;
    else break;
    t = Yi(e.document);
  }
  return t;
}
function ls(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
}
function gg(e) {
  var t = fp(), n = e.focusedElem, r = e.selectionRange;
  if (t !== n && n && n.ownerDocument && cp(n.ownerDocument.documentElement, n)) {
    if (r !== null && ls(n)) {
      if (t = r.start, e = r.end, e === void 0 && (e = t), "selectionStart" in n) n.selectionStart = t, n.selectionEnd = Math.min(e, n.value.length);
      else if (e = (t = n.ownerDocument || document) && t.defaultView || window, e.getSelection) {
        e = e.getSelection();
        var i = n.textContent.length, l = Math.min(r.start, i);
        r = r.end === void 0 ? l : Math.min(r.end, i), !e.extend && l > r && (i = r, r = l, l = i), i = za(n, l);
        var o = za(
          n,
          r
        );
        i && o && (e.rangeCount !== 1 || e.anchorNode !== i.node || e.anchorOffset !== i.offset || e.focusNode !== o.node || e.focusOffset !== o.offset) && (t = t.createRange(), t.setStart(i.node, i.offset), e.removeAllRanges(), l > r ? (e.addRange(t), e.extend(o.node, o.offset)) : (t.setEnd(o.node, o.offset), e.addRange(t)));
      }
    }
    for (t = [], e = n; e = e.parentNode; ) e.nodeType === 1 && t.push({ element: e, left: e.scrollLeft, top: e.scrollTop });
    for (typeof n.focus == "function" && n.focus(), n = 0; n < t.length; n++) e = t[n], e.element.scrollLeft = e.left, e.element.scrollTop = e.top;
  }
}
var yg = Lt && "documentMode" in document && 11 >= document.documentMode, Rn = null, Jo = null, br = null, eu = !1;
function La(e, t, n) {
  var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
  eu || Rn == null || Rn !== Yi(r) || (r = Rn, "selectionStart" in r && ls(r) ? r = { start: r.selectionStart, end: r.selectionEnd } : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = { anchorNode: r.anchorNode, anchorOffset: r.anchorOffset, focusNode: r.focusNode, focusOffset: r.focusOffset }), br && Qr(br, r) || (br = r, r = nl(Jo, "onSelect"), 0 < r.length && (t = new ns("onSelect", "select", null, t, n), e.push({ event: t, listeners: r }), t.target = Rn)));
}
function wi(e, t) {
  var n = {};
  return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
}
var Fn = { animationend: wi("Animation", "AnimationEnd"), animationiteration: wi("Animation", "AnimationIteration"), animationstart: wi("Animation", "AnimationStart"), transitionend: wi("Transition", "TransitionEnd") }, no = {}, pp = {};
Lt && (pp = document.createElement("div").style, "AnimationEvent" in window || (delete Fn.animationend.animation, delete Fn.animationiteration.animation, delete Fn.animationstart.animation), "TransitionEvent" in window || delete Fn.transitionend.transition);
function _l(e) {
  if (no[e]) return no[e];
  if (!Fn[e]) return e;
  var t = Fn[e], n;
  for (n in t) if (t.hasOwnProperty(n) && n in pp) return no[e] = t[n];
  return e;
}
var dp = _l("animationend"), hp = _l("animationiteration"), mp = _l("animationstart"), gp = _l("transitionend"), yp = /* @__PURE__ */ new Map(), ba = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
function tn(e, t) {
  yp.set(e, t), Cn(t, [e]);
}
for (var ro = 0; ro < ba.length; ro++) {
  var io = ba[ro], kg = io.toLowerCase(), vg = io[0].toUpperCase() + io.slice(1);
  tn(kg, "on" + vg);
}
tn(dp, "onAnimationEnd");
tn(hp, "onAnimationIteration");
tn(mp, "onAnimationStart");
tn("dblclick", "onDoubleClick");
tn("focusin", "onFocus");
tn("focusout", "onBlur");
tn(gp, "onTransitionEnd");
Gn("onMouseEnter", ["mouseout", "mouseover"]);
Gn("onMouseLeave", ["mouseout", "mouseover"]);
Gn("onPointerEnter", ["pointerout", "pointerover"]);
Gn("onPointerLeave", ["pointerout", "pointerover"]);
Cn("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
Cn("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
Cn("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
Cn("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
Cn("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
Cn("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
var _r = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), xg = new Set("cancel close invalid load scroll toggle".split(" ").concat(_r));
function Na(e, t, n) {
  var r = e.type || "unknown-event";
  e.currentTarget = n, km(r, t, void 0, e), e.currentTarget = null;
}
function kp(e, t) {
  t = (t & 4) !== 0;
  for (var n = 0; n < e.length; n++) {
    var r = e[n], i = r.event;
    r = r.listeners;
    e: {
      var l = void 0;
      if (t) for (var o = r.length - 1; 0 <= o; o--) {
        var u = r[o], s = u.instance, a = u.currentTarget;
        if (u = u.listener, s !== l && i.isPropagationStopped()) break e;
        Na(i, u, a), l = s;
      }
      else for (o = 0; o < r.length; o++) {
        if (u = r[o], s = u.instance, a = u.currentTarget, u = u.listener, s !== l && i.isPropagationStopped()) break e;
        Na(i, u, a), l = s;
      }
    }
  }
  if (Gi) throw e = Yo, Gi = !1, Yo = null, e;
}
function ie(e, t) {
  var n = t[lu];
  n === void 0 && (n = t[lu] = /* @__PURE__ */ new Set());
  var r = e + "__bubble";
  n.has(r) || (vp(t, e, 2, !1), n.add(r));
}
function lo(e, t, n) {
  var r = 0;
  t && (r |= 4), vp(n, e, r, t);
}
var Si = "_reactListening" + Math.random().toString(36).slice(2);
function Kr(e) {
  if (!e[Si]) {
    e[Si] = !0, _f.forEach(function(n) {
      n !== "selectionchange" && (xg.has(n) || lo(n, !1, e), lo(n, !0, e));
    });
    var t = e.nodeType === 9 ? e : e.ownerDocument;
    t === null || t[Si] || (t[Si] = !0, lo("selectionchange", !1, t));
  }
}
function vp(e, t, n, r) {
  switch (np(t)) {
    case 1:
      var i = Dm;
      break;
    case 4:
      i = Rm;
      break;
    default:
      i = es;
  }
  n = i.bind(null, t, n, e), i = void 0, !qo || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i !== void 0 ? e.addEventListener(t, n, { capture: !0, passive: i }) : e.addEventListener(t, n, !0) : i !== void 0 ? e.addEventListener(t, n, { passive: i }) : e.addEventListener(t, n, !1);
}
function oo(e, t, n, r, i) {
  var l = r;
  if (!(t & 1) && !(t & 2) && r !== null) e: for (; ; ) {
    if (r === null) return;
    var o = r.tag;
    if (o === 3 || o === 4) {
      var u = r.stateNode.containerInfo;
      if (u === i || u.nodeType === 8 && u.parentNode === i) break;
      if (o === 4) for (o = r.return; o !== null; ) {
        var s = o.tag;
        if ((s === 3 || s === 4) && (s = o.stateNode.containerInfo, s === i || s.nodeType === 8 && s.parentNode === i)) return;
        o = o.return;
      }
      for (; u !== null; ) {
        if (o = pn(u), o === null) return;
        if (s = o.tag, s === 5 || s === 6) {
          r = l = o;
          continue e;
        }
        u = u.parentNode;
      }
    }
    r = r.return;
  }
  $f(function() {
    var a = l, f = Xu(n), c = [];
    e: {
      var p = yp.get(e);
      if (p !== void 0) {
        var d = ns, g = e;
        switch (e) {
          case "keypress":
            if (Mi(n) === 0) break e;
          case "keydown":
          case "keyup":
            d = Xm;
            break;
          case "focusin":
            g = "focus", d = Jl;
            break;
          case "focusout":
            g = "blur", d = Jl;
            break;
          case "beforeblur":
          case "afterblur":
            d = Jl;
            break;
          case "click":
            if (n.button === 2) break e;
          case "auxclick":
          case "dblclick":
          case "mousedown":
          case "mousemove":
          case "mouseup":
          case "mouseout":
          case "mouseover":
          case "contextmenu":
            d = xa;
            break;
          case "drag":
          case "dragend":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "dragstart":
          case "drop":
            d = Mm;
            break;
          case "touchcancel":
          case "touchend":
          case "touchmove":
          case "touchstart":
            d = Jm;
            break;
          case dp:
          case hp:
          case mp:
            d = Um;
            break;
          case gp:
            d = tg;
            break;
          case "scroll":
            d = Fm;
            break;
          case "wheel":
            d = rg;
            break;
          case "copy":
          case "cut":
          case "paste":
            d = Hm;
            break;
          case "gotpointercapture":
          case "lostpointercapture":
          case "pointercancel":
          case "pointerdown":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "pointerup":
            d = Sa;
        }
        var x = (t & 4) !== 0, T = !x && e === "scroll", h = x ? p !== null ? p + "Capture" : null : p;
        x = [];
        for (var m = a, y; m !== null; ) {
          y = m;
          var C = y.stateNode;
          if (y.tag === 5 && C !== null && (y = C, h !== null && (C = Ur(m, h), C != null && x.push(qr(m, C, y)))), T) break;
          m = m.return;
        }
        0 < x.length && (p = new d(p, g, null, n, f), c.push({ event: p, listeners: x }));
      }
    }
    if (!(t & 7)) {
      e: {
        if (p = e === "mouseover" || e === "pointerover", d = e === "mouseout" || e === "pointerout", p && n !== Qo && (g = n.relatedTarget || n.fromElement) && (pn(g) || g[bt])) break e;
        if ((d || p) && (p = f.window === f ? f : (p = f.ownerDocument) ? p.defaultView || p.parentWindow : window, d ? (g = n.relatedTarget || n.toElement, d = a, g = g ? pn(g) : null, g !== null && (T = En(g), g !== T || g.tag !== 5 && g.tag !== 6) && (g = null)) : (d = null, g = a), d !== g)) {
          if (x = xa, C = "onMouseLeave", h = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (x = Sa, C = "onPointerLeave", h = "onPointerEnter", m = "pointer"), T = d == null ? p : On(d), y = g == null ? p : On(g), p = new x(C, m + "leave", d, n, f), p.target = T, p.relatedTarget = y, C = null, pn(f) === a && (x = new x(h, m + "enter", g, n, f), x.target = y, x.relatedTarget = T, C = x), T = C, d && g) t: {
            for (x = d, h = g, m = 0, y = x; y; y = zn(y)) m++;
            for (y = 0, C = h; C; C = zn(C)) y++;
            for (; 0 < m - y; ) x = zn(x), m--;
            for (; 0 < y - m; ) h = zn(h), y--;
            for (; m--; ) {
              if (x === h || h !== null && x === h.alternate) break t;
              x = zn(x), h = zn(h);
            }
            x = null;
          }
          else x = null;
          d !== null && Aa(c, p, d, x, !1), g !== null && T !== null && Aa(c, T, g, x, !0);
        }
      }
      e: {
        if (p = a ? On(a) : window, d = p.nodeName && p.nodeName.toLowerCase(), d === "select" || d === "input" && p.type === "file") var _ = cg;
        else if (Ta(p)) if (sp) _ = hg;
        else {
          _ = pg;
          var w = fg;
        }
        else (d = p.nodeName) && d.toLowerCase() === "input" && (p.type === "checkbox" || p.type === "radio") && (_ = dg);
        if (_ && (_ = _(e, a))) {
          up(c, _, n, f);
          break e;
        }
        w && w(e, p, a), e === "focusout" && (w = p._wrapperState) && w.controlled && p.type === "number" && Uo(p, "number", p.value);
      }
      switch (w = a ? On(a) : window, e) {
        case "focusin":
          (Ta(w) || w.contentEditable === "true") && (Rn = w, Jo = a, br = null);
          break;
        case "focusout":
          br = Jo = Rn = null;
          break;
        case "mousedown":
          eu = !0;
          break;
        case "contextmenu":
        case "mouseup":
        case "dragend":
          eu = !1, La(c, n, f);
          break;
        case "selectionchange":
          if (yg) break;
        case "keydown":
        case "keyup":
          La(c, n, f);
      }
      var P;
      if (is) e: {
        switch (e) {
          case "compositionstart":
            var L = "onCompositionStart";
            break e;
          case "compositionend":
            L = "onCompositionEnd";
            break e;
          case "compositionupdate":
            L = "onCompositionUpdate";
            break e;
        }
        L = void 0;
      }
      else Dn ? lp(e, n) && (L = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (L = "onCompositionStart");
      L && (ip && n.locale !== "ko" && (Dn || L !== "onCompositionStart" ? L === "onCompositionEnd" && Dn && (P = rp()) : (Ht = f, ts = "value" in Ht ? Ht.value : Ht.textContent, Dn = !0)), w = nl(a, L), 0 < w.length && (L = new wa(L, e, null, n, f), c.push({ event: L, listeners: w }), P ? L.data = P : (P = op(n), P !== null && (L.data = P)))), (P = lg ? og(e, n) : ug(e, n)) && (a = nl(a, "onBeforeInput"), 0 < a.length && (f = new wa("onBeforeInput", "beforeinput", null, n, f), c.push({ event: f, listeners: a }), f.data = P));
    }
    kp(c, t);
  });
}
function qr(e, t, n) {
  return { instance: e, listener: t, currentTarget: n };
}
function nl(e, t) {
  for (var n = t + "Capture", r = []; e !== null; ) {
    var i = e, l = i.stateNode;
    i.tag === 5 && l !== null && (i = l, l = Ur(e, n), l != null && r.unshift(qr(e, l, i)), l = Ur(e, t), l != null && r.push(qr(e, l, i))), e = e.return;
  }
  return r;
}
function zn(e) {
  if (e === null) return null;
  do
    e = e.return;
  while (e && e.tag !== 5);
  return e || null;
}
function Aa(e, t, n, r, i) {
  for (var l = t._reactName, o = []; n !== null && n !== r; ) {
    var u = n, s = u.alternate, a = u.stateNode;
    if (s !== null && s === r) break;
    u.tag === 5 && a !== null && (u = a, i ? (s = Ur(n, l), s != null && o.unshift(qr(n, s, u))) : i || (s = Ur(n, l), s != null && o.push(qr(n, s, u)))), n = n.return;
  }
  o.length !== 0 && e.push({ event: t, listeners: o });
}
var wg = /\r\n?/g, Sg = /\u0000|\uFFFD/g;
function Da(e) {
  return (typeof e == "string" ? e : "" + e).replace(wg, `
`).replace(Sg, "");
}
function Ci(e, t, n) {
  if (t = Da(t), Da(e) !== t && n) throw Error(I(425));
}
function rl() {
}
var tu = null, nu = null;
function ru(e, t) {
  return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
}
var iu = typeof setTimeout == "function" ? setTimeout : void 0, Cg = typeof clearTimeout == "function" ? clearTimeout : void 0, Ra = typeof Promise == "function" ? Promise : void 0, Eg = typeof queueMicrotask == "function" ? queueMicrotask : typeof Ra != "undefined" ? function(e) {
  return Ra.resolve(null).then(e).catch(Tg);
} : iu;
function Tg(e) {
  setTimeout(function() {
    throw e;
  });
}
function uo(e, t) {
  var n = t, r = 0;
  do {
    var i = n.nextSibling;
    if (e.removeChild(n), i && i.nodeType === 8) if (n = i.data, n === "/$") {
      if (r === 0) {
        e.removeChild(i), Vr(t);
        return;
      }
      r--;
    } else n !== "$" && n !== "$?" && n !== "$!" || r++;
    n = i;
  } while (n);
  Vr(t);
}
function qt(e) {
  for (; e != null; e = e.nextSibling) {
    var t = e.nodeType;
    if (t === 1 || t === 3) break;
    if (t === 8) {
      if (t = e.data, t === "$" || t === "$!" || t === "$?") break;
      if (t === "/$") return null;
    }
  }
  return e;
}
function Fa(e) {
  e = e.previousSibling;
  for (var t = 0; e; ) {
    if (e.nodeType === 8) {
      var n = e.data;
      if (n === "$" || n === "$!" || n === "$?") {
        if (t === 0) return e;
        t--;
      } else n === "/$" && t++;
    }
    e = e.previousSibling;
  }
  return null;
}
var ur = Math.random().toString(36).slice(2), vt = "__reactFiber$" + ur, Yr = "__reactProps$" + ur, bt = "__reactContainer$" + ur, lu = "__reactEvents$" + ur, _g = "__reactListeners$" + ur, Ig = "__reactHandles$" + ur;
function pn(e) {
  var t = e[vt];
  if (t) return t;
  for (var n = e.parentNode; n; ) {
    if (t = n[bt] || n[vt]) {
      if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = Fa(e); e !== null; ) {
        if (n = e[vt]) return n;
        e = Fa(e);
      }
      return t;
    }
    e = n, n = e.parentNode;
  }
  return null;
}
function ui(e) {
  return e = e[vt] || e[bt], !e || e.tag !== 5 && e.tag !== 6 && e.tag !== 13 && e.tag !== 3 ? null : e;
}
function On(e) {
  if (e.tag === 5 || e.tag === 6) return e.stateNode;
  throw Error(I(33));
}
function Il(e) {
  return e[Yr] || null;
}
var ou = [], Mn = -1;
function nn(e) {
  return { current: e };
}
function le(e) {
  0 > Mn || (e.current = ou[Mn], ou[Mn] = null, Mn--);
}
function ne(e, t) {
  Mn++, ou[Mn] = e.current, e.current = t;
}
var en = {}, Pe = nn(en), Me = nn(!1), yn = en;
function Zn(e, t) {
  var n = e.type.contextTypes;
  if (!n) return en;
  var r = e.stateNode;
  if (r && r.__reactInternalMemoizedUnmaskedChildContext === t) return r.__reactInternalMemoizedMaskedChildContext;
  var i = {}, l;
  for (l in n) i[l] = t[l];
  return r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = t, e.__reactInternalMemoizedMaskedChildContext = i), i;
}
function je(e) {
  return e = e.childContextTypes, e != null;
}
function il() {
  le(Me), le(Pe);
}
function Oa(e, t, n) {
  if (Pe.current !== en) throw Error(I(168));
  ne(Pe, t), ne(Me, n);
}
function xp(e, t, n) {
  var r = e.stateNode;
  if (t = t.childContextTypes, typeof r.getChildContext != "function") return n;
  r = r.getChildContext();
  for (var i in r) if (!(i in t)) throw Error(I(108, fm(e) || "Unknown", i));
  return ae({}, n, r);
}
function ll(e) {
  return e = (e = e.stateNode) && e.__reactInternalMemoizedMergedChildContext || en, yn = Pe.current, ne(Pe, e), ne(Me, Me.current), !0;
}
function Ma(e, t, n) {
  var r = e.stateNode;
  if (!r) throw Error(I(169));
  n ? (e = xp(e, t, yn), r.__reactInternalMemoizedMergedChildContext = e, le(Me), le(Pe), ne(Pe, e)) : le(Me), ne(Me, n);
}
var _t = null, Pl = !1, so = !1;
function wp(e) {
  _t === null ? _t = [e] : _t.push(e);
}
function Pg(e) {
  Pl = !0, wp(e);
}
function rn() {
  if (!so && _t !== null) {
    so = !0;
    var e = 0, t = X;
    try {
      var n = _t;
      for (X = 1; e < n.length; e++) {
        var r = n[e];
        do
          r = r(!0);
        while (r !== null);
      }
      _t = null, Pl = !1;
    } catch (i) {
      throw _t !== null && (_t = _t.slice(e + 1)), Qf(Gu, rn), i;
    } finally {
      X = t, so = !1;
    }
  }
  return null;
}
var jn = [], Bn = 0, ol = null, ul = 0, Ze = [], Je = 0, kn = null, It = 1, Pt = "";
function an(e, t) {
  jn[Bn++] = ul, jn[Bn++] = ol, ol = e, ul = t;
}
function Sp(e, t, n) {
  Ze[Je++] = It, Ze[Je++] = Pt, Ze[Je++] = kn, kn = e;
  var r = It;
  e = Pt;
  var i = 32 - ft(r) - 1;
  r &= ~(1 << i), n += 1;
  var l = 32 - ft(t) + i;
  if (30 < l) {
    var o = i - i % 5;
    l = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, It = 1 << 32 - ft(t) + i | n << i | r, Pt = l + e;
  } else It = 1 << l | n << i | r, Pt = e;
}
function os(e) {
  e.return !== null && (an(e, 1), Sp(e, 1, 0));
}
function us(e) {
  for (; e === ol; ) ol = jn[--Bn], jn[Bn] = null, ul = jn[--Bn], jn[Bn] = null;
  for (; e === kn; ) kn = Ze[--Je], Ze[Je] = null, Pt = Ze[--Je], Ze[Je] = null, It = Ze[--Je], Ze[Je] = null;
}
var Ke = null, Qe = null, oe = !1, ct = null;
function Cp(e, t) {
  var n = tt(5, null, null, 0);
  n.elementType = "DELETED", n.stateNode = t, n.return = e, t = e.deletions, t === null ? (e.deletions = [n], e.flags |= 16) : t.push(n);
}
function ja(e, t) {
  switch (e.tag) {
    case 5:
      var n = e.type;
      return t = t.nodeType !== 1 || n.toLowerCase() !== t.nodeName.toLowerCase() ? null : t, t !== null ? (e.stateNode = t, Ke = e, Qe = qt(t.firstChild), !0) : !1;
    case 6:
      return t = e.pendingProps === "" || t.nodeType !== 3 ? null : t, t !== null ? (e.stateNode = t, Ke = e, Qe = null, !0) : !1;
    case 13:
      return t = t.nodeType !== 8 ? null : t, t !== null ? (n = kn !== null ? { id: It, overflow: Pt } : null, e.memoizedState = { dehydrated: t, treeContext: n, retryLane: 1073741824 }, n = tt(18, null, null, 0), n.stateNode = t, n.return = e, e.child = n, Ke = e, Qe = null, !0) : !1;
    default:
      return !1;
  }
}
function uu(e) {
  return (e.mode & 1) !== 0 && (e.flags & 128) === 0;
}
function su(e) {
  if (oe) {
    var t = Qe;
    if (t) {
      var n = t;
      if (!ja(e, t)) {
        if (uu(e)) throw Error(I(418));
        t = qt(n.nextSibling);
        var r = Ke;
        t && ja(e, t) ? Cp(r, n) : (e.flags = e.flags & -4097 | 2, oe = !1, Ke = e);
      }
    } else {
      if (uu(e)) throw Error(I(418));
      e.flags = e.flags & -4097 | 2, oe = !1, Ke = e;
    }
  }
}
function Ba(e) {
  for (e = e.return; e !== null && e.tag !== 5 && e.tag !== 3 && e.tag !== 13; ) e = e.return;
  Ke = e;
}
function Ei(e) {
  if (e !== Ke) return !1;
  if (!oe) return Ba(e), oe = !0, !1;
  var t;
  if ((t = e.tag !== 3) && !(t = e.tag !== 5) && (t = e.type, t = t !== "head" && t !== "body" && !ru(e.type, e.memoizedProps)), t && (t = Qe)) {
    if (uu(e)) throw Ep(), Error(I(418));
    for (; t; ) Cp(e, t), t = qt(t.nextSibling);
  }
  if (Ba(e), e.tag === 13) {
    if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(I(317));
    e: {
      for (e = e.nextSibling, t = 0; e; ) {
        if (e.nodeType === 8) {
          var n = e.data;
          if (n === "/$") {
            if (t === 0) {
              Qe = qt(e.nextSibling);
              break e;
            }
            t--;
          } else n !== "$" && n !== "$!" && n !== "$?" || t++;
        }
        e = e.nextSibling;
      }
      Qe = null;
    }
  } else Qe = Ke ? qt(e.stateNode.nextSibling) : null;
  return !0;
}
function Ep() {
  for (var e = Qe; e; ) e = qt(e.nextSibling);
}
function Jn() {
  Qe = Ke = null, oe = !1;
}
function ss(e) {
  ct === null ? ct = [e] : ct.push(e);
}
var zg = Dt.ReactCurrentBatchConfig;
function yr(e, t, n) {
  if (e = n.ref, e !== null && typeof e != "function" && typeof e != "object") {
    if (n._owner) {
      if (n = n._owner, n) {
        if (n.tag !== 1) throw Error(I(309));
        var r = n.stateNode;
      }
      if (!r) throw Error(I(147, e));
      var i = r, l = "" + e;
      return t !== null && t.ref !== null && typeof t.ref == "function" && t.ref._stringRef === l ? t.ref : (t = function(o) {
        var u = i.refs;
        o === null ? delete u[l] : u[l] = o;
      }, t._stringRef = l, t);
    }
    if (typeof e != "string") throw Error(I(284));
    if (!n._owner) throw Error(I(290, e));
  }
  return e;
}
function Ti(e, t) {
  throw e = Object.prototype.toString.call(t), Error(I(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e));
}
function Ua(e) {
  var t = e._init;
  return t(e._payload);
}
function Tp(e) {
  function t(h, m) {
    if (e) {
      var y = h.deletions;
      y === null ? (h.deletions = [m], h.flags |= 16) : y.push(m);
    }
  }
  function n(h, m) {
    if (!e) return null;
    for (; m !== null; ) t(h, m), m = m.sibling;
    return null;
  }
  function r(h, m) {
    for (h = /* @__PURE__ */ new Map(); m !== null; ) m.key !== null ? h.set(m.key, m) : h.set(m.index, m), m = m.sibling;
    return h;
  }
  function i(h, m) {
    return h = Zt(h, m), h.index = 0, h.sibling = null, h;
  }
  function l(h, m, y) {
    return h.index = y, e ? (y = h.alternate, y !== null ? (y = y.index, y < m ? (h.flags |= 2, m) : y) : (h.flags |= 2, m)) : (h.flags |= 1048576, m);
  }
  function o(h) {
    return e && h.alternate === null && (h.flags |= 2), h;
  }
  function u(h, m, y, C) {
    return m === null || m.tag !== 6 ? (m = go(y, h.mode, C), m.return = h, m) : (m = i(m, y), m.return = h, m);
  }
  function s(h, m, y, C) {
    var _ = y.type;
    return _ === An ? f(h, m, y.props.children, C, y.key) : m !== null && (m.elementType === _ || typeof _ == "object" && _ !== null && _.$$typeof === jt && Ua(_) === m.type) ? (C = i(m, y.props), C.ref = yr(h, m, y), C.return = h, C) : (C = Wi(y.type, y.key, y.props, null, h.mode, C), C.ref = yr(h, m, y), C.return = h, C);
  }
  function a(h, m, y, C) {
    return m === null || m.tag !== 4 || m.stateNode.containerInfo !== y.containerInfo || m.stateNode.implementation !== y.implementation ? (m = yo(y, h.mode, C), m.return = h, m) : (m = i(m, y.children || []), m.return = h, m);
  }
  function f(h, m, y, C, _) {
    return m === null || m.tag !== 7 ? (m = gn(y, h.mode, C, _), m.return = h, m) : (m = i(m, y), m.return = h, m);
  }
  function c(h, m, y) {
    if (typeof m == "string" && m !== "" || typeof m == "number") return m = go("" + m, h.mode, y), m.return = h, m;
    if (typeof m == "object" && m !== null) {
      switch (m.$$typeof) {
        case hi:
          return y = Wi(m.type, m.key, m.props, null, h.mode, y), y.ref = yr(h, null, m), y.return = h, y;
        case Nn:
          return m = yo(m, h.mode, y), m.return = h, m;
        case jt:
          var C = m._init;
          return c(h, C(m._payload), y);
      }
      if (Er(m) || pr(m)) return m = gn(m, h.mode, y, null), m.return = h, m;
      Ti(h, m);
    }
    return null;
  }
  function p(h, m, y, C) {
    var _ = m !== null ? m.key : null;
    if (typeof y == "string" && y !== "" || typeof y == "number") return _ !== null ? null : u(h, m, "" + y, C);
    if (typeof y == "object" && y !== null) {
      switch (y.$$typeof) {
        case hi:
          return y.key === _ ? s(h, m, y, C) : null;
        case Nn:
          return y.key === _ ? a(h, m, y, C) : null;
        case jt:
          return _ = y._init, p(
            h,
            m,
            _(y._payload),
            C
          );
      }
      if (Er(y) || pr(y)) return _ !== null ? null : f(h, m, y, C, null);
      Ti(h, y);
    }
    return null;
  }
  function d(h, m, y, C, _) {
    if (typeof C == "string" && C !== "" || typeof C == "number") return h = h.get(y) || null, u(m, h, "" + C, _);
    if (typeof C == "object" && C !== null) {
      switch (C.$$typeof) {
        case hi:
          return h = h.get(C.key === null ? y : C.key) || null, s(m, h, C, _);
        case Nn:
          return h = h.get(C.key === null ? y : C.key) || null, a(m, h, C, _);
        case jt:
          var w = C._init;
          return d(h, m, y, w(C._payload), _);
      }
      if (Er(C) || pr(C)) return h = h.get(y) || null, f(m, h, C, _, null);
      Ti(m, C);
    }
    return null;
  }
  function g(h, m, y, C) {
    for (var _ = null, w = null, P = m, L = m = 0, M = null; P !== null && L < y.length; L++) {
      P.index > L ? (M = P, P = null) : M = P.sibling;
      var S = p(h, P, y[L], C);
      if (S === null) {
        P === null && (P = M);
        break;
      }
      e && P && S.alternate === null && t(h, P), m = l(S, m, L), w === null ? _ = S : w.sibling = S, w = S, P = M;
    }
    if (L === y.length) return n(h, P), oe && an(h, L), _;
    if (P === null) {
      for (; L < y.length; L++) P = c(h, y[L], C), P !== null && (m = l(P, m, L), w === null ? _ = P : w.sibling = P, w = P);
      return oe && an(h, L), _;
    }
    for (P = r(h, P); L < y.length; L++) M = d(P, h, L, y[L], C), M !== null && (e && M.alternate !== null && P.delete(M.key === null ? L : M.key), m = l(M, m, L), w === null ? _ = M : w.sibling = M, w = M);
    return e && P.forEach(function(A) {
      return t(h, A);
    }), oe && an(h, L), _;
  }
  function x(h, m, y, C) {
    var _ = pr(y);
    if (typeof _ != "function") throw Error(I(150));
    if (y = _.call(y), y == null) throw Error(I(151));
    for (var w = _ = null, P = m, L = m = 0, M = null, S = y.next(); P !== null && !S.done; L++, S = y.next()) {
      P.index > L ? (M = P, P = null) : M = P.sibling;
      var A = p(h, P, S.value, C);
      if (A === null) {
        P === null && (P = M);
        break;
      }
      e && P && A.alternate === null && t(h, P), m = l(A, m, L), w === null ? _ = A : w.sibling = A, w = A, P = M;
    }
    if (S.done) return n(
      h,
      P
    ), oe && an(h, L), _;
    if (P === null) {
      for (; !S.done; L++, S = y.next()) S = c(h, S.value, C), S !== null && (m = l(S, m, L), w === null ? _ = S : w.sibling = S, w = S);
      return oe && an(h, L), _;
    }
    for (P = r(h, P); !S.done; L++, S = y.next()) S = d(P, h, L, S.value, C), S !== null && (e && S.alternate !== null && P.delete(S.key === null ? L : S.key), m = l(S, m, L), w === null ? _ = S : w.sibling = S, w = S);
    return e && P.forEach(function(R) {
      return t(h, R);
    }), oe && an(h, L), _;
  }
  function T(h, m, y, C) {
    if (typeof y == "object" && y !== null && y.type === An && y.key === null && (y = y.props.children), typeof y == "object" && y !== null) {
      switch (y.$$typeof) {
        case hi:
          e: {
            for (var _ = y.key, w = m; w !== null; ) {
              if (w.key === _) {
                if (_ = y.type, _ === An) {
                  if (w.tag === 7) {
                    n(h, w.sibling), m = i(w, y.props.children), m.return = h, h = m;
                    break e;
                  }
                } else if (w.elementType === _ || typeof _ == "object" && _ !== null && _.$$typeof === jt && Ua(_) === w.type) {
                  n(h, w.sibling), m = i(w, y.props), m.ref = yr(h, w, y), m.return = h, h = m;
                  break e;
                }
                n(h, w);
                break;
              } else t(h, w);
              w = w.sibling;
            }
            y.type === An ? (m = gn(y.props.children, h.mode, C, y.key), m.return = h, h = m) : (C = Wi(y.type, y.key, y.props, null, h.mode, C), C.ref = yr(h, m, y), C.return = h, h = C);
          }
          return o(h);
        case Nn:
          e: {
            for (w = y.key; m !== null; ) {
              if (m.key === w) if (m.tag === 4 && m.stateNode.containerInfo === y.containerInfo && m.stateNode.implementation === y.implementation) {
                n(h, m.sibling), m = i(m, y.children || []), m.return = h, h = m;
                break e;
              } else {
                n(h, m);
                break;
              }
              else t(h, m);
              m = m.sibling;
            }
            m = yo(y, h.mode, C), m.return = h, h = m;
          }
          return o(h);
        case jt:
          return w = y._init, T(h, m, w(y._payload), C);
      }
      if (Er(y)) return g(h, m, y, C);
      if (pr(y)) return x(h, m, y, C);
      Ti(h, y);
    }
    return typeof y == "string" && y !== "" || typeof y == "number" ? (y = "" + y, m !== null && m.tag === 6 ? (n(h, m.sibling), m = i(m, y), m.return = h, h = m) : (n(h, m), m = go(y, h.mode, C), m.return = h, h = m), o(h)) : n(h, m);
  }
  return T;
}
var er = Tp(!0), _p = Tp(!1), sl = nn(null), al = null, Un = null, as = null;
function cs() {
  as = Un = al = null;
}
function fs(e) {
  var t = sl.current;
  le(sl), e._currentValue = t;
}
function au(e, t, n) {
  for (; e !== null; ) {
    var r = e.alternate;
    if ((e.childLanes & t) !== t ? (e.childLanes |= t, r !== null && (r.childLanes |= t)) : r !== null && (r.childLanes & t) !== t && (r.childLanes |= t), e === n) break;
    e = e.return;
  }
}
function qn(e, t) {
  al = e, as = Un = null, e = e.dependencies, e !== null && e.firstContext !== null && (e.lanes & t && (Oe = !0), e.firstContext = null);
}
function rt(e) {
  var t = e._currentValue;
  if (as !== e) if (e = { context: e, memoizedValue: t, next: null }, Un === null) {
    if (al === null) throw Error(I(308));
    Un = e, al.dependencies = { lanes: 0, firstContext: e };
  } else Un = Un.next = e;
  return t;
}
var dn = null;
function ps(e) {
  dn === null ? dn = [e] : dn.push(e);
}
function Ip(e, t, n, r) {
  var i = t.interleaved;
  return i === null ? (n.next = n, ps(t)) : (n.next = i.next, i.next = n), t.interleaved = n, Nt(e, r);
}
function Nt(e, t) {
  e.lanes |= t;
  var n = e.alternate;
  for (n !== null && (n.lanes |= t), n = e, e = e.return; e !== null; ) e.childLanes |= t, n = e.alternate, n !== null && (n.childLanes |= t), n = e, e = e.return;
  return n.tag === 3 ? n.stateNode : null;
}
var Bt = !1;
function ds(e) {
  e.updateQueue = { baseState: e.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
}
function Pp(e, t) {
  e = e.updateQueue, t.updateQueue === e && (t.updateQueue = { baseState: e.baseState, firstBaseUpdate: e.firstBaseUpdate, lastBaseUpdate: e.lastBaseUpdate, shared: e.shared, effects: e.effects });
}
function zt(e, t) {
  return { eventTime: e, lane: t, tag: 0, payload: null, callback: null, next: null };
}
function Yt(e, t, n) {
  var r = e.updateQueue;
  if (r === null) return null;
  if (r = r.shared, Y & 2) {
    var i = r.pending;
    return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, Nt(e, n);
  }
  return i = r.interleaved, i === null ? (t.next = t, ps(r)) : (t.next = i.next, i.next = t), r.interleaved = t, Nt(e, n);
}
function ji(e, t, n) {
  if (t = t.updateQueue, t !== null && (t = t.shared, (n & 4194240) !== 0)) {
    var r = t.lanes;
    r &= e.pendingLanes, n |= r, t.lanes = n, Zu(e, n);
  }
}
function $a(e, t) {
  var n = e.updateQueue, r = e.alternate;
  if (r !== null && (r = r.updateQueue, n === r)) {
    var i = null, l = null;
    if (n = n.firstBaseUpdate, n !== null) {
      do {
        var o = { eventTime: n.eventTime, lane: n.lane, tag: n.tag, payload: n.payload, callback: n.callback, next: null };
        l === null ? i = l = o : l = l.next = o, n = n.next;
      } while (n !== null);
      l === null ? i = l = t : l = l.next = t;
    } else i = l = t;
    n = { baseState: r.baseState, firstBaseUpdate: i, lastBaseUpdate: l, shared: r.shared, effects: r.effects }, e.updateQueue = n;
    return;
  }
  e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
}
function cl(e, t, n, r) {
  var i = e.updateQueue;
  Bt = !1;
  var l = i.firstBaseUpdate, o = i.lastBaseUpdate, u = i.shared.pending;
  if (u !== null) {
    i.shared.pending = null;
    var s = u, a = s.next;
    s.next = null, o === null ? l = a : o.next = a, o = s;
    var f = e.alternate;
    f !== null && (f = f.updateQueue, u = f.lastBaseUpdate, u !== o && (u === null ? f.firstBaseUpdate = a : u.next = a, f.lastBaseUpdate = s));
  }
  if (l !== null) {
    var c = i.baseState;
    o = 0, f = a = s = null, u = l;
    do {
      var p = u.lane, d = u.eventTime;
      if ((r & p) === p) {
        f !== null && (f = f.next = {
          eventTime: d,
          lane: 0,
          tag: u.tag,
          payload: u.payload,
          callback: u.callback,
          next: null
        });
        e: {
          var g = e, x = u;
          switch (p = t, d = n, x.tag) {
            case 1:
              if (g = x.payload, typeof g == "function") {
                c = g.call(d, c, p);
                break e;
              }
              c = g;
              break e;
            case 3:
              g.flags = g.flags & -65537 | 128;
            case 0:
              if (g = x.payload, p = typeof g == "function" ? g.call(d, c, p) : g, p == null) break e;
              c = ae({}, c, p);
              break e;
            case 2:
              Bt = !0;
          }
        }
        u.callback !== null && u.lane !== 0 && (e.flags |= 64, p = i.effects, p === null ? i.effects = [u] : p.push(u));
      } else d = { eventTime: d, lane: p, tag: u.tag, payload: u.payload, callback: u.callback, next: null }, f === null ? (a = f = d, s = c) : f = f.next = d, o |= p;
      if (u = u.next, u === null) {
        if (u = i.shared.pending, u === null) break;
        p = u, u = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
      }
    } while (!0);
    if (f === null && (s = c), i.baseState = s, i.firstBaseUpdate = a, i.lastBaseUpdate = f, t = i.shared.interleaved, t !== null) {
      i = t;
      do
        o |= i.lane, i = i.next;
      while (i !== t);
    } else l === null && (i.shared.lanes = 0);
    xn |= o, e.lanes = o, e.memoizedState = c;
  }
}
function Ha(e, t, n) {
  if (e = t.effects, t.effects = null, e !== null) for (t = 0; t < e.length; t++) {
    var r = e[t], i = r.callback;
    if (i !== null) {
      if (r.callback = null, r = n, typeof i != "function") throw Error(I(191, i));
      i.call(r);
    }
  }
}
var si = {}, wt = nn(si), Xr = nn(si), Gr = nn(si);
function hn(e) {
  if (e === si) throw Error(I(174));
  return e;
}
function hs(e, t) {
  switch (ne(Gr, t), ne(Xr, e), ne(wt, si), e = t.nodeType, e) {
    case 9:
    case 11:
      t = (t = t.documentElement) ? t.namespaceURI : Ho(null, "");
      break;
    default:
      e = e === 8 ? t.parentNode : t, t = e.namespaceURI || null, e = e.tagName, t = Ho(t, e);
  }
  le(wt), ne(wt, t);
}
function tr() {
  le(wt), le(Xr), le(Gr);
}
function zp(e) {
  hn(Gr.current);
  var t = hn(wt.current), n = Ho(t, e.type);
  t !== n && (ne(Xr, e), ne(wt, n));
}
function ms(e) {
  Xr.current === e && (le(wt), le(Xr));
}
var ue = nn(0);
function fl(e) {
  for (var t = e; t !== null; ) {
    if (t.tag === 13) {
      var n = t.memoizedState;
      if (n !== null && (n = n.dehydrated, n === null || n.data === "$?" || n.data === "$!")) return t;
    } else if (t.tag === 19 && t.memoizedProps.revealOrder !== void 0) {
      if (t.flags & 128) return t;
    } else if (t.child !== null) {
      t.child.return = t, t = t.child;
      continue;
    }
    if (t === e) break;
    for (; t.sibling === null; ) {
      if (t.return === null || t.return === e) return null;
      t = t.return;
    }
    t.sibling.return = t.return, t = t.sibling;
  }
  return null;
}
var ao = [];
function gs() {
  for (var e = 0; e < ao.length; e++) ao[e]._workInProgressVersionPrimary = null;
  ao.length = 0;
}
var Bi = Dt.ReactCurrentDispatcher, co = Dt.ReactCurrentBatchConfig, vn = 0, se = null, ye = null, ve = null, pl = !1, Nr = !1, Zr = 0, Lg = 0;
function Ee() {
  throw Error(I(321));
}
function ys(e, t) {
  if (t === null) return !1;
  for (var n = 0; n < t.length && n < e.length; n++) if (!ht(e[n], t[n])) return !1;
  return !0;
}
function ks(e, t, n, r, i, l) {
  if (vn = l, se = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, Bi.current = e === null || e.memoizedState === null ? Dg : Rg, e = n(r, i), Nr) {
    l = 0;
    do {
      if (Nr = !1, Zr = 0, 25 <= l) throw Error(I(301));
      l += 1, ve = ye = null, t.updateQueue = null, Bi.current = Fg, e = n(r, i);
    } while (Nr);
  }
  if (Bi.current = dl, t = ye !== null && ye.next !== null, vn = 0, ve = ye = se = null, pl = !1, t) throw Error(I(300));
  return e;
}
function vs() {
  var e = Zr !== 0;
  return Zr = 0, e;
}
function yt() {
  var e = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
  return ve === null ? se.memoizedState = ve = e : ve = ve.next = e, ve;
}
function it() {
  if (ye === null) {
    var e = se.alternate;
    e = e !== null ? e.memoizedState : null;
  } else e = ye.next;
  var t = ve === null ? se.memoizedState : ve.next;
  if (t !== null) ve = t, ye = e;
  else {
    if (e === null) throw Error(I(310));
    ye = e, e = { memoizedState: ye.memoizedState, baseState: ye.baseState, baseQueue: ye.baseQueue, queue: ye.queue, next: null }, ve === null ? se.memoizedState = ve = e : ve = ve.next = e;
  }
  return ve;
}
function Jr(e, t) {
  return typeof t == "function" ? t(e) : t;
}
function fo(e) {
  var t = it(), n = t.queue;
  if (n === null) throw Error(I(311));
  n.lastRenderedReducer = e;
  var r = ye, i = r.baseQueue, l = n.pending;
  if (l !== null) {
    if (i !== null) {
      var o = i.next;
      i.next = l.next, l.next = o;
    }
    r.baseQueue = i = l, n.pending = null;
  }
  if (i !== null) {
    l = i.next, r = r.baseState;
    var u = o = null, s = null, a = l;
    do {
      var f = a.lane;
      if ((vn & f) === f) s !== null && (s = s.next = { lane: 0, action: a.action, hasEagerState: a.hasEagerState, eagerState: a.eagerState, next: null }), r = a.hasEagerState ? a.eagerState : e(r, a.action);
      else {
        var c = {
          lane: f,
          action: a.action,
          hasEagerState: a.hasEagerState,
          eagerState: a.eagerState,
          next: null
        };
        s === null ? (u = s = c, o = r) : s = s.next = c, se.lanes |= f, xn |= f;
      }
      a = a.next;
    } while (a !== null && a !== l);
    s === null ? o = r : s.next = u, ht(r, t.memoizedState) || (Oe = !0), t.memoizedState = r, t.baseState = o, t.baseQueue = s, n.lastRenderedState = r;
  }
  if (e = n.interleaved, e !== null) {
    i = e;
    do
      l = i.lane, se.lanes |= l, xn |= l, i = i.next;
    while (i !== e);
  } else i === null && (n.lanes = 0);
  return [t.memoizedState, n.dispatch];
}
function po(e) {
  var t = it(), n = t.queue;
  if (n === null) throw Error(I(311));
  n.lastRenderedReducer = e;
  var r = n.dispatch, i = n.pending, l = t.memoizedState;
  if (i !== null) {
    n.pending = null;
    var o = i = i.next;
    do
      l = e(l, o.action), o = o.next;
    while (o !== i);
    ht(l, t.memoizedState) || (Oe = !0), t.memoizedState = l, t.baseQueue === null && (t.baseState = l), n.lastRenderedState = l;
  }
  return [l, r];
}
function Lp() {
}
function bp(e, t) {
  var n = se, r = it(), i = t(), l = !ht(r.memoizedState, i);
  if (l && (r.memoizedState = i, Oe = !0), r = r.queue, xs(Dp.bind(null, n, r, e), [e]), r.getSnapshot !== t || l || ve !== null && ve.memoizedState.tag & 1) {
    if (n.flags |= 2048, ei(9, Ap.bind(null, n, r, i, t), void 0, null), xe === null) throw Error(I(349));
    vn & 30 || Np(n, t, i);
  }
  return i;
}
function Np(e, t, n) {
  e.flags |= 16384, e = { getSnapshot: t, value: n }, t = se.updateQueue, t === null ? (t = { lastEffect: null, stores: null }, se.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
}
function Ap(e, t, n, r) {
  t.value = n, t.getSnapshot = r, Rp(t) && Fp(e);
}
function Dp(e, t, n) {
  return n(function() {
    Rp(t) && Fp(e);
  });
}
function Rp(e) {
  var t = e.getSnapshot;
  e = e.value;
  try {
    var n = t();
    return !ht(e, n);
  } catch {
    return !0;
  }
}
function Fp(e) {
  var t = Nt(e, 1);
  t !== null && pt(t, e, 1, -1);
}
function Va(e) {
  var t = yt();
  return typeof e == "function" && (e = e()), t.memoizedState = t.baseState = e, e = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Jr, lastRenderedState: e }, t.queue = e, e = e.dispatch = Ag.bind(null, se, e), [t.memoizedState, e];
}
function ei(e, t, n, r) {
  return e = { tag: e, create: t, destroy: n, deps: r, next: null }, t = se.updateQueue, t === null ? (t = { lastEffect: null, stores: null }, se.updateQueue = t, t.lastEffect = e.next = e) : (n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e)), e;
}
function Op() {
  return it().memoizedState;
}
function Ui(e, t, n, r) {
  var i = yt();
  se.flags |= e, i.memoizedState = ei(1 | t, n, void 0, r === void 0 ? null : r);
}
function zl(e, t, n, r) {
  var i = it();
  r = r === void 0 ? null : r;
  var l = void 0;
  if (ye !== null) {
    var o = ye.memoizedState;
    if (l = o.destroy, r !== null && ys(r, o.deps)) {
      i.memoizedState = ei(t, n, l, r);
      return;
    }
  }
  se.flags |= e, i.memoizedState = ei(1 | t, n, l, r);
}
function Wa(e, t) {
  return Ui(8390656, 8, e, t);
}
function xs(e, t) {
  return zl(2048, 8, e, t);
}
function Mp(e, t) {
  return zl(4, 2, e, t);
}
function jp(e, t) {
  return zl(4, 4, e, t);
}
function Bp(e, t) {
  if (typeof t == "function") return e = e(), t(e), function() {
    t(null);
  };
  if (t != null) return e = e(), t.current = e, function() {
    t.current = null;
  };
}
function Up(e, t, n) {
  return n = n != null ? n.concat([e]) : null, zl(4, 4, Bp.bind(null, t, e), n);
}
function ws() {
}
function $p(e, t) {
  var n = it();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && ys(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
}
function Hp(e, t) {
  var n = it();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && ys(t, r[1]) ? r[0] : (e = e(), n.memoizedState = [e, t], e);
}
function Vp(e, t, n) {
  return vn & 21 ? (ht(n, t) || (n = Yf(), se.lanes |= n, xn |= n, e.baseState = !0), t) : (e.baseState && (e.baseState = !1, Oe = !0), e.memoizedState = n);
}
function bg(e, t) {
  var n = X;
  X = n !== 0 && 4 > n ? n : 4, e(!0);
  var r = co.transition;
  co.transition = {};
  try {
    e(!1), t();
  } finally {
    X = n, co.transition = r;
  }
}
function Wp() {
  return it().memoizedState;
}
function Ng(e, t, n) {
  var r = Gt(e);
  if (n = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null }, Qp(e)) Kp(t, n);
  else if (n = Ip(e, t, n, r), n !== null) {
    var i = Ne();
    pt(n, e, r, i), qp(n, t, r);
  }
}
function Ag(e, t, n) {
  var r = Gt(e), i = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null };
  if (Qp(e)) Kp(t, i);
  else {
    var l = e.alternate;
    if (e.lanes === 0 && (l === null || l.lanes === 0) && (l = t.lastRenderedReducer, l !== null)) try {
      var o = t.lastRenderedState, u = l(o, n);
      if (i.hasEagerState = !0, i.eagerState = u, ht(u, o)) {
        var s = t.interleaved;
        s === null ? (i.next = i, ps(t)) : (i.next = s.next, s.next = i), t.interleaved = i;
        return;
      }
    } catch {
    } finally {
    }
    n = Ip(e, t, i, r), n !== null && (i = Ne(), pt(n, e, r, i), qp(n, t, r));
  }
}
function Qp(e) {
  var t = e.alternate;
  return e === se || t !== null && t === se;
}
function Kp(e, t) {
  Nr = pl = !0;
  var n = e.pending;
  n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
}
function qp(e, t, n) {
  if (n & 4194240) {
    var r = t.lanes;
    r &= e.pendingLanes, n |= r, t.lanes = n, Zu(e, n);
  }
}
var dl = { readContext: rt, useCallback: Ee, useContext: Ee, useEffect: Ee, useImperativeHandle: Ee, useInsertionEffect: Ee, useLayoutEffect: Ee, useMemo: Ee, useReducer: Ee, useRef: Ee, useState: Ee, useDebugValue: Ee, useDeferredValue: Ee, useTransition: Ee, useMutableSource: Ee, useSyncExternalStore: Ee, useId: Ee, unstable_isNewReconciler: !1 }, Dg = { readContext: rt, useCallback: function(e, t) {
  return yt().memoizedState = [e, t === void 0 ? null : t], e;
}, useContext: rt, useEffect: Wa, useImperativeHandle: function(e, t, n) {
  return n = n != null ? n.concat([e]) : null, Ui(
    4194308,
    4,
    Bp.bind(null, t, e),
    n
  );
}, useLayoutEffect: function(e, t) {
  return Ui(4194308, 4, e, t);
}, useInsertionEffect: function(e, t) {
  return Ui(4, 2, e, t);
}, useMemo: function(e, t) {
  var n = yt();
  return t = t === void 0 ? null : t, e = e(), n.memoizedState = [e, t], e;
}, useReducer: function(e, t, n) {
  var r = yt();
  return t = n !== void 0 ? n(t) : t, r.memoizedState = r.baseState = t, e = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: e, lastRenderedState: t }, r.queue = e, e = e.dispatch = Ng.bind(null, se, e), [r.memoizedState, e];
}, useRef: function(e) {
  var t = yt();
  return e = { current: e }, t.memoizedState = e;
}, useState: Va, useDebugValue: ws, useDeferredValue: function(e) {
  return yt().memoizedState = e;
}, useTransition: function() {
  var e = Va(!1), t = e[0];
  return e = bg.bind(null, e[1]), yt().memoizedState = e, [t, e];
}, useMutableSource: function() {
}, useSyncExternalStore: function(e, t, n) {
  var r = se, i = yt();
  if (oe) {
    if (n === void 0) throw Error(I(407));
    n = n();
  } else {
    if (n = t(), xe === null) throw Error(I(349));
    vn & 30 || Np(r, t, n);
  }
  i.memoizedState = n;
  var l = { value: n, getSnapshot: t };
  return i.queue = l, Wa(Dp.bind(
    null,
    r,
    l,
    e
  ), [e]), r.flags |= 2048, ei(9, Ap.bind(null, r, l, n, t), void 0, null), n;
}, useId: function() {
  var e = yt(), t = xe.identifierPrefix;
  if (oe) {
    var n = Pt, r = It;
    n = (r & ~(1 << 32 - ft(r) - 1)).toString(32) + n, t = ":" + t + "R" + n, n = Zr++, 0 < n && (t += "H" + n.toString(32)), t += ":";
  } else n = Lg++, t = ":" + t + "r" + n.toString(32) + ":";
  return e.memoizedState = t;
}, unstable_isNewReconciler: !1 }, Rg = {
  readContext: rt,
  useCallback: $p,
  useContext: rt,
  useEffect: xs,
  useImperativeHandle: Up,
  useInsertionEffect: Mp,
  useLayoutEffect: jp,
  useMemo: Hp,
  useReducer: fo,
  useRef: Op,
  useState: function() {
    return fo(Jr);
  },
  useDebugValue: ws,
  useDeferredValue: function(e) {
    var t = it();
    return Vp(t, ye.memoizedState, e);
  },
  useTransition: function() {
    var e = fo(Jr)[0], t = it().memoizedState;
    return [e, t];
  },
  useMutableSource: Lp,
  useSyncExternalStore: bp,
  useId: Wp,
  unstable_isNewReconciler: !1
}, Fg = { readContext: rt, useCallback: $p, useContext: rt, useEffect: xs, useImperativeHandle: Up, useInsertionEffect: Mp, useLayoutEffect: jp, useMemo: Hp, useReducer: po, useRef: Op, useState: function() {
  return po(Jr);
}, useDebugValue: ws, useDeferredValue: function(e) {
  var t = it();
  return ye === null ? t.memoizedState = e : Vp(t, ye.memoizedState, e);
}, useTransition: function() {
  var e = po(Jr)[0], t = it().memoizedState;
  return [e, t];
}, useMutableSource: Lp, useSyncExternalStore: bp, useId: Wp, unstable_isNewReconciler: !1 };
function st(e, t) {
  if (e && e.defaultProps) {
    t = ae({}, t), e = e.defaultProps;
    for (var n in e) t[n] === void 0 && (t[n] = e[n]);
    return t;
  }
  return t;
}
function cu(e, t, n, r) {
  t = e.memoizedState, n = n(r, t), n = n == null ? t : ae({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
}
var Ll = { isMounted: function(e) {
  return (e = e._reactInternals) ? En(e) === e : !1;
}, enqueueSetState: function(e, t, n) {
  e = e._reactInternals;
  var r = Ne(), i = Gt(e), l = zt(r, i);
  l.payload = t, n != null && (l.callback = n), t = Yt(e, l, i), t !== null && (pt(t, e, i, r), ji(t, e, i));
}, enqueueReplaceState: function(e, t, n) {
  e = e._reactInternals;
  var r = Ne(), i = Gt(e), l = zt(r, i);
  l.tag = 1, l.payload = t, n != null && (l.callback = n), t = Yt(e, l, i), t !== null && (pt(t, e, i, r), ji(t, e, i));
}, enqueueForceUpdate: function(e, t) {
  e = e._reactInternals;
  var n = Ne(), r = Gt(e), i = zt(n, r);
  i.tag = 2, t != null && (i.callback = t), t = Yt(e, i, r), t !== null && (pt(t, e, r, n), ji(t, e, r));
} };
function Qa(e, t, n, r, i, l, o) {
  return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, l, o) : t.prototype && t.prototype.isPureReactComponent ? !Qr(n, r) || !Qr(i, l) : !0;
}
function Yp(e, t, n) {
  var r = !1, i = en, l = t.contextType;
  return typeof l == "object" && l !== null ? l = rt(l) : (i = je(t) ? yn : Pe.current, r = t.contextTypes, l = (r = r != null) ? Zn(e, i) : en), t = new t(n, l), e.memoizedState = t.state !== null && t.state !== void 0 ? t.state : null, t.updater = Ll, e.stateNode = t, t._reactInternals = e, r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = i, e.__reactInternalMemoizedMaskedChildContext = l), t;
}
function Ka(e, t, n, r) {
  e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && Ll.enqueueReplaceState(t, t.state, null);
}
function fu(e, t, n, r) {
  var i = e.stateNode;
  i.props = n, i.state = e.memoizedState, i.refs = {}, ds(e);
  var l = t.contextType;
  typeof l == "object" && l !== null ? i.context = rt(l) : (l = je(t) ? yn : Pe.current, i.context = Zn(e, l)), i.state = e.memoizedState, l = t.getDerivedStateFromProps, typeof l == "function" && (cu(e, t, l, n), i.state = e.memoizedState), typeof t.getDerivedStateFromProps == "function" || typeof i.getSnapshotBeforeUpdate == "function" || typeof i.UNSAFE_componentWillMount != "function" && typeof i.componentWillMount != "function" || (t = i.state, typeof i.componentWillMount == "function" && i.componentWillMount(), typeof i.UNSAFE_componentWillMount == "function" && i.UNSAFE_componentWillMount(), t !== i.state && Ll.enqueueReplaceState(i, i.state, null), cl(e, n, i, r), i.state = e.memoizedState), typeof i.componentDidMount == "function" && (e.flags |= 4194308);
}
function nr(e, t) {
  try {
    var n = "", r = t;
    do
      n += cm(r), r = r.return;
    while (r);
    var i = n;
  } catch (l) {
    i = `
Error generating stack: ` + l.message + `
` + l.stack;
  }
  return { value: e, source: t, stack: i, digest: null };
}
function ho(e, t, n) {
  return { value: e, source: null, stack: n != null ? n : null, digest: t != null ? t : null };
}
function pu(e, t) {
  try {
    console.error(t.value);
  } catch (n) {
    setTimeout(function() {
      throw n;
    });
  }
}
var Og = typeof WeakMap == "function" ? WeakMap : Map;
function Xp(e, t, n) {
  n = zt(-1, n), n.tag = 3, n.payload = { element: null };
  var r = t.value;
  return n.callback = function() {
    ml || (ml = !0, Su = r), pu(e, t);
  }, n;
}
function Gp(e, t, n) {
  n = zt(-1, n), n.tag = 3;
  var r = e.type.getDerivedStateFromError;
  if (typeof r == "function") {
    var i = t.value;
    n.payload = function() {
      return r(i);
    }, n.callback = function() {
      pu(e, t);
    };
  }
  var l = e.stateNode;
  return l !== null && typeof l.componentDidCatch == "function" && (n.callback = function() {
    pu(e, t), typeof r != "function" && (Xt === null ? Xt = /* @__PURE__ */ new Set([this]) : Xt.add(this));
    var o = t.stack;
    this.componentDidCatch(t.value, { componentStack: o !== null ? o : "" });
  }), n;
}
function qa(e, t, n) {
  var r = e.pingCache;
  if (r === null) {
    r = e.pingCache = new Og();
    var i = /* @__PURE__ */ new Set();
    r.set(t, i);
  } else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
  i.has(n) || (i.add(n), e = Gg.bind(null, e, t, n), t.then(e, e));
}
function Ya(e) {
  do {
    var t;
    if ((t = e.tag === 13) && (t = e.memoizedState, t = t !== null ? t.dehydrated !== null : !0), t) return e;
    e = e.return;
  } while (e !== null);
  return null;
}
function Xa(e, t, n, r, i) {
  return e.mode & 1 ? (e.flags |= 65536, e.lanes = i, e) : (e === t ? e.flags |= 65536 : (e.flags |= 128, n.flags |= 131072, n.flags &= -52805, n.tag === 1 && (n.alternate === null ? n.tag = 17 : (t = zt(-1, 1), t.tag = 2, Yt(n, t, 1))), n.lanes |= 1), e);
}
var Mg = Dt.ReactCurrentOwner, Oe = !1;
function Le(e, t, n, r) {
  t.child = e === null ? _p(t, null, n, r) : er(t, e.child, n, r);
}
function Ga(e, t, n, r, i) {
  n = n.render;
  var l = t.ref;
  return qn(t, i), r = ks(e, t, n, r, l, i), n = vs(), e !== null && !Oe ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~i, At(e, t, i)) : (oe && n && os(t), t.flags |= 1, Le(e, t, r, i), t.child);
}
function Za(e, t, n, r, i) {
  if (e === null) {
    var l = n.type;
    return typeof l == "function" && !zs(l) && l.defaultProps === void 0 && n.compare === null && n.defaultProps === void 0 ? (t.tag = 15, t.type = l, Zp(e, t, l, r, i)) : (e = Wi(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
  }
  if (l = e.child, !(e.lanes & i)) {
    var o = l.memoizedProps;
    if (n = n.compare, n = n !== null ? n : Qr, n(o, r) && e.ref === t.ref) return At(e, t, i);
  }
  return t.flags |= 1, e = Zt(l, r), e.ref = t.ref, e.return = t, t.child = e;
}
function Zp(e, t, n, r, i) {
  if (e !== null) {
    var l = e.memoizedProps;
    if (Qr(l, r) && e.ref === t.ref) if (Oe = !1, t.pendingProps = r = l, (e.lanes & i) !== 0) e.flags & 131072 && (Oe = !0);
    else return t.lanes = e.lanes, At(e, t, i);
  }
  return du(e, t, n, r, i);
}
function Jp(e, t, n) {
  var r = t.pendingProps, i = r.children, l = e !== null ? e.memoizedState : null;
  if (r.mode === "hidden") if (!(t.mode & 1)) t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, ne(Hn, We), We |= n;
  else {
    if (!(n & 1073741824)) return e = l !== null ? l.baseLanes | n : n, t.lanes = t.childLanes = 1073741824, t.memoizedState = { baseLanes: e, cachePool: null, transitions: null }, t.updateQueue = null, ne(Hn, We), We |= e, null;
    t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, r = l !== null ? l.baseLanes : n, ne(Hn, We), We |= r;
  }
  else l !== null ? (r = l.baseLanes | n, t.memoizedState = null) : r = n, ne(Hn, We), We |= r;
  return Le(e, t, i, n), t.child;
}
function ed(e, t) {
  var n = t.ref;
  (e === null && n !== null || e !== null && e.ref !== n) && (t.flags |= 512, t.flags |= 2097152);
}
function du(e, t, n, r, i) {
  var l = je(n) ? yn : Pe.current;
  return l = Zn(t, l), qn(t, i), n = ks(e, t, n, r, l, i), r = vs(), e !== null && !Oe ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~i, At(e, t, i)) : (oe && r && os(t), t.flags |= 1, Le(e, t, n, i), t.child);
}
function Ja(e, t, n, r, i) {
  if (je(n)) {
    var l = !0;
    ll(t);
  } else l = !1;
  if (qn(t, i), t.stateNode === null) $i(e, t), Yp(t, n, r), fu(t, n, r, i), r = !0;
  else if (e === null) {
    var o = t.stateNode, u = t.memoizedProps;
    o.props = u;
    var s = o.context, a = n.contextType;
    typeof a == "object" && a !== null ? a = rt(a) : (a = je(n) ? yn : Pe.current, a = Zn(t, a));
    var f = n.getDerivedStateFromProps, c = typeof f == "function" || typeof o.getSnapshotBeforeUpdate == "function";
    c || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (u !== r || s !== a) && Ka(t, o, r, a), Bt = !1;
    var p = t.memoizedState;
    o.state = p, cl(t, r, o, i), s = t.memoizedState, u !== r || p !== s || Me.current || Bt ? (typeof f == "function" && (cu(t, n, f, r), s = t.memoizedState), (u = Bt || Qa(t, n, u, r, p, s, a)) ? (c || typeof o.UNSAFE_componentWillMount != "function" && typeof o.componentWillMount != "function" || (typeof o.componentWillMount == "function" && o.componentWillMount(), typeof o.UNSAFE_componentWillMount == "function" && o.UNSAFE_componentWillMount()), typeof o.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof o.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = s), o.props = r, o.state = s, o.context = a, r = u) : (typeof o.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
  } else {
    o = t.stateNode, Pp(e, t), u = t.memoizedProps, a = t.type === t.elementType ? u : st(t.type, u), o.props = a, c = t.pendingProps, p = o.context, s = n.contextType, typeof s == "object" && s !== null ? s = rt(s) : (s = je(n) ? yn : Pe.current, s = Zn(t, s));
    var d = n.getDerivedStateFromProps;
    (f = typeof d == "function" || typeof o.getSnapshotBeforeUpdate == "function") || typeof o.UNSAFE_componentWillReceiveProps != "function" && typeof o.componentWillReceiveProps != "function" || (u !== c || p !== s) && Ka(t, o, r, s), Bt = !1, p = t.memoizedState, o.state = p, cl(t, r, o, i);
    var g = t.memoizedState;
    u !== c || p !== g || Me.current || Bt ? (typeof d == "function" && (cu(t, n, d, r), g = t.memoizedState), (a = Bt || Qa(t, n, a, r, p, g, s) || !1) ? (f || typeof o.UNSAFE_componentWillUpdate != "function" && typeof o.componentWillUpdate != "function" || (typeof o.componentWillUpdate == "function" && o.componentWillUpdate(r, g, s), typeof o.UNSAFE_componentWillUpdate == "function" && o.UNSAFE_componentWillUpdate(r, g, s)), typeof o.componentDidUpdate == "function" && (t.flags |= 4), typeof o.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof o.componentDidUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = g), o.props = r, o.state = g, o.context = s, r = a) : (typeof o.componentDidUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof o.getSnapshotBeforeUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), r = !1);
  }
  return hu(e, t, n, r, l, i);
}
function hu(e, t, n, r, i, l) {
  ed(e, t);
  var o = (t.flags & 128) !== 0;
  if (!r && !o) return i && Ma(t, n, !1), At(e, t, l);
  r = t.stateNode, Mg.current = t;
  var u = o && typeof n.getDerivedStateFromError != "function" ? null : r.render();
  return t.flags |= 1, e !== null && o ? (t.child = er(t, e.child, null, l), t.child = er(t, null, u, l)) : Le(e, t, u, l), t.memoizedState = r.state, i && Ma(t, n, !0), t.child;
}
function td(e) {
  var t = e.stateNode;
  t.pendingContext ? Oa(e, t.pendingContext, t.pendingContext !== t.context) : t.context && Oa(e, t.context, !1), hs(e, t.containerInfo);
}
function ec(e, t, n, r, i) {
  return Jn(), ss(i), t.flags |= 256, Le(e, t, n, r), t.child;
}
var mu = { dehydrated: null, treeContext: null, retryLane: 0 };
function gu(e) {
  return { baseLanes: e, cachePool: null, transitions: null };
}
function nd(e, t, n) {
  var r = t.pendingProps, i = ue.current, l = !1, o = (t.flags & 128) !== 0, u;
  if ((u = o) || (u = e !== null && e.memoizedState === null ? !1 : (i & 2) !== 0), u ? (l = !0, t.flags &= -129) : (e === null || e.memoizedState !== null) && (i |= 1), ne(ue, i & 1), e === null)
    return su(t), e = t.memoizedState, e !== null && (e = e.dehydrated, e !== null) ? (t.mode & 1 ? e.data === "$!" ? t.lanes = 8 : t.lanes = 1073741824 : t.lanes = 1, null) : (o = r.children, e = r.fallback, l ? (r = t.mode, l = t.child, o = { mode: "hidden", children: o }, !(r & 1) && l !== null ? (l.childLanes = 0, l.pendingProps = o) : l = Al(o, r, 0, null), e = gn(e, r, n, null), l.return = t, e.return = t, l.sibling = e, t.child = l, t.child.memoizedState = gu(n), t.memoizedState = mu, e) : Ss(t, o));
  if (i = e.memoizedState, i !== null && (u = i.dehydrated, u !== null)) return jg(e, t, o, r, u, i, n);
  if (l) {
    l = r.fallback, o = t.mode, i = e.child, u = i.sibling;
    var s = { mode: "hidden", children: r.children };
    return !(o & 1) && t.child !== i ? (r = t.child, r.childLanes = 0, r.pendingProps = s, t.deletions = null) : (r = Zt(i, s), r.subtreeFlags = i.subtreeFlags & 14680064), u !== null ? l = Zt(u, l) : (l = gn(l, o, n, null), l.flags |= 2), l.return = t, r.return = t, r.sibling = l, t.child = r, r = l, l = t.child, o = e.child.memoizedState, o = o === null ? gu(n) : { baseLanes: o.baseLanes | n, cachePool: null, transitions: o.transitions }, l.memoizedState = o, l.childLanes = e.childLanes & ~n, t.memoizedState = mu, r;
  }
  return l = e.child, e = l.sibling, r = Zt(l, { mode: "visible", children: r.children }), !(t.mode & 1) && (r.lanes = n), r.return = t, r.sibling = null, e !== null && (n = t.deletions, n === null ? (t.deletions = [e], t.flags |= 16) : n.push(e)), t.child = r, t.memoizedState = null, r;
}
function Ss(e, t) {
  return t = Al({ mode: "visible", children: t }, e.mode, 0, null), t.return = e, e.child = t;
}
function _i(e, t, n, r) {
  return r !== null && ss(r), er(t, e.child, null, n), e = Ss(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
}
function jg(e, t, n, r, i, l, o) {
  if (n)
    return t.flags & 256 ? (t.flags &= -257, r = ho(Error(I(422))), _i(e, t, o, r)) : t.memoizedState !== null ? (t.child = e.child, t.flags |= 128, null) : (l = r.fallback, i = t.mode, r = Al({ mode: "visible", children: r.children }, i, 0, null), l = gn(l, i, o, null), l.flags |= 2, r.return = t, l.return = t, r.sibling = l, t.child = r, t.mode & 1 && er(t, e.child, null, o), t.child.memoizedState = gu(o), t.memoizedState = mu, l);
  if (!(t.mode & 1)) return _i(e, t, o, null);
  if (i.data === "$!") {
    if (r = i.nextSibling && i.nextSibling.dataset, r) var u = r.dgst;
    return r = u, l = Error(I(419)), r = ho(l, r, void 0), _i(e, t, o, r);
  }
  if (u = (o & e.childLanes) !== 0, Oe || u) {
    if (r = xe, r !== null) {
      switch (o & -o) {
        case 4:
          i = 2;
          break;
        case 16:
          i = 8;
          break;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          i = 32;
          break;
        case 536870912:
          i = 268435456;
          break;
        default:
          i = 0;
      }
      i = i & (r.suspendedLanes | o) ? 0 : i, i !== 0 && i !== l.retryLane && (l.retryLane = i, Nt(e, i), pt(r, e, i, -1));
    }
    return Ps(), r = ho(Error(I(421))), _i(e, t, o, r);
  }
  return i.data === "$?" ? (t.flags |= 128, t.child = e.child, t = Zg.bind(null, e), i._reactRetry = t, null) : (e = l.treeContext, Qe = qt(i.nextSibling), Ke = t, oe = !0, ct = null, e !== null && (Ze[Je++] = It, Ze[Je++] = Pt, Ze[Je++] = kn, It = e.id, Pt = e.overflow, kn = t), t = Ss(t, r.children), t.flags |= 4096, t);
}
function tc(e, t, n) {
  e.lanes |= t;
  var r = e.alternate;
  r !== null && (r.lanes |= t), au(e.return, t, n);
}
function mo(e, t, n, r, i) {
  var l = e.memoizedState;
  l === null ? e.memoizedState = { isBackwards: t, rendering: null, renderingStartTime: 0, last: r, tail: n, tailMode: i } : (l.isBackwards = t, l.rendering = null, l.renderingStartTime = 0, l.last = r, l.tail = n, l.tailMode = i);
}
function rd(e, t, n) {
  var r = t.pendingProps, i = r.revealOrder, l = r.tail;
  if (Le(e, t, r.children, n), r = ue.current, r & 2) r = r & 1 | 2, t.flags |= 128;
  else {
    if (e !== null && e.flags & 128) e: for (e = t.child; e !== null; ) {
      if (e.tag === 13) e.memoizedState !== null && tc(e, n, t);
      else if (e.tag === 19) tc(e, n, t);
      else if (e.child !== null) {
        e.child.return = e, e = e.child;
        continue;
      }
      if (e === t) break e;
      for (; e.sibling === null; ) {
        if (e.return === null || e.return === t) break e;
        e = e.return;
      }
      e.sibling.return = e.return, e = e.sibling;
    }
    r &= 1;
  }
  if (ne(ue, r), !(t.mode & 1)) t.memoizedState = null;
  else switch (i) {
    case "forwards":
      for (n = t.child, i = null; n !== null; ) e = n.alternate, e !== null && fl(e) === null && (i = n), n = n.sibling;
      n = i, n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), mo(t, !1, i, n, l);
      break;
    case "backwards":
      for (n = null, i = t.child, t.child = null; i !== null; ) {
        if (e = i.alternate, e !== null && fl(e) === null) {
          t.child = i;
          break;
        }
        e = i.sibling, i.sibling = n, n = i, i = e;
      }
      mo(t, !0, n, null, l);
      break;
    case "together":
      mo(t, !1, null, null, void 0);
      break;
    default:
      t.memoizedState = null;
  }
  return t.child;
}
function $i(e, t) {
  !(t.mode & 1) && e !== null && (e.alternate = null, t.alternate = null, t.flags |= 2);
}
function At(e, t, n) {
  if (e !== null && (t.dependencies = e.dependencies), xn |= t.lanes, !(n & t.childLanes)) return null;
  if (e !== null && t.child !== e.child) throw Error(I(153));
  if (t.child !== null) {
    for (e = t.child, n = Zt(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null; ) e = e.sibling, n = n.sibling = Zt(e, e.pendingProps), n.return = t;
    n.sibling = null;
  }
  return t.child;
}
function Bg(e, t, n) {
  switch (t.tag) {
    case 3:
      td(t), Jn();
      break;
    case 5:
      zp(t);
      break;
    case 1:
      je(t.type) && ll(t);
      break;
    case 4:
      hs(t, t.stateNode.containerInfo);
      break;
    case 10:
      var r = t.type._context, i = t.memoizedProps.value;
      ne(sl, r._currentValue), r._currentValue = i;
      break;
    case 13:
      if (r = t.memoizedState, r !== null)
        return r.dehydrated !== null ? (ne(ue, ue.current & 1), t.flags |= 128, null) : n & t.child.childLanes ? nd(e, t, n) : (ne(ue, ue.current & 1), e = At(e, t, n), e !== null ? e.sibling : null);
      ne(ue, ue.current & 1);
      break;
    case 19:
      if (r = (n & t.childLanes) !== 0, e.flags & 128) {
        if (r) return rd(e, t, n);
        t.flags |= 128;
      }
      if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), ne(ue, ue.current), r) break;
      return null;
    case 22:
    case 23:
      return t.lanes = 0, Jp(e, t, n);
  }
  return At(e, t, n);
}
var id, yu, ld, od;
id = function(e, t) {
  for (var n = t.child; n !== null; ) {
    if (n.tag === 5 || n.tag === 6) e.appendChild(n.stateNode);
    else if (n.tag !== 4 && n.child !== null) {
      n.child.return = n, n = n.child;
      continue;
    }
    if (n === t) break;
    for (; n.sibling === null; ) {
      if (n.return === null || n.return === t) return;
      n = n.return;
    }
    n.sibling.return = n.return, n = n.sibling;
  }
};
yu = function() {
};
ld = function(e, t, n, r) {
  var i = e.memoizedProps;
  if (i !== r) {
    e = t.stateNode, hn(wt.current);
    var l = null;
    switch (n) {
      case "input":
        i = jo(e, i), r = jo(e, r), l = [];
        break;
      case "select":
        i = ae({}, i, { value: void 0 }), r = ae({}, r, { value: void 0 }), l = [];
        break;
      case "textarea":
        i = $o(e, i), r = $o(e, r), l = [];
        break;
      default:
        typeof i.onClick != "function" && typeof r.onClick == "function" && (e.onclick = rl);
    }
    Vo(n, r);
    var o;
    n = null;
    for (a in i) if (!r.hasOwnProperty(a) && i.hasOwnProperty(a) && i[a] != null) if (a === "style") {
      var u = i[a];
      for (o in u) u.hasOwnProperty(o) && (n || (n = {}), n[o] = "");
    } else a !== "dangerouslySetInnerHTML" && a !== "children" && a !== "suppressContentEditableWarning" && a !== "suppressHydrationWarning" && a !== "autoFocus" && (jr.hasOwnProperty(a) ? l || (l = []) : (l = l || []).push(a, null));
    for (a in r) {
      var s = r[a];
      if (u = i != null ? i[a] : void 0, r.hasOwnProperty(a) && s !== u && (s != null || u != null)) if (a === "style") if (u) {
        for (o in u) !u.hasOwnProperty(o) || s && s.hasOwnProperty(o) || (n || (n = {}), n[o] = "");
        for (o in s) s.hasOwnProperty(o) && u[o] !== s[o] && (n || (n = {}), n[o] = s[o]);
      } else n || (l || (l = []), l.push(
        a,
        n
      )), n = s;
      else a === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0, u = u ? u.__html : void 0, s != null && u !== s && (l = l || []).push(a, s)) : a === "children" ? typeof s != "string" && typeof s != "number" || (l = l || []).push(a, "" + s) : a !== "suppressContentEditableWarning" && a !== "suppressHydrationWarning" && (jr.hasOwnProperty(a) ? (s != null && a === "onScroll" && ie("scroll", e), l || u === s || (l = [])) : (l = l || []).push(a, s));
    }
    n && (l = l || []).push("style", n);
    var a = l;
    (t.updateQueue = a) && (t.flags |= 4);
  }
};
od = function(e, t, n, r) {
  n !== r && (t.flags |= 4);
};
function kr(e, t) {
  if (!oe) switch (e.tailMode) {
    case "hidden":
      t = e.tail;
      for (var n = null; t !== null; ) t.alternate !== null && (n = t), t = t.sibling;
      n === null ? e.tail = null : n.sibling = null;
      break;
    case "collapsed":
      n = e.tail;
      for (var r = null; n !== null; ) n.alternate !== null && (r = n), n = n.sibling;
      r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
  }
}
function Te(e) {
  var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
  if (t) for (var i = e.child; i !== null; ) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 14680064, r |= i.flags & 14680064, i.return = e, i = i.sibling;
  else for (i = e.child; i !== null; ) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
  return e.subtreeFlags |= r, e.childLanes = n, t;
}
function Ug(e, t, n) {
  var r = t.pendingProps;
  switch (us(t), t.tag) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return Te(t), null;
    case 1:
      return je(t.type) && il(), Te(t), null;
    case 3:
      return r = t.stateNode, tr(), le(Me), le(Pe), gs(), r.pendingContext && (r.context = r.pendingContext, r.pendingContext = null), (e === null || e.child === null) && (Ei(t) ? t.flags |= 4 : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, ct !== null && (Tu(ct), ct = null))), yu(e, t), Te(t), null;
    case 5:
      ms(t);
      var i = hn(Gr.current);
      if (n = t.type, e !== null && t.stateNode != null) ld(e, t, n, r, i), e.ref !== t.ref && (t.flags |= 512, t.flags |= 2097152);
      else {
        if (!r) {
          if (t.stateNode === null) throw Error(I(166));
          return Te(t), null;
        }
        if (e = hn(wt.current), Ei(t)) {
          r = t.stateNode, n = t.type;
          var l = t.memoizedProps;
          switch (r[vt] = t, r[Yr] = l, e = (t.mode & 1) !== 0, n) {
            case "dialog":
              ie("cancel", r), ie("close", r);
              break;
            case "iframe":
            case "object":
            case "embed":
              ie("load", r);
              break;
            case "video":
            case "audio":
              for (i = 0; i < _r.length; i++) ie(_r[i], r);
              break;
            case "source":
              ie("error", r);
              break;
            case "img":
            case "image":
            case "link":
              ie(
                "error",
                r
              ), ie("load", r);
              break;
            case "details":
              ie("toggle", r);
              break;
            case "input":
              ca(r, l), ie("invalid", r);
              break;
            case "select":
              r._wrapperState = { wasMultiple: !!l.multiple }, ie("invalid", r);
              break;
            case "textarea":
              pa(r, l), ie("invalid", r);
          }
          Vo(n, l), i = null;
          for (var o in l) if (l.hasOwnProperty(o)) {
            var u = l[o];
            o === "children" ? typeof u == "string" ? r.textContent !== u && (l.suppressHydrationWarning !== !0 && Ci(r.textContent, u, e), i = ["children", u]) : typeof u == "number" && r.textContent !== "" + u && (l.suppressHydrationWarning !== !0 && Ci(
              r.textContent,
              u,
              e
            ), i = ["children", "" + u]) : jr.hasOwnProperty(o) && u != null && o === "onScroll" && ie("scroll", r);
          }
          switch (n) {
            case "input":
              mi(r), fa(r, l, !0);
              break;
            case "textarea":
              mi(r), da(r);
              break;
            case "select":
            case "option":
              break;
            default:
              typeof l.onClick == "function" && (r.onclick = rl);
          }
          r = i, t.updateQueue = r, r !== null && (t.flags |= 4);
        } else {
          o = i.nodeType === 9 ? i : i.ownerDocument, e === "http://www.w3.org/1999/xhtml" && (e = Df(n)), e === "http://www.w3.org/1999/xhtml" ? n === "script" ? (e = o.createElement("div"), e.innerHTML = "<script><\/script>", e = e.removeChild(e.firstChild)) : typeof r.is == "string" ? e = o.createElement(n, { is: r.is }) : (e = o.createElement(n), n === "select" && (o = e, r.multiple ? o.multiple = !0 : r.size && (o.size = r.size))) : e = o.createElementNS(e, n), e[vt] = t, e[Yr] = r, id(e, t, !1, !1), t.stateNode = e;
          e: {
            switch (o = Wo(n, r), n) {
              case "dialog":
                ie("cancel", e), ie("close", e), i = r;
                break;
              case "iframe":
              case "object":
              case "embed":
                ie("load", e), i = r;
                break;
              case "video":
              case "audio":
                for (i = 0; i < _r.length; i++) ie(_r[i], e);
                i = r;
                break;
              case "source":
                ie("error", e), i = r;
                break;
              case "img":
              case "image":
              case "link":
                ie(
                  "error",
                  e
                ), ie("load", e), i = r;
                break;
              case "details":
                ie("toggle", e), i = r;
                break;
              case "input":
                ca(e, r), i = jo(e, r), ie("invalid", e);
                break;
              case "option":
                i = r;
                break;
              case "select":
                e._wrapperState = { wasMultiple: !!r.multiple }, i = ae({}, r, { value: void 0 }), ie("invalid", e);
                break;
              case "textarea":
                pa(e, r), i = $o(e, r), ie("invalid", e);
                break;
              default:
                i = r;
            }
            Vo(n, i), u = i;
            for (l in u) if (u.hasOwnProperty(l)) {
              var s = u[l];
              l === "style" ? Of(e, s) : l === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0, s != null && Rf(e, s)) : l === "children" ? typeof s == "string" ? (n !== "textarea" || s !== "") && Br(e, s) : typeof s == "number" && Br(e, "" + s) : l !== "suppressContentEditableWarning" && l !== "suppressHydrationWarning" && l !== "autoFocus" && (jr.hasOwnProperty(l) ? s != null && l === "onScroll" && ie("scroll", e) : s != null && Qu(e, l, s, o));
            }
            switch (n) {
              case "input":
                mi(e), fa(e, r, !1);
                break;
              case "textarea":
                mi(e), da(e);
                break;
              case "option":
                r.value != null && e.setAttribute("value", "" + Jt(r.value));
                break;
              case "select":
                e.multiple = !!r.multiple, l = r.value, l != null ? Vn(e, !!r.multiple, l, !1) : r.defaultValue != null && Vn(
                  e,
                  !!r.multiple,
                  r.defaultValue,
                  !0
                );
                break;
              default:
                typeof i.onClick == "function" && (e.onclick = rl);
            }
            switch (n) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                r = !!r.autoFocus;
                break e;
              case "img":
                r = !0;
                break e;
              default:
                r = !1;
            }
          }
          r && (t.flags |= 4);
        }
        t.ref !== null && (t.flags |= 512, t.flags |= 2097152);
      }
      return Te(t), null;
    case 6:
      if (e && t.stateNode != null) od(e, t, e.memoizedProps, r);
      else {
        if (typeof r != "string" && t.stateNode === null) throw Error(I(166));
        if (n = hn(Gr.current), hn(wt.current), Ei(t)) {
          if (r = t.stateNode, n = t.memoizedProps, r[vt] = t, (l = r.nodeValue !== n) && (e = Ke, e !== null)) switch (e.tag) {
            case 3:
              Ci(r.nodeValue, n, (e.mode & 1) !== 0);
              break;
            case 5:
              e.memoizedProps.suppressHydrationWarning !== !0 && Ci(r.nodeValue, n, (e.mode & 1) !== 0);
          }
          l && (t.flags |= 4);
        } else r = (n.nodeType === 9 ? n : n.ownerDocument).createTextNode(r), r[vt] = t, t.stateNode = r;
      }
      return Te(t), null;
    case 13:
      if (le(ue), r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
        if (oe && Qe !== null && t.mode & 1 && !(t.flags & 128)) Ep(), Jn(), t.flags |= 98560, l = !1;
        else if (l = Ei(t), r !== null && r.dehydrated !== null) {
          if (e === null) {
            if (!l) throw Error(I(318));
            if (l = t.memoizedState, l = l !== null ? l.dehydrated : null, !l) throw Error(I(317));
            l[vt] = t;
          } else Jn(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
          Te(t), l = !1;
        } else ct !== null && (Tu(ct), ct = null), l = !0;
        if (!l) return t.flags & 65536 ? t : null;
      }
      return t.flags & 128 ? (t.lanes = n, t) : (r = r !== null, r !== (e !== null && e.memoizedState !== null) && r && (t.child.flags |= 8192, t.mode & 1 && (e === null || ue.current & 1 ? ke === 0 && (ke = 3) : Ps())), t.updateQueue !== null && (t.flags |= 4), Te(t), null);
    case 4:
      return tr(), yu(e, t), e === null && Kr(t.stateNode.containerInfo), Te(t), null;
    case 10:
      return fs(t.type._context), Te(t), null;
    case 17:
      return je(t.type) && il(), Te(t), null;
    case 19:
      if (le(ue), l = t.memoizedState, l === null) return Te(t), null;
      if (r = (t.flags & 128) !== 0, o = l.rendering, o === null) if (r) kr(l, !1);
      else {
        if (ke !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null; ) {
          if (o = fl(e), o !== null) {
            for (t.flags |= 128, kr(l, !1), r = o.updateQueue, r !== null && (t.updateQueue = r, t.flags |= 4), t.subtreeFlags = 0, r = n, n = t.child; n !== null; ) l = n, e = r, l.flags &= 14680066, o = l.alternate, o === null ? (l.childLanes = 0, l.lanes = e, l.child = null, l.subtreeFlags = 0, l.memoizedProps = null, l.memoizedState = null, l.updateQueue = null, l.dependencies = null, l.stateNode = null) : (l.childLanes = o.childLanes, l.lanes = o.lanes, l.child = o.child, l.subtreeFlags = 0, l.deletions = null, l.memoizedProps = o.memoizedProps, l.memoizedState = o.memoizedState, l.updateQueue = o.updateQueue, l.type = o.type, e = o.dependencies, l.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }), n = n.sibling;
            return ne(ue, ue.current & 1 | 2), t.child;
          }
          e = e.sibling;
        }
        l.tail !== null && pe() > rr && (t.flags |= 128, r = !0, kr(l, !1), t.lanes = 4194304);
      }
      else {
        if (!r) if (e = fl(o), e !== null) {
          if (t.flags |= 128, r = !0, n = e.updateQueue, n !== null && (t.updateQueue = n, t.flags |= 4), kr(l, !0), l.tail === null && l.tailMode === "hidden" && !o.alternate && !oe) return Te(t), null;
        } else 2 * pe() - l.renderingStartTime > rr && n !== 1073741824 && (t.flags |= 128, r = !0, kr(l, !1), t.lanes = 4194304);
        l.isBackwards ? (o.sibling = t.child, t.child = o) : (n = l.last, n !== null ? n.sibling = o : t.child = o, l.last = o);
      }
      return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = pe(), t.sibling = null, n = ue.current, ne(ue, r ? n & 1 | 2 : n & 1), t) : (Te(t), null);
    case 22:
    case 23:
      return Is(), r = t.memoizedState !== null, e !== null && e.memoizedState !== null !== r && (t.flags |= 8192), r && t.mode & 1 ? We & 1073741824 && (Te(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Te(t), null;
    case 24:
      return null;
    case 25:
      return null;
  }
  throw Error(I(156, t.tag));
}
function $g(e, t) {
  switch (us(t), t.tag) {
    case 1:
      return je(t.type) && il(), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
    case 3:
      return tr(), le(Me), le(Pe), gs(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
    case 5:
      return ms(t), null;
    case 13:
      if (le(ue), e = t.memoizedState, e !== null && e.dehydrated !== null) {
        if (t.alternate === null) throw Error(I(340));
        Jn();
      }
      return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
    case 19:
      return le(ue), null;
    case 4:
      return tr(), null;
    case 10:
      return fs(t.type._context), null;
    case 22:
    case 23:
      return Is(), null;
    case 24:
      return null;
    default:
      return null;
  }
}
var Ii = !1, _e = !1, Hg = typeof WeakSet == "function" ? WeakSet : Set, D = null;
function $n(e, t) {
  var n = e.ref;
  if (n !== null) if (typeof n == "function") try {
    n(null);
  } catch (r) {
    ce(e, t, r);
  }
  else n.current = null;
}
function ku(e, t, n) {
  try {
    n();
  } catch (r) {
    ce(e, t, r);
  }
}
var nc = !1;
function Vg(e, t) {
  if (tu = el, e = fp(), ls(e)) {
    if ("selectionStart" in e) var n = { start: e.selectionStart, end: e.selectionEnd };
    else e: {
      n = (n = e.ownerDocument) && n.defaultView || window;
      var r = n.getSelection && n.getSelection();
      if (r && r.rangeCount !== 0) {
        n = r.anchorNode;
        var i = r.anchorOffset, l = r.focusNode;
        r = r.focusOffset;
        try {
          n.nodeType, l.nodeType;
        } catch {
          n = null;
          break e;
        }
        var o = 0, u = -1, s = -1, a = 0, f = 0, c = e, p = null;
        t: for (; ; ) {
          for (var d; c !== n || i !== 0 && c.nodeType !== 3 || (u = o + i), c !== l || r !== 0 && c.nodeType !== 3 || (s = o + r), c.nodeType === 3 && (o += c.nodeValue.length), (d = c.firstChild) !== null; )
            p = c, c = d;
          for (; ; ) {
            if (c === e) break t;
            if (p === n && ++a === i && (u = o), p === l && ++f === r && (s = o), (d = c.nextSibling) !== null) break;
            c = p, p = c.parentNode;
          }
          c = d;
        }
        n = u === -1 || s === -1 ? null : { start: u, end: s };
      } else n = null;
    }
    n = n || { start: 0, end: 0 };
  } else n = null;
  for (nu = { focusedElem: e, selectionRange: n }, el = !1, D = t; D !== null; ) if (t = D, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null) e.return = t, D = e;
  else for (; D !== null; ) {
    t = D;
    try {
      var g = t.alternate;
      if (t.flags & 1024) switch (t.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if (g !== null) {
            var x = g.memoizedProps, T = g.memoizedState, h = t.stateNode, m = h.getSnapshotBeforeUpdate(t.elementType === t.type ? x : st(t.type, x), T);
            h.__reactInternalSnapshotBeforeUpdate = m;
          }
          break;
        case 3:
          var y = t.stateNode.containerInfo;
          y.nodeType === 1 ? y.textContent = "" : y.nodeType === 9 && y.documentElement && y.removeChild(y.documentElement);
          break;
        case 5:
        case 6:
        case 4:
        case 17:
          break;
        default:
          throw Error(I(163));
      }
    } catch (C) {
      ce(t, t.return, C);
    }
    if (e = t.sibling, e !== null) {
      e.return = t.return, D = e;
      break;
    }
    D = t.return;
  }
  return g = nc, nc = !1, g;
}
function Ar(e, t, n) {
  var r = t.updateQueue;
  if (r = r !== null ? r.lastEffect : null, r !== null) {
    var i = r = r.next;
    do {
      if ((i.tag & e) === e) {
        var l = i.destroy;
        i.destroy = void 0, l !== void 0 && ku(t, n, l);
      }
      i = i.next;
    } while (i !== r);
  }
}
function bl(e, t) {
  if (t = t.updateQueue, t = t !== null ? t.lastEffect : null, t !== null) {
    var n = t = t.next;
    do {
      if ((n.tag & e) === e) {
        var r = n.create;
        n.destroy = r();
      }
      n = n.next;
    } while (n !== t);
  }
}
function vu(e) {
  var t = e.ref;
  if (t !== null) {
    var n = e.stateNode;
    switch (e.tag) {
      case 5:
        e = n;
        break;
      default:
        e = n;
    }
    typeof t == "function" ? t(e) : t.current = e;
  }
}
function ud(e) {
  var t = e.alternate;
  t !== null && (e.alternate = null, ud(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && (delete t[vt], delete t[Yr], delete t[lu], delete t[_g], delete t[Ig])), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
}
function sd(e) {
  return e.tag === 5 || e.tag === 3 || e.tag === 4;
}
function rc(e) {
  e: for (; ; ) {
    for (; e.sibling === null; ) {
      if (e.return === null || sd(e.return)) return null;
      e = e.return;
    }
    for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
      if (e.flags & 2 || e.child === null || e.tag === 4) continue e;
      e.child.return = e, e = e.child;
    }
    if (!(e.flags & 2)) return e.stateNode;
  }
}
function xu(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6) e = e.stateNode, t ? n.nodeType === 8 ? n.parentNode.insertBefore(e, t) : n.insertBefore(e, t) : (n.nodeType === 8 ? (t = n.parentNode, t.insertBefore(e, n)) : (t = n, t.appendChild(e)), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = rl));
  else if (r !== 4 && (e = e.child, e !== null)) for (xu(e, t, n), e = e.sibling; e !== null; ) xu(e, t, n), e = e.sibling;
}
function wu(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6) e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
  else if (r !== 4 && (e = e.child, e !== null)) for (wu(e, t, n), e = e.sibling; e !== null; ) wu(e, t, n), e = e.sibling;
}
var we = null, at = !1;
function Ot(e, t, n) {
  for (n = n.child; n !== null; ) ad(e, t, n), n = n.sibling;
}
function ad(e, t, n) {
  if (xt && typeof xt.onCommitFiberUnmount == "function") try {
    xt.onCommitFiberUnmount(Cl, n);
  } catch {
  }
  switch (n.tag) {
    case 5:
      _e || $n(n, t);
    case 6:
      var r = we, i = at;
      we = null, Ot(e, t, n), we = r, at = i, we !== null && (at ? (e = we, n = n.stateNode, e.nodeType === 8 ? e.parentNode.removeChild(n) : e.removeChild(n)) : we.removeChild(n.stateNode));
      break;
    case 18:
      we !== null && (at ? (e = we, n = n.stateNode, e.nodeType === 8 ? uo(e.parentNode, n) : e.nodeType === 1 && uo(e, n), Vr(e)) : uo(we, n.stateNode));
      break;
    case 4:
      r = we, i = at, we = n.stateNode.containerInfo, at = !0, Ot(e, t, n), we = r, at = i;
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      if (!_e && (r = n.updateQueue, r !== null && (r = r.lastEffect, r !== null))) {
        i = r = r.next;
        do {
          var l = i, o = l.destroy;
          l = l.tag, o !== void 0 && (l & 2 || l & 4) && ku(n, t, o), i = i.next;
        } while (i !== r);
      }
      Ot(e, t, n);
      break;
    case 1:
      if (!_e && ($n(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function")) try {
        r.props = n.memoizedProps, r.state = n.memoizedState, r.componentWillUnmount();
      } catch (u) {
        ce(n, t, u);
      }
      Ot(e, t, n);
      break;
    case 21:
      Ot(e, t, n);
      break;
    case 22:
      n.mode & 1 ? (_e = (r = _e) || n.memoizedState !== null, Ot(e, t, n), _e = r) : Ot(e, t, n);
      break;
    default:
      Ot(e, t, n);
  }
}
function ic(e) {
  var t = e.updateQueue;
  if (t !== null) {
    e.updateQueue = null;
    var n = e.stateNode;
    n === null && (n = e.stateNode = new Hg()), t.forEach(function(r) {
      var i = Jg.bind(null, e, r);
      n.has(r) || (n.add(r), r.then(i, i));
    });
  }
}
function ut(e, t) {
  var n = t.deletions;
  if (n !== null) for (var r = 0; r < n.length; r++) {
    var i = n[r];
    try {
      var l = e, o = t, u = o;
      e: for (; u !== null; ) {
        switch (u.tag) {
          case 5:
            we = u.stateNode, at = !1;
            break e;
          case 3:
            we = u.stateNode.containerInfo, at = !0;
            break e;
          case 4:
            we = u.stateNode.containerInfo, at = !0;
            break e;
        }
        u = u.return;
      }
      if (we === null) throw Error(I(160));
      ad(l, o, i), we = null, at = !1;
      var s = i.alternate;
      s !== null && (s.return = null), i.return = null;
    } catch (a) {
      ce(i, t, a);
    }
  }
  if (t.subtreeFlags & 12854) for (t = t.child; t !== null; ) cd(t, e), t = t.sibling;
}
function cd(e, t) {
  var n = e.alternate, r = e.flags;
  switch (e.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      if (ut(t, e), gt(e), r & 4) {
        try {
          Ar(3, e, e.return), bl(3, e);
        } catch (x) {
          ce(e, e.return, x);
        }
        try {
          Ar(5, e, e.return);
        } catch (x) {
          ce(e, e.return, x);
        }
      }
      break;
    case 1:
      ut(t, e), gt(e), r & 512 && n !== null && $n(n, n.return);
      break;
    case 5:
      if (ut(t, e), gt(e), r & 512 && n !== null && $n(n, n.return), e.flags & 32) {
        var i = e.stateNode;
        try {
          Br(i, "");
        } catch (x) {
          ce(e, e.return, x);
        }
      }
      if (r & 4 && (i = e.stateNode, i != null)) {
        var l = e.memoizedProps, o = n !== null ? n.memoizedProps : l, u = e.type, s = e.updateQueue;
        if (e.updateQueue = null, s !== null) try {
          u === "input" && l.type === "radio" && l.name != null && Nf(i, l), Wo(u, o);
          var a = Wo(u, l);
          for (o = 0; o < s.length; o += 2) {
            var f = s[o], c = s[o + 1];
            f === "style" ? Of(i, c) : f === "dangerouslySetInnerHTML" ? Rf(i, c) : f === "children" ? Br(i, c) : Qu(i, f, c, a);
          }
          switch (u) {
            case "input":
              Bo(i, l);
              break;
            case "textarea":
              Af(i, l);
              break;
            case "select":
              var p = i._wrapperState.wasMultiple;
              i._wrapperState.wasMultiple = !!l.multiple;
              var d = l.value;
              d != null ? Vn(i, !!l.multiple, d, !1) : p !== !!l.multiple && (l.defaultValue != null ? Vn(
                i,
                !!l.multiple,
                l.defaultValue,
                !0
              ) : Vn(i, !!l.multiple, l.multiple ? [] : "", !1));
          }
          i[Yr] = l;
        } catch (x) {
          ce(e, e.return, x);
        }
      }
      break;
    case 6:
      if (ut(t, e), gt(e), r & 4) {
        if (e.stateNode === null) throw Error(I(162));
        i = e.stateNode, l = e.memoizedProps;
        try {
          i.nodeValue = l;
        } catch (x) {
          ce(e, e.return, x);
        }
      }
      break;
    case 3:
      if (ut(t, e), gt(e), r & 4 && n !== null && n.memoizedState.isDehydrated) try {
        Vr(t.containerInfo);
      } catch (x) {
        ce(e, e.return, x);
      }
      break;
    case 4:
      ut(t, e), gt(e);
      break;
    case 13:
      ut(t, e), gt(e), i = e.child, i.flags & 8192 && (l = i.memoizedState !== null, i.stateNode.isHidden = l, !l || i.alternate !== null && i.alternate.memoizedState !== null || (Ts = pe())), r & 4 && ic(e);
      break;
    case 22:
      if (f = n !== null && n.memoizedState !== null, e.mode & 1 ? (_e = (a = _e) || f, ut(t, e), _e = a) : ut(t, e), gt(e), r & 8192) {
        if (a = e.memoizedState !== null, (e.stateNode.isHidden = a) && !f && e.mode & 1) for (D = e, f = e.child; f !== null; ) {
          for (c = D = f; D !== null; ) {
            switch (p = D, d = p.child, p.tag) {
              case 0:
              case 11:
              case 14:
              case 15:
                Ar(4, p, p.return);
                break;
              case 1:
                $n(p, p.return);
                var g = p.stateNode;
                if (typeof g.componentWillUnmount == "function") {
                  r = p, n = p.return;
                  try {
                    t = r, g.props = t.memoizedProps, g.state = t.memoizedState, g.componentWillUnmount();
                  } catch (x) {
                    ce(r, n, x);
                  }
                }
                break;
              case 5:
                $n(p, p.return);
                break;
              case 22:
                if (p.memoizedState !== null) {
                  oc(c);
                  continue;
                }
            }
            d !== null ? (d.return = p, D = d) : oc(c);
          }
          f = f.sibling;
        }
        e: for (f = null, c = e; ; ) {
          if (c.tag === 5) {
            if (f === null) {
              f = c;
              try {
                i = c.stateNode, a ? (l = i.style, typeof l.setProperty == "function" ? l.setProperty("display", "none", "important") : l.display = "none") : (u = c.stateNode, s = c.memoizedProps.style, o = s != null && s.hasOwnProperty("display") ? s.display : null, u.style.display = Ff("display", o));
              } catch (x) {
                ce(e, e.return, x);
              }
            }
          } else if (c.tag === 6) {
            if (f === null) try {
              c.stateNode.nodeValue = a ? "" : c.memoizedProps;
            } catch (x) {
              ce(e, e.return, x);
            }
          } else if ((c.tag !== 22 && c.tag !== 23 || c.memoizedState === null || c === e) && c.child !== null) {
            c.child.return = c, c = c.child;
            continue;
          }
          if (c === e) break e;
          for (; c.sibling === null; ) {
            if (c.return === null || c.return === e) break e;
            f === c && (f = null), c = c.return;
          }
          f === c && (f = null), c.sibling.return = c.return, c = c.sibling;
        }
      }
      break;
    case 19:
      ut(t, e), gt(e), r & 4 && ic(e);
      break;
    case 21:
      break;
    default:
      ut(
        t,
        e
      ), gt(e);
  }
}
function gt(e) {
  var t = e.flags;
  if (t & 2) {
    try {
      e: {
        for (var n = e.return; n !== null; ) {
          if (sd(n)) {
            var r = n;
            break e;
          }
          n = n.return;
        }
        throw Error(I(160));
      }
      switch (r.tag) {
        case 5:
          var i = r.stateNode;
          r.flags & 32 && (Br(i, ""), r.flags &= -33);
          var l = rc(e);
          wu(e, l, i);
          break;
        case 3:
        case 4:
          var o = r.stateNode.containerInfo, u = rc(e);
          xu(e, u, o);
          break;
        default:
          throw Error(I(161));
      }
    } catch (s) {
      ce(e, e.return, s);
    }
    e.flags &= -3;
  }
  t & 4096 && (e.flags &= -4097);
}
function Wg(e, t, n) {
  D = e, fd(e);
}
function fd(e, t, n) {
  for (var r = (e.mode & 1) !== 0; D !== null; ) {
    var i = D, l = i.child;
    if (i.tag === 22 && r) {
      var o = i.memoizedState !== null || Ii;
      if (!o) {
        var u = i.alternate, s = u !== null && u.memoizedState !== null || _e;
        u = Ii;
        var a = _e;
        if (Ii = o, (_e = s) && !a) for (D = i; D !== null; ) o = D, s = o.child, o.tag === 22 && o.memoizedState !== null ? uc(i) : s !== null ? (s.return = o, D = s) : uc(i);
        for (; l !== null; ) D = l, fd(l), l = l.sibling;
        D = i, Ii = u, _e = a;
      }
      lc(e);
    } else i.subtreeFlags & 8772 && l !== null ? (l.return = i, D = l) : lc(e);
  }
}
function lc(e) {
  for (; D !== null; ) {
    var t = D;
    if (t.flags & 8772) {
      var n = t.alternate;
      try {
        if (t.flags & 8772) switch (t.tag) {
          case 0:
          case 11:
          case 15:
            _e || bl(5, t);
            break;
          case 1:
            var r = t.stateNode;
            if (t.flags & 4 && !_e) if (n === null) r.componentDidMount();
            else {
              var i = t.elementType === t.type ? n.memoizedProps : st(t.type, n.memoizedProps);
              r.componentDidUpdate(i, n.memoizedState, r.__reactInternalSnapshotBeforeUpdate);
            }
            var l = t.updateQueue;
            l !== null && Ha(t, l, r);
            break;
          case 3:
            var o = t.updateQueue;
            if (o !== null) {
              if (n = null, t.child !== null) switch (t.child.tag) {
                case 5:
                  n = t.child.stateNode;
                  break;
                case 1:
                  n = t.child.stateNode;
              }
              Ha(t, o, n);
            }
            break;
          case 5:
            var u = t.stateNode;
            if (n === null && t.flags & 4) {
              n = u;
              var s = t.memoizedProps;
              switch (t.type) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  s.autoFocus && n.focus();
                  break;
                case "img":
                  s.src && (n.src = s.src);
              }
            }
            break;
          case 6:
            break;
          case 4:
            break;
          case 12:
            break;
          case 13:
            if (t.memoizedState === null) {
              var a = t.alternate;
              if (a !== null) {
                var f = a.memoizedState;
                if (f !== null) {
                  var c = f.dehydrated;
                  c !== null && Vr(c);
                }
              }
            }
            break;
          case 19:
          case 17:
          case 21:
          case 22:
          case 23:
          case 25:
            break;
          default:
            throw Error(I(163));
        }
        _e || t.flags & 512 && vu(t);
      } catch (p) {
        ce(t, t.return, p);
      }
    }
    if (t === e) {
      D = null;
      break;
    }
    if (n = t.sibling, n !== null) {
      n.return = t.return, D = n;
      break;
    }
    D = t.return;
  }
}
function oc(e) {
  for (; D !== null; ) {
    var t = D;
    if (t === e) {
      D = null;
      break;
    }
    var n = t.sibling;
    if (n !== null) {
      n.return = t.return, D = n;
      break;
    }
    D = t.return;
  }
}
function uc(e) {
  for (; D !== null; ) {
    var t = D;
    try {
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          var n = t.return;
          try {
            bl(4, t);
          } catch (s) {
            ce(t, n, s);
          }
          break;
        case 1:
          var r = t.stateNode;
          if (typeof r.componentDidMount == "function") {
            var i = t.return;
            try {
              r.componentDidMount();
            } catch (s) {
              ce(t, i, s);
            }
          }
          var l = t.return;
          try {
            vu(t);
          } catch (s) {
            ce(t, l, s);
          }
          break;
        case 5:
          var o = t.return;
          try {
            vu(t);
          } catch (s) {
            ce(t, o, s);
          }
      }
    } catch (s) {
      ce(t, t.return, s);
    }
    if (t === e) {
      D = null;
      break;
    }
    var u = t.sibling;
    if (u !== null) {
      u.return = t.return, D = u;
      break;
    }
    D = t.return;
  }
}
var Qg = Math.ceil, hl = Dt.ReactCurrentDispatcher, Cs = Dt.ReactCurrentOwner, nt = Dt.ReactCurrentBatchConfig, Y = 0, xe = null, me = null, Se = 0, We = 0, Hn = nn(0), ke = 0, ti = null, xn = 0, Nl = 0, Es = 0, Dr = null, Fe = null, Ts = 0, rr = 1 / 0, Tt = null, ml = !1, Su = null, Xt = null, Pi = !1, Vt = null, gl = 0, Rr = 0, Cu = null, Hi = -1, Vi = 0;
function Ne() {
  return Y & 6 ? pe() : Hi !== -1 ? Hi : Hi = pe();
}
function Gt(e) {
  return e.mode & 1 ? Y & 2 && Se !== 0 ? Se & -Se : zg.transition !== null ? (Vi === 0 && (Vi = Yf()), Vi) : (e = X, e !== 0 || (e = window.event, e = e === void 0 ? 16 : np(e.type)), e) : 1;
}
function pt(e, t, n, r) {
  if (50 < Rr) throw Rr = 0, Cu = null, Error(I(185));
  li(e, n, r), (!(Y & 2) || e !== xe) && (e === xe && (!(Y & 2) && (Nl |= n), ke === 4 && $t(e, Se)), Be(e, r), n === 1 && Y === 0 && !(t.mode & 1) && (rr = pe() + 500, Pl && rn()));
}
function Be(e, t) {
  var n = e.callbackNode;
  zm(e, t);
  var r = Ji(e, e === xe ? Se : 0);
  if (r === 0) n !== null && ga(n), e.callbackNode = null, e.callbackPriority = 0;
  else if (t = r & -r, e.callbackPriority !== t) {
    if (n != null && ga(n), t === 1) e.tag === 0 ? Pg(sc.bind(null, e)) : wp(sc.bind(null, e)), Eg(function() {
      !(Y & 6) && rn();
    }), n = null;
    else {
      switch (Xf(r)) {
        case 1:
          n = Gu;
          break;
        case 4:
          n = Kf;
          break;
        case 16:
          n = Zi;
          break;
        case 536870912:
          n = qf;
          break;
        default:
          n = Zi;
      }
      n = vd(n, pd.bind(null, e));
    }
    e.callbackPriority = t, e.callbackNode = n;
  }
}
function pd(e, t) {
  if (Hi = -1, Vi = 0, Y & 6) throw Error(I(327));
  var n = e.callbackNode;
  if (Yn() && e.callbackNode !== n) return null;
  var r = Ji(e, e === xe ? Se : 0);
  if (r === 0) return null;
  if (r & 30 || r & e.expiredLanes || t) t = yl(e, r);
  else {
    t = r;
    var i = Y;
    Y |= 2;
    var l = hd();
    (xe !== e || Se !== t) && (Tt = null, rr = pe() + 500, mn(e, t));
    do
      try {
        Yg();
        break;
      } catch (u) {
        dd(e, u);
      }
    while (!0);
    cs(), hl.current = l, Y = i, me !== null ? t = 0 : (xe = null, Se = 0, t = ke);
  }
  if (t !== 0) {
    if (t === 2 && (i = Xo(e), i !== 0 && (r = i, t = Eu(e, i))), t === 1) throw n = ti, mn(e, 0), $t(e, r), Be(e, pe()), n;
    if (t === 6) $t(e, r);
    else {
      if (i = e.current.alternate, !(r & 30) && !Kg(i) && (t = yl(e, r), t === 2 && (l = Xo(e), l !== 0 && (r = l, t = Eu(e, l))), t === 1)) throw n = ti, mn(e, 0), $t(e, r), Be(e, pe()), n;
      switch (e.finishedWork = i, e.finishedLanes = r, t) {
        case 0:
        case 1:
          throw Error(I(345));
        case 2:
          cn(e, Fe, Tt);
          break;
        case 3:
          if ($t(e, r), (r & 130023424) === r && (t = Ts + 500 - pe(), 10 < t)) {
            if (Ji(e, 0) !== 0) break;
            if (i = e.suspendedLanes, (i & r) !== r) {
              Ne(), e.pingedLanes |= e.suspendedLanes & i;
              break;
            }
            e.timeoutHandle = iu(cn.bind(null, e, Fe, Tt), t);
            break;
          }
          cn(e, Fe, Tt);
          break;
        case 4:
          if ($t(e, r), (r & 4194240) === r) break;
          for (t = e.eventTimes, i = -1; 0 < r; ) {
            var o = 31 - ft(r);
            l = 1 << o, o = t[o], o > i && (i = o), r &= ~l;
          }
          if (r = i, r = pe() - r, r = (120 > r ? 120 : 480 > r ? 480 : 1080 > r ? 1080 : 1920 > r ? 1920 : 3e3 > r ? 3e3 : 4320 > r ? 4320 : 1960 * Qg(r / 1960)) - r, 10 < r) {
            e.timeoutHandle = iu(cn.bind(null, e, Fe, Tt), r);
            break;
          }
          cn(e, Fe, Tt);
          break;
        case 5:
          cn(e, Fe, Tt);
          break;
        default:
          throw Error(I(329));
      }
    }
  }
  return Be(e, pe()), e.callbackNode === n ? pd.bind(null, e) : null;
}
function Eu(e, t) {
  var n = Dr;
  return e.current.memoizedState.isDehydrated && (mn(e, t).flags |= 256), e = yl(e, t), e !== 2 && (t = Fe, Fe = n, t !== null && Tu(t)), e;
}
function Tu(e) {
  Fe === null ? Fe = e : Fe.push.apply(Fe, e);
}
function Kg(e) {
  for (var t = e; ; ) {
    if (t.flags & 16384) {
      var n = t.updateQueue;
      if (n !== null && (n = n.stores, n !== null)) for (var r = 0; r < n.length; r++) {
        var i = n[r], l = i.getSnapshot;
        i = i.value;
        try {
          if (!ht(l(), i)) return !1;
        } catch {
          return !1;
        }
      }
    }
    if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
    else {
      if (t === e) break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e) return !0;
        t = t.return;
      }
      t.sibling.return = t.return, t = t.sibling;
    }
  }
  return !0;
}
function $t(e, t) {
  for (t &= ~Es, t &= ~Nl, e.suspendedLanes |= t, e.pingedLanes &= ~t, e = e.expirationTimes; 0 < t; ) {
    var n = 31 - ft(t), r = 1 << n;
    e[n] = -1, t &= ~r;
  }
}
function sc(e) {
  if (Y & 6) throw Error(I(327));
  Yn();
  var t = Ji(e, 0);
  if (!(t & 1)) return Be(e, pe()), null;
  var n = yl(e, t);
  if (e.tag !== 0 && n === 2) {
    var r = Xo(e);
    r !== 0 && (t = r, n = Eu(e, r));
  }
  if (n === 1) throw n = ti, mn(e, 0), $t(e, t), Be(e, pe()), n;
  if (n === 6) throw Error(I(345));
  return e.finishedWork = e.current.alternate, e.finishedLanes = t, cn(e, Fe, Tt), Be(e, pe()), null;
}
function _s(e, t) {
  var n = Y;
  Y |= 1;
  try {
    return e(t);
  } finally {
    Y = n, Y === 0 && (rr = pe() + 500, Pl && rn());
  }
}
function wn(e) {
  Vt !== null && Vt.tag === 0 && !(Y & 6) && Yn();
  var t = Y;
  Y |= 1;
  var n = nt.transition, r = X;
  try {
    if (nt.transition = null, X = 1, e) return e();
  } finally {
    X = r, nt.transition = n, Y = t, !(Y & 6) && rn();
  }
}
function Is() {
  We = Hn.current, le(Hn);
}
function mn(e, t) {
  e.finishedWork = null, e.finishedLanes = 0;
  var n = e.timeoutHandle;
  if (n !== -1 && (e.timeoutHandle = -1, Cg(n)), me !== null) for (n = me.return; n !== null; ) {
    var r = n;
    switch (us(r), r.tag) {
      case 1:
        r = r.type.childContextTypes, r != null && il();
        break;
      case 3:
        tr(), le(Me), le(Pe), gs();
        break;
      case 5:
        ms(r);
        break;
      case 4:
        tr();
        break;
      case 13:
        le(ue);
        break;
      case 19:
        le(ue);
        break;
      case 10:
        fs(r.type._context);
        break;
      case 22:
      case 23:
        Is();
    }
    n = n.return;
  }
  if (xe = e, me = e = Zt(e.current, null), Se = We = t, ke = 0, ti = null, Es = Nl = xn = 0, Fe = Dr = null, dn !== null) {
    for (t = 0; t < dn.length; t++) if (n = dn[t], r = n.interleaved, r !== null) {
      n.interleaved = null;
      var i = r.next, l = n.pending;
      if (l !== null) {
        var o = l.next;
        l.next = i, r.next = o;
      }
      n.pending = r;
    }
    dn = null;
  }
  return e;
}
function dd(e, t) {
  do {
    var n = me;
    try {
      if (cs(), Bi.current = dl, pl) {
        for (var r = se.memoizedState; r !== null; ) {
          var i = r.queue;
          i !== null && (i.pending = null), r = r.next;
        }
        pl = !1;
      }
      if (vn = 0, ve = ye = se = null, Nr = !1, Zr = 0, Cs.current = null, n === null || n.return === null) {
        ke = 1, ti = t, me = null;
        break;
      }
      e: {
        var l = e, o = n.return, u = n, s = t;
        if (t = Se, u.flags |= 32768, s !== null && typeof s == "object" && typeof s.then == "function") {
          var a = s, f = u, c = f.tag;
          if (!(f.mode & 1) && (c === 0 || c === 11 || c === 15)) {
            var p = f.alternate;
            p ? (f.updateQueue = p.updateQueue, f.memoizedState = p.memoizedState, f.lanes = p.lanes) : (f.updateQueue = null, f.memoizedState = null);
          }
          var d = Ya(o);
          if (d !== null) {
            d.flags &= -257, Xa(d, o, u, l, t), d.mode & 1 && qa(l, a, t), t = d, s = a;
            var g = t.updateQueue;
            if (g === null) {
              var x = /* @__PURE__ */ new Set();
              x.add(s), t.updateQueue = x;
            } else g.add(s);
            break e;
          } else {
            if (!(t & 1)) {
              qa(l, a, t), Ps();
              break e;
            }
            s = Error(I(426));
          }
        } else if (oe && u.mode & 1) {
          var T = Ya(o);
          if (T !== null) {
            !(T.flags & 65536) && (T.flags |= 256), Xa(T, o, u, l, t), ss(nr(s, u));
            break e;
          }
        }
        l = s = nr(s, u), ke !== 4 && (ke = 2), Dr === null ? Dr = [l] : Dr.push(l), l = o;
        do {
          switch (l.tag) {
            case 3:
              l.flags |= 65536, t &= -t, l.lanes |= t;
              var h = Xp(l, s, t);
              $a(l, h);
              break e;
            case 1:
              u = s;
              var m = l.type, y = l.stateNode;
              if (!(l.flags & 128) && (typeof m.getDerivedStateFromError == "function" || y !== null && typeof y.componentDidCatch == "function" && (Xt === null || !Xt.has(y)))) {
                l.flags |= 65536, t &= -t, l.lanes |= t;
                var C = Gp(l, u, t);
                $a(l, C);
                break e;
              }
          }
          l = l.return;
        } while (l !== null);
      }
      gd(n);
    } catch (_) {
      t = _, me === n && n !== null && (me = n = n.return);
      continue;
    }
    break;
  } while (!0);
}
function hd() {
  var e = hl.current;
  return hl.current = dl, e === null ? dl : e;
}
function Ps() {
  (ke === 0 || ke === 3 || ke === 2) && (ke = 4), xe === null || !(xn & 268435455) && !(Nl & 268435455) || $t(xe, Se);
}
function yl(e, t) {
  var n = Y;
  Y |= 2;
  var r = hd();
  (xe !== e || Se !== t) && (Tt = null, mn(e, t));
  do
    try {
      qg();
      break;
    } catch (i) {
      dd(e, i);
    }
  while (!0);
  if (cs(), Y = n, hl.current = r, me !== null) throw Error(I(261));
  return xe = null, Se = 0, ke;
}
function qg() {
  for (; me !== null; ) md(me);
}
function Yg() {
  for (; me !== null && !xm(); ) md(me);
}
function md(e) {
  var t = kd(e.alternate, e, We);
  e.memoizedProps = e.pendingProps, t === null ? gd(e) : me = t, Cs.current = null;
}
function gd(e) {
  var t = e;
  do {
    var n = t.alternate;
    if (e = t.return, t.flags & 32768) {
      if (n = $g(n, t), n !== null) {
        n.flags &= 32767, me = n;
        return;
      }
      if (e !== null) e.flags |= 32768, e.subtreeFlags = 0, e.deletions = null;
      else {
        ke = 6, me = null;
        return;
      }
    } else if (n = Ug(n, t, We), n !== null) {
      me = n;
      return;
    }
    if (t = t.sibling, t !== null) {
      me = t;
      return;
    }
    me = t = e;
  } while (t !== null);
  ke === 0 && (ke = 5);
}
function cn(e, t, n) {
  var r = X, i = nt.transition;
  try {
    nt.transition = null, X = 1, Xg(e, t, n, r);
  } finally {
    nt.transition = i, X = r;
  }
  return null;
}
function Xg(e, t, n, r) {
  do
    Yn();
  while (Vt !== null);
  if (Y & 6) throw Error(I(327));
  n = e.finishedWork;
  var i = e.finishedLanes;
  if (n === null) return null;
  if (e.finishedWork = null, e.finishedLanes = 0, n === e.current) throw Error(I(177));
  e.callbackNode = null, e.callbackPriority = 0;
  var l = n.lanes | n.childLanes;
  if (Lm(e, l), e === xe && (me = xe = null, Se = 0), !(n.subtreeFlags & 2064) && !(n.flags & 2064) || Pi || (Pi = !0, vd(Zi, function() {
    return Yn(), null;
  })), l = (n.flags & 15990) !== 0, n.subtreeFlags & 15990 || l) {
    l = nt.transition, nt.transition = null;
    var o = X;
    X = 1;
    var u = Y;
    Y |= 4, Cs.current = null, Vg(e, n), cd(n, e), gg(nu), el = !!tu, nu = tu = null, e.current = n, Wg(n), wm(), Y = u, X = o, nt.transition = l;
  } else e.current = n;
  if (Pi && (Pi = !1, Vt = e, gl = i), l = e.pendingLanes, l === 0 && (Xt = null), Em(n.stateNode), Be(e, pe()), t !== null) for (r = e.onRecoverableError, n = 0; n < t.length; n++) i = t[n], r(i.value, { componentStack: i.stack, digest: i.digest });
  if (ml) throw ml = !1, e = Su, Su = null, e;
  return gl & 1 && e.tag !== 0 && Yn(), l = e.pendingLanes, l & 1 ? e === Cu ? Rr++ : (Rr = 0, Cu = e) : Rr = 0, rn(), null;
}
function Yn() {
  if (Vt !== null) {
    var e = Xf(gl), t = nt.transition, n = X;
    try {
      if (nt.transition = null, X = 16 > e ? 16 : e, Vt === null) var r = !1;
      else {
        if (e = Vt, Vt = null, gl = 0, Y & 6) throw Error(I(331));
        var i = Y;
        for (Y |= 4, D = e.current; D !== null; ) {
          var l = D, o = l.child;
          if (D.flags & 16) {
            var u = l.deletions;
            if (u !== null) {
              for (var s = 0; s < u.length; s++) {
                var a = u[s];
                for (D = a; D !== null; ) {
                  var f = D;
                  switch (f.tag) {
                    case 0:
                    case 11:
                    case 15:
                      Ar(8, f, l);
                  }
                  var c = f.child;
                  if (c !== null) c.return = f, D = c;
                  else for (; D !== null; ) {
                    f = D;
                    var p = f.sibling, d = f.return;
                    if (ud(f), f === a) {
                      D = null;
                      break;
                    }
                    if (p !== null) {
                      p.return = d, D = p;
                      break;
                    }
                    D = d;
                  }
                }
              }
              var g = l.alternate;
              if (g !== null) {
                var x = g.child;
                if (x !== null) {
                  g.child = null;
                  do {
                    var T = x.sibling;
                    x.sibling = null, x = T;
                  } while (x !== null);
                }
              }
              D = l;
            }
          }
          if (l.subtreeFlags & 2064 && o !== null) o.return = l, D = o;
          else e: for (; D !== null; ) {
            if (l = D, l.flags & 2048) switch (l.tag) {
              case 0:
              case 11:
              case 15:
                Ar(9, l, l.return);
            }
            var h = l.sibling;
            if (h !== null) {
              h.return = l.return, D = h;
              break e;
            }
            D = l.return;
          }
        }
        var m = e.current;
        for (D = m; D !== null; ) {
          o = D;
          var y = o.child;
          if (o.subtreeFlags & 2064 && y !== null) y.return = o, D = y;
          else e: for (o = m; D !== null; ) {
            if (u = D, u.flags & 2048) try {
              switch (u.tag) {
                case 0:
                case 11:
                case 15:
                  bl(9, u);
              }
            } catch (_) {
              ce(u, u.return, _);
            }
            if (u === o) {
              D = null;
              break e;
            }
            var C = u.sibling;
            if (C !== null) {
              C.return = u.return, D = C;
              break e;
            }
            D = u.return;
          }
        }
        if (Y = i, rn(), xt && typeof xt.onPostCommitFiberRoot == "function") try {
          xt.onPostCommitFiberRoot(Cl, e);
        } catch {
        }
        r = !0;
      }
      return r;
    } finally {
      X = n, nt.transition = t;
    }
  }
  return !1;
}
function ac(e, t, n) {
  t = nr(n, t), t = Xp(e, t, 1), e = Yt(e, t, 1), t = Ne(), e !== null && (li(e, 1, t), Be(e, t));
}
function ce(e, t, n) {
  if (e.tag === 3) ac(e, e, n);
  else for (; t !== null; ) {
    if (t.tag === 3) {
      ac(t, e, n);
      break;
    } else if (t.tag === 1) {
      var r = t.stateNode;
      if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (Xt === null || !Xt.has(r))) {
        e = nr(n, e), e = Gp(t, e, 1), t = Yt(t, e, 1), e = Ne(), t !== null && (li(t, 1, e), Be(t, e));
        break;
      }
    }
    t = t.return;
  }
}
function Gg(e, t, n) {
  var r = e.pingCache;
  r !== null && r.delete(t), t = Ne(), e.pingedLanes |= e.suspendedLanes & n, xe === e && (Se & n) === n && (ke === 4 || ke === 3 && (Se & 130023424) === Se && 500 > pe() - Ts ? mn(e, 0) : Es |= n), Be(e, t);
}
function yd(e, t) {
  t === 0 && (e.mode & 1 ? (t = ki, ki <<= 1, !(ki & 130023424) && (ki = 4194304)) : t = 1);
  var n = Ne();
  e = Nt(e, t), e !== null && (li(e, t, n), Be(e, n));
}
function Zg(e) {
  var t = e.memoizedState, n = 0;
  t !== null && (n = t.retryLane), yd(e, n);
}
function Jg(e, t) {
  var n = 0;
  switch (e.tag) {
    case 13:
      var r = e.stateNode, i = e.memoizedState;
      i !== null && (n = i.retryLane);
      break;
    case 19:
      r = e.stateNode;
      break;
    default:
      throw Error(I(314));
  }
  r !== null && r.delete(t), yd(e, n);
}
var kd;
kd = function(e, t, n) {
  if (e !== null) if (e.memoizedProps !== t.pendingProps || Me.current) Oe = !0;
  else {
    if (!(e.lanes & n) && !(t.flags & 128)) return Oe = !1, Bg(e, t, n);
    Oe = !!(e.flags & 131072);
  }
  else Oe = !1, oe && t.flags & 1048576 && Sp(t, ul, t.index);
  switch (t.lanes = 0, t.tag) {
    case 2:
      var r = t.type;
      $i(e, t), e = t.pendingProps;
      var i = Zn(t, Pe.current);
      qn(t, n), i = ks(null, t, r, e, i, n);
      var l = vs();
      return t.flags |= 1, typeof i == "object" && i !== null && typeof i.render == "function" && i.$$typeof === void 0 ? (t.tag = 1, t.memoizedState = null, t.updateQueue = null, je(r) ? (l = !0, ll(t)) : l = !1, t.memoizedState = i.state !== null && i.state !== void 0 ? i.state : null, ds(t), i.updater = Ll, t.stateNode = i, i._reactInternals = t, fu(t, r, e, n), t = hu(null, t, r, !0, l, n)) : (t.tag = 0, oe && l && os(t), Le(null, t, i, n), t = t.child), t;
    case 16:
      r = t.elementType;
      e: {
        switch ($i(e, t), e = t.pendingProps, i = r._init, r = i(r._payload), t.type = r, i = t.tag = ty(r), e = st(r, e), i) {
          case 0:
            t = du(null, t, r, e, n);
            break e;
          case 1:
            t = Ja(null, t, r, e, n);
            break e;
          case 11:
            t = Ga(null, t, r, e, n);
            break e;
          case 14:
            t = Za(null, t, r, st(r.type, e), n);
            break e;
        }
        throw Error(I(
          306,
          r,
          ""
        ));
      }
      return t;
    case 0:
      return r = t.type, i = t.pendingProps, i = t.elementType === r ? i : st(r, i), du(e, t, r, i, n);
    case 1:
      return r = t.type, i = t.pendingProps, i = t.elementType === r ? i : st(r, i), Ja(e, t, r, i, n);
    case 3:
      e: {
        if (td(t), e === null) throw Error(I(387));
        r = t.pendingProps, l = t.memoizedState, i = l.element, Pp(e, t), cl(t, r, null, n);
        var o = t.memoizedState;
        if (r = o.element, l.isDehydrated) if (l = { element: r, isDehydrated: !1, cache: o.cache, pendingSuspenseBoundaries: o.pendingSuspenseBoundaries, transitions: o.transitions }, t.updateQueue.baseState = l, t.memoizedState = l, t.flags & 256) {
          i = nr(Error(I(423)), t), t = ec(e, t, r, n, i);
          break e;
        } else if (r !== i) {
          i = nr(Error(I(424)), t), t = ec(e, t, r, n, i);
          break e;
        } else for (Qe = qt(t.stateNode.containerInfo.firstChild), Ke = t, oe = !0, ct = null, n = _p(t, null, r, n), t.child = n; n; ) n.flags = n.flags & -3 | 4096, n = n.sibling;
        else {
          if (Jn(), r === i) {
            t = At(e, t, n);
            break e;
          }
          Le(e, t, r, n);
        }
        t = t.child;
      }
      return t;
    case 5:
      return zp(t), e === null && su(t), r = t.type, i = t.pendingProps, l = e !== null ? e.memoizedProps : null, o = i.children, ru(r, i) ? o = null : l !== null && ru(r, l) && (t.flags |= 32), ed(e, t), Le(e, t, o, n), t.child;
    case 6:
      return e === null && su(t), null;
    case 13:
      return nd(e, t, n);
    case 4:
      return hs(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = er(t, null, r, n) : Le(e, t, r, n), t.child;
    case 11:
      return r = t.type, i = t.pendingProps, i = t.elementType === r ? i : st(r, i), Ga(e, t, r, i, n);
    case 7:
      return Le(e, t, t.pendingProps, n), t.child;
    case 8:
      return Le(e, t, t.pendingProps.children, n), t.child;
    case 12:
      return Le(e, t, t.pendingProps.children, n), t.child;
    case 10:
      e: {
        if (r = t.type._context, i = t.pendingProps, l = t.memoizedProps, o = i.value, ne(sl, r._currentValue), r._currentValue = o, l !== null) if (ht(l.value, o)) {
          if (l.children === i.children && !Me.current) {
            t = At(e, t, n);
            break e;
          }
        } else for (l = t.child, l !== null && (l.return = t); l !== null; ) {
          var u = l.dependencies;
          if (u !== null) {
            o = l.child;
            for (var s = u.firstContext; s !== null; ) {
              if (s.context === r) {
                if (l.tag === 1) {
                  s = zt(-1, n & -n), s.tag = 2;
                  var a = l.updateQueue;
                  if (a !== null) {
                    a = a.shared;
                    var f = a.pending;
                    f === null ? s.next = s : (s.next = f.next, f.next = s), a.pending = s;
                  }
                }
                l.lanes |= n, s = l.alternate, s !== null && (s.lanes |= n), au(
                  l.return,
                  n,
                  t
                ), u.lanes |= n;
                break;
              }
              s = s.next;
            }
          } else if (l.tag === 10) o = l.type === t.type ? null : l.child;
          else if (l.tag === 18) {
            if (o = l.return, o === null) throw Error(I(341));
            o.lanes |= n, u = o.alternate, u !== null && (u.lanes |= n), au(o, n, t), o = l.sibling;
          } else o = l.child;
          if (o !== null) o.return = l;
          else for (o = l; o !== null; ) {
            if (o === t) {
              o = null;
              break;
            }
            if (l = o.sibling, l !== null) {
              l.return = o.return, o = l;
              break;
            }
            o = o.return;
          }
          l = o;
        }
        Le(e, t, i.children, n), t = t.child;
      }
      return t;
    case 9:
      return i = t.type, r = t.pendingProps.children, qn(t, n), i = rt(i), r = r(i), t.flags |= 1, Le(e, t, r, n), t.child;
    case 14:
      return r = t.type, i = st(r, t.pendingProps), i = st(r.type, i), Za(e, t, r, i, n);
    case 15:
      return Zp(e, t, t.type, t.pendingProps, n);
    case 17:
      return r = t.type, i = t.pendingProps, i = t.elementType === r ? i : st(r, i), $i(e, t), t.tag = 1, je(r) ? (e = !0, ll(t)) : e = !1, qn(t, n), Yp(t, r, i), fu(t, r, i, n), hu(null, t, r, !0, e, n);
    case 19:
      return rd(e, t, n);
    case 22:
      return Jp(e, t, n);
  }
  throw Error(I(156, t.tag));
};
function vd(e, t) {
  return Qf(e, t);
}
function ey(e, t, n, r) {
  this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
}
function tt(e, t, n, r) {
  return new ey(e, t, n, r);
}
function zs(e) {
  return e = e.prototype, !(!e || !e.isReactComponent);
}
function ty(e) {
  if (typeof e == "function") return zs(e) ? 1 : 0;
  if (e != null) {
    if (e = e.$$typeof, e === qu) return 11;
    if (e === Yu) return 14;
  }
  return 2;
}
function Zt(e, t) {
  var n = e.alternate;
  return n === null ? (n = tt(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 14680064, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n;
}
function Wi(e, t, n, r, i, l) {
  var o = 2;
  if (r = e, typeof e == "function") zs(e) && (o = 1);
  else if (typeof e == "string") o = 5;
  else e: switch (e) {
    case An:
      return gn(n.children, i, l, t);
    case Ku:
      o = 8, i |= 8;
      break;
    case Ro:
      return e = tt(12, n, t, i | 2), e.elementType = Ro, e.lanes = l, e;
    case Fo:
      return e = tt(13, n, t, i), e.elementType = Fo, e.lanes = l, e;
    case Oo:
      return e = tt(19, n, t, i), e.elementType = Oo, e.lanes = l, e;
    case zf:
      return Al(n, i, l, t);
    default:
      if (typeof e == "object" && e !== null) switch (e.$$typeof) {
        case If:
          o = 10;
          break e;
        case Pf:
          o = 9;
          break e;
        case qu:
          o = 11;
          break e;
        case Yu:
          o = 14;
          break e;
        case jt:
          o = 16, r = null;
          break e;
      }
      throw Error(I(130, e == null ? e : typeof e, ""));
  }
  return t = tt(o, n, t, i), t.elementType = e, t.type = r, t.lanes = l, t;
}
function gn(e, t, n, r) {
  return e = tt(7, e, r, t), e.lanes = n, e;
}
function Al(e, t, n, r) {
  return e = tt(22, e, r, t), e.elementType = zf, e.lanes = n, e.stateNode = { isHidden: !1 }, e;
}
function go(e, t, n) {
  return e = tt(6, e, null, t), e.lanes = n, e;
}
function yo(e, t, n) {
  return t = tt(4, e.children !== null ? e.children : [], e.key, t), t.lanes = n, t.stateNode = { containerInfo: e.containerInfo, pendingChildren: null, implementation: e.implementation }, t;
}
function ny(e, t, n, r, i) {
  this.tag = t, this.containerInfo = e, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = Xl(0), this.expirationTimes = Xl(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Xl(0), this.identifierPrefix = r, this.onRecoverableError = i, this.mutableSourceEagerHydrationData = null;
}
function Ls(e, t, n, r, i, l, o, u, s) {
  return e = new ny(e, t, n, u, s), t === 1 ? (t = 1, l === !0 && (t |= 8)) : t = 0, l = tt(3, null, null, t), e.current = l, l.stateNode = e, l.memoizedState = { element: r, isDehydrated: n, cache: null, transitions: null, pendingSuspenseBoundaries: null }, ds(l), e;
}
function ry(e, t, n) {
  var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
  return { $$typeof: Nn, key: r == null ? null : "" + r, children: e, containerInfo: t, implementation: n };
}
function xd(e) {
  if (!e) return en;
  e = e._reactInternals;
  e: {
    if (En(e) !== e || e.tag !== 1) throw Error(I(170));
    var t = e;
    do {
      switch (t.tag) {
        case 3:
          t = t.stateNode.context;
          break e;
        case 1:
          if (je(t.type)) {
            t = t.stateNode.__reactInternalMemoizedMergedChildContext;
            break e;
          }
      }
      t = t.return;
    } while (t !== null);
    throw Error(I(171));
  }
  if (e.tag === 1) {
    var n = e.type;
    if (je(n)) return xp(e, n, t);
  }
  return t;
}
function wd(e, t, n, r, i, l, o, u, s) {
  return e = Ls(n, r, !0, e, i, l, o, u, s), e.context = xd(null), n = e.current, r = Ne(), i = Gt(n), l = zt(r, i), l.callback = t != null ? t : null, Yt(n, l, i), e.current.lanes = i, li(e, i, r), Be(e, r), e;
}
function Dl(e, t, n, r) {
  var i = t.current, l = Ne(), o = Gt(i);
  return n = xd(n), t.context === null ? t.context = n : t.pendingContext = n, t = zt(l, o), t.payload = { element: e }, r = r === void 0 ? null : r, r !== null && (t.callback = r), e = Yt(i, t, o), e !== null && (pt(e, i, o, l), ji(e, i, o)), o;
}
function kl(e) {
  if (e = e.current, !e.child) return null;
  switch (e.child.tag) {
    case 5:
      return e.child.stateNode;
    default:
      return e.child.stateNode;
  }
}
function cc(e, t) {
  if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
    var n = e.retryLane;
    e.retryLane = n !== 0 && n < t ? n : t;
  }
}
function bs(e, t) {
  cc(e, t), (e = e.alternate) && cc(e, t);
}
function iy() {
  return null;
}
var Sd = typeof reportError == "function" ? reportError : function(e) {
  console.error(e);
};
function Ns(e) {
  this._internalRoot = e;
}
Rl.prototype.render = Ns.prototype.render = function(e) {
  var t = this._internalRoot;
  if (t === null) throw Error(I(409));
  Dl(e, t, null, null);
};
Rl.prototype.unmount = Ns.prototype.unmount = function() {
  var e = this._internalRoot;
  if (e !== null) {
    this._internalRoot = null;
    var t = e.containerInfo;
    wn(function() {
      Dl(null, e, null, null);
    }), t[bt] = null;
  }
};
function Rl(e) {
  this._internalRoot = e;
}
Rl.prototype.unstable_scheduleHydration = function(e) {
  if (e) {
    var t = Jf();
    e = { blockedOn: null, target: e, priority: t };
    for (var n = 0; n < Ut.length && t !== 0 && t < Ut[n].priority; n++) ;
    Ut.splice(n, 0, e), n === 0 && tp(e);
  }
};
function As(e) {
  return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
}
function Fl(e) {
  return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11 && (e.nodeType !== 8 || e.nodeValue !== " react-mount-point-unstable "));
}
function fc() {
}
function ly(e, t, n, r, i) {
  if (i) {
    if (typeof r == "function") {
      var l = r;
      r = function() {
        var a = kl(o);
        l.call(a);
      };
    }
    var o = wd(t, r, e, 0, null, !1, !1, "", fc);
    return e._reactRootContainer = o, e[bt] = o.current, Kr(e.nodeType === 8 ? e.parentNode : e), wn(), o;
  }
  for (; i = e.lastChild; ) e.removeChild(i);
  if (typeof r == "function") {
    var u = r;
    r = function() {
      var a = kl(s);
      u.call(a);
    };
  }
  var s = Ls(e, 0, !1, null, null, !1, !1, "", fc);
  return e._reactRootContainer = s, e[bt] = s.current, Kr(e.nodeType === 8 ? e.parentNode : e), wn(function() {
    Dl(t, s, n, r);
  }), s;
}
function Ol(e, t, n, r, i) {
  var l = n._reactRootContainer;
  if (l) {
    var o = l;
    if (typeof i == "function") {
      var u = i;
      i = function() {
        var s = kl(o);
        u.call(s);
      };
    }
    Dl(t, o, e, i);
  } else o = ly(n, t, e, i, r);
  return kl(o);
}
Gf = function(e) {
  switch (e.tag) {
    case 3:
      var t = e.stateNode;
      if (t.current.memoizedState.isDehydrated) {
        var n = Tr(t.pendingLanes);
        n !== 0 && (Zu(t, n | 1), Be(t, pe()), !(Y & 6) && (rr = pe() + 500, rn()));
      }
      break;
    case 13:
      wn(function() {
        var r = Nt(e, 1);
        if (r !== null) {
          var i = Ne();
          pt(r, e, 1, i);
        }
      }), bs(e, 1);
  }
};
Ju = function(e) {
  if (e.tag === 13) {
    var t = Nt(e, 134217728);
    if (t !== null) {
      var n = Ne();
      pt(t, e, 134217728, n);
    }
    bs(e, 134217728);
  }
};
Zf = function(e) {
  if (e.tag === 13) {
    var t = Gt(e), n = Nt(e, t);
    if (n !== null) {
      var r = Ne();
      pt(n, e, t, r);
    }
    bs(e, t);
  }
};
Jf = function() {
  return X;
};
ep = function(e, t) {
  var n = X;
  try {
    return X = e, t();
  } finally {
    X = n;
  }
};
Ko = function(e, t, n) {
  switch (t) {
    case "input":
      if (Bo(e, n), t = n.name, n.type === "radio" && t != null) {
        for (n = e; n.parentNode; ) n = n.parentNode;
        for (n = n.querySelectorAll("input[name=" + JSON.stringify("" + t) + '][type="radio"]'), t = 0; t < n.length; t++) {
          var r = n[t];
          if (r !== e && r.form === e.form) {
            var i = Il(r);
            if (!i) throw Error(I(90));
            bf(r), Bo(r, i);
          }
        }
      }
      break;
    case "textarea":
      Af(e, n);
      break;
    case "select":
      t = n.value, t != null && Vn(e, !!n.multiple, t, !1);
  }
};
Bf = _s;
Uf = wn;
var oy = { usingClientEntryPoint: !1, Events: [ui, On, Il, Mf, jf, _s] }, vr = { findFiberByHostInstance: pn, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" }, uy = { bundleType: vr.bundleType, version: vr.version, rendererPackageName: vr.rendererPackageName, rendererConfig: vr.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: Dt.ReactCurrentDispatcher, findHostInstanceByFiber: function(e) {
  return e = Vf(e), e === null ? null : e.stateNode;
}, findFiberByHostInstance: vr.findFiberByHostInstance || iy, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ != "undefined") {
  var zi = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!zi.isDisabled && zi.supportsFiber) try {
    Cl = zi.inject(uy), xt = zi;
  } catch {
  }
}
Xe.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = oy;
Xe.createPortal = function(e, t) {
  var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
  if (!As(t)) throw Error(I(200));
  return ry(e, t, null, n);
};
Xe.createRoot = function(e, t) {
  if (!As(e)) throw Error(I(299));
  var n = !1, r = "", i = Sd;
  return t != null && (t.unstable_strictMode === !0 && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onRecoverableError !== void 0 && (i = t.onRecoverableError)), t = Ls(e, 1, !1, null, null, n, !1, r, i), e[bt] = t.current, Kr(e.nodeType === 8 ? e.parentNode : e), new Ns(t);
};
Xe.findDOMNode = function(e) {
  if (e == null) return null;
  if (e.nodeType === 1) return e;
  var t = e._reactInternals;
  if (t === void 0)
    throw typeof e.render == "function" ? Error(I(188)) : (e = Object.keys(e).join(","), Error(I(268, e)));
  return e = Vf(t), e = e === null ? null : e.stateNode, e;
};
Xe.flushSync = function(e) {
  return wn(e);
};
Xe.hydrate = function(e, t, n) {
  if (!Fl(t)) throw Error(I(200));
  return Ol(null, e, t, !0, n);
};
Xe.hydrateRoot = function(e, t, n) {
  if (!As(e)) throw Error(I(405));
  var r = n != null && n.hydratedSources || null, i = !1, l = "", o = Sd;
  if (n != null && (n.unstable_strictMode === !0 && (i = !0), n.identifierPrefix !== void 0 && (l = n.identifierPrefix), n.onRecoverableError !== void 0 && (o = n.onRecoverableError)), t = wd(t, null, e, 1, n != null ? n : null, i, !1, l, o), e[bt] = t.current, Kr(e), r) for (e = 0; e < r.length; e++) n = r[e], i = n._getVersion, i = i(n._source), t.mutableSourceEagerHydrationData == null ? t.mutableSourceEagerHydrationData = [n, i] : t.mutableSourceEagerHydrationData.push(
    n,
    i
  );
  return new Rl(t);
};
Xe.render = function(e, t, n) {
  if (!Fl(t)) throw Error(I(200));
  return Ol(null, e, t, !1, n);
};
Xe.unmountComponentAtNode = function(e) {
  if (!Fl(e)) throw Error(I(40));
  return e._reactRootContainer ? (wn(function() {
    Ol(null, null, e, !1, function() {
      e._reactRootContainer = null, e[bt] = null;
    });
  }), !0) : !1;
};
Xe.unstable_batchedUpdates = _s;
Xe.unstable_renderSubtreeIntoContainer = function(e, t, n, r) {
  if (!Fl(n)) throw Error(I(200));
  if (e == null || e._reactInternals === void 0) throw Error(I(38));
  return Ol(e, t, n, !1, r);
};
Xe.version = "18.3.1-next-f1338f8080-20240426";
function Cd() {
  if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ == "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Cd);
    } catch (e) {
      console.error(e);
    }
}
Cd(), Cf.exports = Xe;
var sy = Cf.exports, Ed, pc = sy;
Ed = pc.createRoot, pc.hydrateRoot;
var Td = { exports: {} }, Ml = {};
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ay = Ve, cy = Symbol.for("react.element"), fy = Symbol.for("react.fragment"), py = Object.prototype.hasOwnProperty, dy = ay.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, hy = { key: !0, ref: !0, __self: !0, __source: !0 };
function _d(e, t, n) {
  var r, i = {}, l = null, o = null;
  n !== void 0 && (l = "" + n), t.key !== void 0 && (l = "" + t.key), t.ref !== void 0 && (o = t.ref);
  for (r in t) py.call(t, r) && !hy.hasOwnProperty(r) && (i[r] = t[r]);
  if (e && e.defaultProps) for (r in t = e.defaultProps, t) i[r] === void 0 && (i[r] = t[r]);
  return { $$typeof: cy, type: e, key: l, ref: o, props: i, _owner: dy.current };
}
Ml.Fragment = fy;
Ml.jsx = _d;
Ml.jsxs = _d;
Td.exports = Ml;
var F = Td.exports;
function my(e, t) {
  const n = {};
  return (e[e.length - 1] === "" ? [...e, ""] : e).join(
    (n.padRight ? " " : "") + "," + (n.padLeft === !1 ? "" : " ")
  ).trim();
}
const gy = /^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/u, yy = /^[$_\p{ID_Start}][-$_\u{200C}\u{200D}\p{ID_Continue}]*$/u, ky = {};
function dc(e, t) {
  return (ky.jsx ? yy : gy).test(e);
}
const vy = /[ \t\n\f\r]/g;
function xy(e) {
  return typeof e == "object" ? e.type === "text" ? hc(e.value) : !1 : hc(e);
}
function hc(e) {
  return e.replace(vy, "") === "";
}
class ai {
  /**
   * @param {SchemaType['property']} property
   *   Property.
   * @param {SchemaType['normal']} normal
   *   Normal.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Schema.
   */
  constructor(t, n, r) {
    this.normal = n, this.property = t, r && (this.space = r);
  }
}
ai.prototype.normal = {};
ai.prototype.property = {};
ai.prototype.space = void 0;
function Id(e, t) {
  const n = {}, r = {};
  for (const i of e)
    Object.assign(n, i.property), Object.assign(r, i.normal);
  return new ai(n, r, t);
}
function _u(e) {
  return e.toLowerCase();
}
class Ue {
  /**
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @returns
   *   Info.
   */
  constructor(t, n) {
    this.attribute = n, this.property = t;
  }
}
Ue.prototype.attribute = "";
Ue.prototype.booleanish = !1;
Ue.prototype.boolean = !1;
Ue.prototype.commaOrSpaceSeparated = !1;
Ue.prototype.commaSeparated = !1;
Ue.prototype.defined = !1;
Ue.prototype.mustUseProperty = !1;
Ue.prototype.number = !1;
Ue.prototype.overloadedBoolean = !1;
Ue.prototype.property = "";
Ue.prototype.spaceSeparated = !1;
Ue.prototype.space = void 0;
let wy = 0;
const U = Tn(), he = Tn(), Iu = Tn(), z = Tn(), te = Tn(), Xn = Tn(), He = Tn();
function Tn() {
  return 2 ** ++wy;
}
const Pu = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  boolean: U,
  booleanish: he,
  commaOrSpaceSeparated: He,
  commaSeparated: Xn,
  number: z,
  overloadedBoolean: Iu,
  spaceSeparated: te
}, Symbol.toStringTag, { value: "Module" })), ko = (
  /** @type {ReadonlyArray<keyof typeof types>} */
  Object.keys(Pu)
);
class Ds extends Ue {
  /**
   * @constructor
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @param {number | null | undefined} [mask]
   *   Mask.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Info.
   */
  constructor(t, n, r, i) {
    let l = -1;
    if (super(t, n), mc(this, "space", i), typeof r == "number")
      for (; ++l < ko.length; ) {
        const o = ko[l];
        mc(this, ko[l], (r & Pu[o]) === Pu[o]);
      }
  }
}
Ds.prototype.defined = !0;
function mc(e, t, n) {
  n && (e[t] = n);
}
function sr(e) {
  const t = {}, n = {};
  for (const [r, i] of Object.entries(e.properties)) {
    const l = new Ds(
      r,
      e.transform(e.attributes || {}, r),
      i,
      e.space
    );
    e.mustUseProperty && e.mustUseProperty.includes(r) && (l.mustUseProperty = !0), t[r] = l, n[_u(r)] = r, n[_u(l.attribute)] = r;
  }
  return new ai(t, n, e.space);
}
const Pd = sr({
  properties: {
    ariaActiveDescendant: null,
    ariaAtomic: he,
    ariaAutoComplete: null,
    ariaBusy: he,
    ariaChecked: he,
    ariaColCount: z,
    ariaColIndex: z,
    ariaColSpan: z,
    ariaControls: te,
    ariaCurrent: null,
    ariaDescribedBy: te,
    ariaDetails: null,
    ariaDisabled: he,
    ariaDropEffect: te,
    ariaErrorMessage: null,
    ariaExpanded: he,
    ariaFlowTo: te,
    ariaGrabbed: he,
    ariaHasPopup: null,
    ariaHidden: he,
    ariaInvalid: null,
    ariaKeyShortcuts: null,
    ariaLabel: null,
    ariaLabelledBy: te,
    ariaLevel: z,
    ariaLive: null,
    ariaModal: he,
    ariaMultiLine: he,
    ariaMultiSelectable: he,
    ariaOrientation: null,
    ariaOwns: te,
    ariaPlaceholder: null,
    ariaPosInSet: z,
    ariaPressed: he,
    ariaReadOnly: he,
    ariaRelevant: null,
    ariaRequired: he,
    ariaRoleDescription: te,
    ariaRowCount: z,
    ariaRowIndex: z,
    ariaRowSpan: z,
    ariaSelected: he,
    ariaSetSize: z,
    ariaSort: null,
    ariaValueMax: z,
    ariaValueMin: z,
    ariaValueNow: z,
    ariaValueText: null,
    role: null
  },
  transform(e, t) {
    return t === "role" ? t : "aria-" + t.slice(4).toLowerCase();
  }
});
function zd(e, t) {
  return t in e ? e[t] : t;
}
function Ld(e, t) {
  return zd(e, t.toLowerCase());
}
const Sy = sr({
  attributes: {
    acceptcharset: "accept-charset",
    classname: "class",
    htmlfor: "for",
    httpequiv: "http-equiv"
  },
  mustUseProperty: ["checked", "multiple", "muted", "selected"],
  properties: {
    // Standard Properties.
    abbr: null,
    accept: Xn,
    acceptCharset: te,
    accessKey: te,
    action: null,
    allow: null,
    allowFullScreen: U,
    allowPaymentRequest: U,
    allowUserMedia: U,
    alt: null,
    as: null,
    async: U,
    autoCapitalize: null,
    autoComplete: te,
    autoFocus: U,
    autoPlay: U,
    blocking: te,
    capture: null,
    charSet: null,
    checked: U,
    cite: null,
    className: te,
    cols: z,
    colSpan: null,
    content: null,
    contentEditable: he,
    controls: U,
    controlsList: te,
    coords: z | Xn,
    crossOrigin: null,
    data: null,
    dateTime: null,
    decoding: null,
    default: U,
    defer: U,
    dir: null,
    dirName: null,
    disabled: U,
    download: Iu,
    draggable: he,
    encType: null,
    enterKeyHint: null,
    fetchPriority: null,
    form: null,
    formAction: null,
    formEncType: null,
    formMethod: null,
    formNoValidate: U,
    formTarget: null,
    headers: te,
    height: z,
    hidden: Iu,
    high: z,
    href: null,
    hrefLang: null,
    htmlFor: te,
    httpEquiv: te,
    id: null,
    imageSizes: null,
    imageSrcSet: null,
    inert: U,
    inputMode: null,
    integrity: null,
    is: null,
    isMap: U,
    itemId: null,
    itemProp: te,
    itemRef: te,
    itemScope: U,
    itemType: te,
    kind: null,
    label: null,
    lang: null,
    language: null,
    list: null,
    loading: null,
    loop: U,
    low: z,
    manifest: null,
    max: null,
    maxLength: z,
    media: null,
    method: null,
    min: null,
    minLength: z,
    multiple: U,
    muted: U,
    name: null,
    nonce: null,
    noModule: U,
    noValidate: U,
    onAbort: null,
    onAfterPrint: null,
    onAuxClick: null,
    onBeforeMatch: null,
    onBeforePrint: null,
    onBeforeToggle: null,
    onBeforeUnload: null,
    onBlur: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onContextLost: null,
    onContextMenu: null,
    onContextRestored: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFormData: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLanguageChange: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadEnd: null,
    onLoadStart: null,
    onMessage: null,
    onMessageError: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRejectionHandled: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onScrollEnd: null,
    onSecurityPolicyViolation: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onSlotChange: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnhandledRejection: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onWheel: null,
    open: U,
    optimum: z,
    pattern: null,
    ping: te,
    placeholder: null,
    playsInline: U,
    popover: null,
    popoverTarget: null,
    popoverTargetAction: null,
    poster: null,
    preload: null,
    readOnly: U,
    referrerPolicy: null,
    rel: te,
    required: U,
    reversed: U,
    rows: z,
    rowSpan: z,
    sandbox: te,
    scope: null,
    scoped: U,
    seamless: U,
    selected: U,
    shadowRootClonable: U,
    shadowRootDelegatesFocus: U,
    shadowRootMode: null,
    shape: null,
    size: z,
    sizes: null,
    slot: null,
    span: z,
    spellCheck: he,
    src: null,
    srcDoc: null,
    srcLang: null,
    srcSet: null,
    start: z,
    step: null,
    style: null,
    tabIndex: z,
    target: null,
    title: null,
    translate: null,
    type: null,
    typeMustMatch: U,
    useMap: null,
    value: he,
    width: z,
    wrap: null,
    writingSuggestions: null,
    // Legacy.
    // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
    align: null,
    // Several. Use CSS `text-align` instead,
    aLink: null,
    // `<body>`. Use CSS `a:active {color}` instead
    archive: te,
    // `<object>`. List of URIs to archives
    axis: null,
    // `<td>` and `<th>`. Use `scope` on `<th>`
    background: null,
    // `<body>`. Use CSS `background-image` instead
    bgColor: null,
    // `<body>` and table elements. Use CSS `background-color` instead
    border: z,
    // `<table>`. Use CSS `border-width` instead,
    borderColor: null,
    // `<table>`. Use CSS `border-color` instead,
    bottomMargin: z,
    // `<body>`
    cellPadding: null,
    // `<table>`
    cellSpacing: null,
    // `<table>`
    char: null,
    // Several table elements. When `align=char`, sets the character to align on
    charOff: null,
    // Several table elements. When `char`, offsets the alignment
    classId: null,
    // `<object>`
    clear: null,
    // `<br>`. Use CSS `clear` instead
    code: null,
    // `<object>`
    codeBase: null,
    // `<object>`
    codeType: null,
    // `<object>`
    color: null,
    // `<font>` and `<hr>`. Use CSS instead
    compact: U,
    // Lists. Use CSS to reduce space between items instead
    declare: U,
    // `<object>`
    event: null,
    // `<script>`
    face: null,
    // `<font>`. Use CSS instead
    frame: null,
    // `<table>`
    frameBorder: null,
    // `<iframe>`. Use CSS `border` instead
    hSpace: z,
    // `<img>` and `<object>`
    leftMargin: z,
    // `<body>`
    link: null,
    // `<body>`. Use CSS `a:link {color: *}` instead
    longDesc: null,
    // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
    lowSrc: null,
    // `<img>`. Use a `<picture>`
    marginHeight: z,
    // `<body>`
    marginWidth: z,
    // `<body>`
    noResize: U,
    // `<frame>`
    noHref: U,
    // `<area>`. Use no href instead of an explicit `nohref`
    noShade: U,
    // `<hr>`. Use background-color and height instead of borders
    noWrap: U,
    // `<td>` and `<th>`
    object: null,
    // `<applet>`
    profile: null,
    // `<head>`
    prompt: null,
    // `<isindex>`
    rev: null,
    // `<link>`
    rightMargin: z,
    // `<body>`
    rules: null,
    // `<table>`
    scheme: null,
    // `<meta>`
    scrolling: he,
    // `<frame>`. Use overflow in the child context
    standby: null,
    // `<object>`
    summary: null,
    // `<table>`
    text: null,
    // `<body>`. Use CSS `color` instead
    topMargin: z,
    // `<body>`
    valueType: null,
    // `<param>`
    version: null,
    // `<html>`. Use a doctype.
    vAlign: null,
    // Several. Use CSS `vertical-align` instead
    vLink: null,
    // `<body>`. Use CSS `a:visited {color}` instead
    vSpace: z,
    // `<img>` and `<object>`
    // Non-standard Properties.
    allowTransparency: null,
    autoCorrect: null,
    autoSave: null,
    disablePictureInPicture: U,
    disableRemotePlayback: U,
    prefix: null,
    property: null,
    results: z,
    security: null,
    unselectable: null
  },
  space: "html",
  transform: Ld
}), Cy = sr({
  attributes: {
    accentHeight: "accent-height",
    alignmentBaseline: "alignment-baseline",
    arabicForm: "arabic-form",
    baselineShift: "baseline-shift",
    capHeight: "cap-height",
    className: "class",
    clipPath: "clip-path",
    clipRule: "clip-rule",
    colorInterpolation: "color-interpolation",
    colorInterpolationFilters: "color-interpolation-filters",
    colorProfile: "color-profile",
    colorRendering: "color-rendering",
    crossOrigin: "crossorigin",
    dataType: "datatype",
    dominantBaseline: "dominant-baseline",
    enableBackground: "enable-background",
    fillOpacity: "fill-opacity",
    fillRule: "fill-rule",
    floodColor: "flood-color",
    floodOpacity: "flood-opacity",
    fontFamily: "font-family",
    fontSize: "font-size",
    fontSizeAdjust: "font-size-adjust",
    fontStretch: "font-stretch",
    fontStyle: "font-style",
    fontVariant: "font-variant",
    fontWeight: "font-weight",
    glyphName: "glyph-name",
    glyphOrientationHorizontal: "glyph-orientation-horizontal",
    glyphOrientationVertical: "glyph-orientation-vertical",
    hrefLang: "hreflang",
    horizAdvX: "horiz-adv-x",
    horizOriginX: "horiz-origin-x",
    horizOriginY: "horiz-origin-y",
    imageRendering: "image-rendering",
    letterSpacing: "letter-spacing",
    lightingColor: "lighting-color",
    markerEnd: "marker-end",
    markerMid: "marker-mid",
    markerStart: "marker-start",
    navDown: "nav-down",
    navDownLeft: "nav-down-left",
    navDownRight: "nav-down-right",
    navLeft: "nav-left",
    navNext: "nav-next",
    navPrev: "nav-prev",
    navRight: "nav-right",
    navUp: "nav-up",
    navUpLeft: "nav-up-left",
    navUpRight: "nav-up-right",
    onAbort: "onabort",
    onActivate: "onactivate",
    onAfterPrint: "onafterprint",
    onBeforePrint: "onbeforeprint",
    onBegin: "onbegin",
    onCancel: "oncancel",
    onCanPlay: "oncanplay",
    onCanPlayThrough: "oncanplaythrough",
    onChange: "onchange",
    onClick: "onclick",
    onClose: "onclose",
    onCopy: "oncopy",
    onCueChange: "oncuechange",
    onCut: "oncut",
    onDblClick: "ondblclick",
    onDrag: "ondrag",
    onDragEnd: "ondragend",
    onDragEnter: "ondragenter",
    onDragExit: "ondragexit",
    onDragLeave: "ondragleave",
    onDragOver: "ondragover",
    onDragStart: "ondragstart",
    onDrop: "ondrop",
    onDurationChange: "ondurationchange",
    onEmptied: "onemptied",
    onEnd: "onend",
    onEnded: "onended",
    onError: "onerror",
    onFocus: "onfocus",
    onFocusIn: "onfocusin",
    onFocusOut: "onfocusout",
    onHashChange: "onhashchange",
    onInput: "oninput",
    onInvalid: "oninvalid",
    onKeyDown: "onkeydown",
    onKeyPress: "onkeypress",
    onKeyUp: "onkeyup",
    onLoad: "onload",
    onLoadedData: "onloadeddata",
    onLoadedMetadata: "onloadedmetadata",
    onLoadStart: "onloadstart",
    onMessage: "onmessage",
    onMouseDown: "onmousedown",
    onMouseEnter: "onmouseenter",
    onMouseLeave: "onmouseleave",
    onMouseMove: "onmousemove",
    onMouseOut: "onmouseout",
    onMouseOver: "onmouseover",
    onMouseUp: "onmouseup",
    onMouseWheel: "onmousewheel",
    onOffline: "onoffline",
    onOnline: "ononline",
    onPageHide: "onpagehide",
    onPageShow: "onpageshow",
    onPaste: "onpaste",
    onPause: "onpause",
    onPlay: "onplay",
    onPlaying: "onplaying",
    onPopState: "onpopstate",
    onProgress: "onprogress",
    onRateChange: "onratechange",
    onRepeat: "onrepeat",
    onReset: "onreset",
    onResize: "onresize",
    onScroll: "onscroll",
    onSeeked: "onseeked",
    onSeeking: "onseeking",
    onSelect: "onselect",
    onShow: "onshow",
    onStalled: "onstalled",
    onStorage: "onstorage",
    onSubmit: "onsubmit",
    onSuspend: "onsuspend",
    onTimeUpdate: "ontimeupdate",
    onToggle: "ontoggle",
    onUnload: "onunload",
    onVolumeChange: "onvolumechange",
    onWaiting: "onwaiting",
    onZoom: "onzoom",
    overlinePosition: "overline-position",
    overlineThickness: "overline-thickness",
    paintOrder: "paint-order",
    panose1: "panose-1",
    pointerEvents: "pointer-events",
    referrerPolicy: "referrerpolicy",
    renderingIntent: "rendering-intent",
    shapeRendering: "shape-rendering",
    stopColor: "stop-color",
    stopOpacity: "stop-opacity",
    strikethroughPosition: "strikethrough-position",
    strikethroughThickness: "strikethrough-thickness",
    strokeDashArray: "stroke-dasharray",
    strokeDashOffset: "stroke-dashoffset",
    strokeLineCap: "stroke-linecap",
    strokeLineJoin: "stroke-linejoin",
    strokeMiterLimit: "stroke-miterlimit",
    strokeOpacity: "stroke-opacity",
    strokeWidth: "stroke-width",
    tabIndex: "tabindex",
    textAnchor: "text-anchor",
    textDecoration: "text-decoration",
    textRendering: "text-rendering",
    transformOrigin: "transform-origin",
    typeOf: "typeof",
    underlinePosition: "underline-position",
    underlineThickness: "underline-thickness",
    unicodeBidi: "unicode-bidi",
    unicodeRange: "unicode-range",
    unitsPerEm: "units-per-em",
    vAlphabetic: "v-alphabetic",
    vHanging: "v-hanging",
    vIdeographic: "v-ideographic",
    vMathematical: "v-mathematical",
    vectorEffect: "vector-effect",
    vertAdvY: "vert-adv-y",
    vertOriginX: "vert-origin-x",
    vertOriginY: "vert-origin-y",
    wordSpacing: "word-spacing",
    writingMode: "writing-mode",
    xHeight: "x-height",
    // These were camelcased in Tiny. Now lowercased in SVG 2
    playbackOrder: "playbackorder",
    timelineBegin: "timelinebegin"
  },
  properties: {
    about: He,
    accentHeight: z,
    accumulate: null,
    additive: null,
    alignmentBaseline: null,
    alphabetic: z,
    amplitude: z,
    arabicForm: null,
    ascent: z,
    attributeName: null,
    attributeType: null,
    azimuth: z,
    bandwidth: null,
    baselineShift: null,
    baseFrequency: null,
    baseProfile: null,
    bbox: null,
    begin: null,
    bias: z,
    by: null,
    calcMode: null,
    capHeight: z,
    className: te,
    clip: null,
    clipPath: null,
    clipPathUnits: null,
    clipRule: null,
    color: null,
    colorInterpolation: null,
    colorInterpolationFilters: null,
    colorProfile: null,
    colorRendering: null,
    content: null,
    contentScriptType: null,
    contentStyleType: null,
    crossOrigin: null,
    cursor: null,
    cx: null,
    cy: null,
    d: null,
    dataType: null,
    defaultAction: null,
    descent: z,
    diffuseConstant: z,
    direction: null,
    display: null,
    dur: null,
    divisor: z,
    dominantBaseline: null,
    download: U,
    dx: null,
    dy: null,
    edgeMode: null,
    editable: null,
    elevation: z,
    enableBackground: null,
    end: null,
    event: null,
    exponent: z,
    externalResourcesRequired: null,
    fill: null,
    fillOpacity: z,
    fillRule: null,
    filter: null,
    filterRes: null,
    filterUnits: null,
    floodColor: null,
    floodOpacity: null,
    focusable: null,
    focusHighlight: null,
    fontFamily: null,
    fontSize: null,
    fontSizeAdjust: null,
    fontStretch: null,
    fontStyle: null,
    fontVariant: null,
    fontWeight: null,
    format: null,
    fr: null,
    from: null,
    fx: null,
    fy: null,
    g1: Xn,
    g2: Xn,
    glyphName: Xn,
    glyphOrientationHorizontal: null,
    glyphOrientationVertical: null,
    glyphRef: null,
    gradientTransform: null,
    gradientUnits: null,
    handler: null,
    hanging: z,
    hatchContentUnits: null,
    hatchUnits: null,
    height: null,
    href: null,
    hrefLang: null,
    horizAdvX: z,
    horizOriginX: z,
    horizOriginY: z,
    id: null,
    ideographic: z,
    imageRendering: null,
    initialVisibility: null,
    in: null,
    in2: null,
    intercept: z,
    k: z,
    k1: z,
    k2: z,
    k3: z,
    k4: z,
    kernelMatrix: He,
    kernelUnitLength: null,
    keyPoints: null,
    // SEMI_COLON_SEPARATED
    keySplines: null,
    // SEMI_COLON_SEPARATED
    keyTimes: null,
    // SEMI_COLON_SEPARATED
    kerning: null,
    lang: null,
    lengthAdjust: null,
    letterSpacing: null,
    lightingColor: null,
    limitingConeAngle: z,
    local: null,
    markerEnd: null,
    markerMid: null,
    markerStart: null,
    markerHeight: null,
    markerUnits: null,
    markerWidth: null,
    mask: null,
    maskContentUnits: null,
    maskUnits: null,
    mathematical: null,
    max: null,
    media: null,
    mediaCharacterEncoding: null,
    mediaContentEncodings: null,
    mediaSize: z,
    mediaTime: null,
    method: null,
    min: null,
    mode: null,
    name: null,
    navDown: null,
    navDownLeft: null,
    navDownRight: null,
    navLeft: null,
    navNext: null,
    navPrev: null,
    navRight: null,
    navUp: null,
    navUpLeft: null,
    navUpRight: null,
    numOctaves: null,
    observer: null,
    offset: null,
    onAbort: null,
    onActivate: null,
    onAfterPrint: null,
    onBeforePrint: null,
    onBegin: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnd: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFocusIn: null,
    onFocusOut: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadStart: null,
    onMessage: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onMouseWheel: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRepeat: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onShow: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onZoom: null,
    opacity: null,
    operator: null,
    order: null,
    orient: null,
    orientation: null,
    origin: null,
    overflow: null,
    overlay: null,
    overlinePosition: z,
    overlineThickness: z,
    paintOrder: null,
    panose1: null,
    path: null,
    pathLength: z,
    patternContentUnits: null,
    patternTransform: null,
    patternUnits: null,
    phase: null,
    ping: te,
    pitch: null,
    playbackOrder: null,
    pointerEvents: null,
    points: null,
    pointsAtX: z,
    pointsAtY: z,
    pointsAtZ: z,
    preserveAlpha: null,
    preserveAspectRatio: null,
    primitiveUnits: null,
    propagate: null,
    property: He,
    r: null,
    radius: null,
    referrerPolicy: null,
    refX: null,
    refY: null,
    rel: He,
    rev: He,
    renderingIntent: null,
    repeatCount: null,
    repeatDur: null,
    requiredExtensions: He,
    requiredFeatures: He,
    requiredFonts: He,
    requiredFormats: He,
    resource: null,
    restart: null,
    result: null,
    rotate: null,
    rx: null,
    ry: null,
    scale: null,
    seed: null,
    shapeRendering: null,
    side: null,
    slope: null,
    snapshotTime: null,
    specularConstant: z,
    specularExponent: z,
    spreadMethod: null,
    spacing: null,
    startOffset: null,
    stdDeviation: null,
    stemh: null,
    stemv: null,
    stitchTiles: null,
    stopColor: null,
    stopOpacity: null,
    strikethroughPosition: z,
    strikethroughThickness: z,
    string: null,
    stroke: null,
    strokeDashArray: He,
    strokeDashOffset: null,
    strokeLineCap: null,
    strokeLineJoin: null,
    strokeMiterLimit: z,
    strokeOpacity: z,
    strokeWidth: null,
    style: null,
    surfaceScale: z,
    syncBehavior: null,
    syncBehaviorDefault: null,
    syncMaster: null,
    syncTolerance: null,
    syncToleranceDefault: null,
    systemLanguage: He,
    tabIndex: z,
    tableValues: null,
    target: null,
    targetX: z,
    targetY: z,
    textAnchor: null,
    textDecoration: null,
    textRendering: null,
    textLength: null,
    timelineBegin: null,
    title: null,
    transformBehavior: null,
    type: null,
    typeOf: He,
    to: null,
    transform: null,
    transformOrigin: null,
    u1: null,
    u2: null,
    underlinePosition: z,
    underlineThickness: z,
    unicode: null,
    unicodeBidi: null,
    unicodeRange: null,
    unitsPerEm: z,
    values: null,
    vAlphabetic: z,
    vMathematical: z,
    vectorEffect: null,
    vHanging: z,
    vIdeographic: z,
    version: null,
    vertAdvY: z,
    vertOriginX: z,
    vertOriginY: z,
    viewBox: null,
    viewTarget: null,
    visibility: null,
    width: null,
    widths: null,
    wordSpacing: null,
    writingMode: null,
    x: null,
    x1: null,
    x2: null,
    xChannelSelector: null,
    xHeight: z,
    y: null,
    y1: null,
    y2: null,
    yChannelSelector: null,
    z: null,
    zoomAndPan: null
  },
  space: "svg",
  transform: zd
}), bd = sr({
  properties: {
    xLinkActuate: null,
    xLinkArcRole: null,
    xLinkHref: null,
    xLinkRole: null,
    xLinkShow: null,
    xLinkTitle: null,
    xLinkType: null
  },
  space: "xlink",
  transform(e, t) {
    return "xlink:" + t.slice(5).toLowerCase();
  }
}), Nd = sr({
  attributes: { xmlnsxlink: "xmlns:xlink" },
  properties: { xmlnsXLink: null, xmlns: null },
  space: "xmlns",
  transform: Ld
}), Ad = sr({
  properties: { xmlBase: null, xmlLang: null, xmlSpace: null },
  space: "xml",
  transform(e, t) {
    return "xml:" + t.slice(3).toLowerCase();
  }
}), Ey = {
  classId: "classID",
  dataType: "datatype",
  itemId: "itemID",
  strokeDashArray: "strokeDasharray",
  strokeDashOffset: "strokeDashoffset",
  strokeLineCap: "strokeLinecap",
  strokeLineJoin: "strokeLinejoin",
  strokeMiterLimit: "strokeMiterlimit",
  typeOf: "typeof",
  xLinkActuate: "xlinkActuate",
  xLinkArcRole: "xlinkArcrole",
  xLinkHref: "xlinkHref",
  xLinkRole: "xlinkRole",
  xLinkShow: "xlinkShow",
  xLinkTitle: "xlinkTitle",
  xLinkType: "xlinkType",
  xmlnsXLink: "xmlnsXlink"
}, Ty = /[A-Z]/g, gc = /-[a-z]/g, _y = /^data[-\w.:]+$/i;
function Iy(e, t) {
  const n = _u(t);
  let r = t, i = Ue;
  if (n in e.normal)
    return e.property[e.normal[n]];
  if (n.length > 4 && n.slice(0, 4) === "data" && _y.test(t)) {
    if (t.charAt(4) === "-") {
      const l = t.slice(5).replace(gc, zy);
      r = "data" + l.charAt(0).toUpperCase() + l.slice(1);
    } else {
      const l = t.slice(4);
      if (!gc.test(l)) {
        let o = l.replace(Ty, Py);
        o.charAt(0) !== "-" && (o = "-" + o), t = "data" + o;
      }
    }
    i = Ds;
  }
  return new i(r, t);
}
function Py(e) {
  return "-" + e.toLowerCase();
}
function zy(e) {
  return e.charAt(1).toUpperCase();
}
const Ly = Id([Pd, Sy, bd, Nd, Ad], "html"), Rs = Id([Pd, Cy, bd, Nd, Ad], "svg");
function by(e) {
  return e.join(" ").trim();
}
var Fs = {}, yc = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, Ny = /\n/g, Ay = /^\s*/, Dy = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/, Ry = /^:\s*/, Fy = /^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/, Oy = /^[;\s]*/, My = /^\s+|\s+$/g, jy = `
`, kc = "/", vc = "*", fn = "", By = "comment", Uy = "declaration";
function $y(e, t) {
  if (typeof e != "string")
    throw new TypeError("First argument must be a string");
  if (!e) return [];
  t = t || {};
  var n = 1, r = 1;
  function i(g) {
    var x = g.match(Ny);
    x && (n += x.length);
    var T = g.lastIndexOf(jy);
    r = ~T ? g.length - T : r + g.length;
  }
  function l() {
    var g = { line: n, column: r };
    return function(x) {
      return x.position = new o(g), a(), x;
    };
  }
  function o(g) {
    this.start = g, this.end = { line: n, column: r }, this.source = t.source;
  }
  o.prototype.content = e;
  function u(g) {
    var x = new Error(
      t.source + ":" + n + ":" + r + ": " + g
    );
    if (x.reason = g, x.filename = t.source, x.line = n, x.column = r, x.source = e, !t.silent) throw x;
  }
  function s(g) {
    var x = g.exec(e);
    if (x) {
      var T = x[0];
      return i(T), e = e.slice(T.length), x;
    }
  }
  function a() {
    s(Ay);
  }
  function f(g) {
    var x;
    for (g = g || []; x = c(); )
      x !== !1 && g.push(x);
    return g;
  }
  function c() {
    var g = l();
    if (!(kc != e.charAt(0) || vc != e.charAt(1))) {
      for (var x = 2; fn != e.charAt(x) && (vc != e.charAt(x) || kc != e.charAt(x + 1)); )
        ++x;
      if (x += 2, fn === e.charAt(x - 1))
        return u("End of comment missing");
      var T = e.slice(2, x - 2);
      return r += 2, i(T), e = e.slice(x), r += 2, g({
        type: By,
        comment: T
      });
    }
  }
  function p() {
    var g = l(), x = s(Dy);
    if (x) {
      if (c(), !s(Ry)) return u("property missing ':'");
      var T = s(Fy), h = g({
        type: Uy,
        property: xc(x[0].replace(yc, fn)),
        value: T ? xc(T[0].replace(yc, fn)) : fn
      });
      return s(Oy), h;
    }
  }
  function d() {
    var g = [];
    f(g);
    for (var x; x = p(); )
      x !== !1 && (g.push(x), f(g));
    return g;
  }
  return a(), d();
}
function xc(e) {
  return e ? e.replace(My, fn) : fn;
}
var Hy = $y, Vy = qi && qi.__importDefault || function(e) {
  return e && e.__esModule ? e : { default: e };
};
Object.defineProperty(Fs, "__esModule", { value: !0 });
Fs.default = Qy;
const Wy = Vy(Hy);
function Qy(e, t) {
  let n = null;
  if (!e || typeof e != "string")
    return n;
  const r = (0, Wy.default)(e), i = typeof t == "function";
  return r.forEach((l) => {
    if (l.type !== "declaration")
      return;
    const { property: o, value: u } = l;
    i ? t(o, u, l) : u && (n = n || {}, n[o] = u);
  }), n;
}
var jl = {};
Object.defineProperty(jl, "__esModule", { value: !0 });
jl.camelCase = void 0;
var Ky = /^--[a-zA-Z0-9_-]+$/, qy = /-([a-z])/g, Yy = /^[^-]+$/, Xy = /^-(webkit|moz|ms|o|khtml)-/, Gy = /^-(ms)-/, Zy = function(e) {
  return !e || Yy.test(e) || Ky.test(e);
}, Jy = function(e, t) {
  return t.toUpperCase();
}, wc = function(e, t) {
  return "".concat(t, "-");
}, e1 = function(e, t) {
  return t === void 0 && (t = {}), Zy(e) ? e : (e = e.toLowerCase(), t.reactCompat ? e = e.replace(Gy, wc) : e = e.replace(Xy, wc), e.replace(qy, Jy));
};
jl.camelCase = e1;
var t1 = qi && qi.__importDefault || function(e) {
  return e && e.__esModule ? e : { default: e };
}, n1 = t1(Fs), r1 = jl;
function zu(e, t) {
  var n = {};
  return !e || typeof e != "string" || (0, n1.default)(e, function(r, i) {
    r && i && (n[(0, r1.camelCase)(r, t)] = i);
  }), n;
}
zu.default = zu;
var i1 = zu;
const l1 = /* @__PURE__ */ df(i1), Dd = Rd("end"), Os = Rd("start");
function Rd(e) {
  return t;
  function t(n) {
    const r = n && n.position && n.position[e] || {};
    if (typeof r.line == "number" && r.line > 0 && typeof r.column == "number" && r.column > 0)
      return {
        line: r.line,
        column: r.column,
        offset: typeof r.offset == "number" && r.offset > -1 ? r.offset : void 0
      };
  }
}
function o1(e) {
  const t = Os(e), n = Dd(e);
  if (t && n)
    return { start: t, end: n };
}
function Fr(e) {
  return !e || typeof e != "object" ? "" : "position" in e || "type" in e ? Sc(e.position) : "start" in e || "end" in e ? Sc(e) : "line" in e || "column" in e ? Lu(e) : "";
}
function Lu(e) {
  return Cc(e && e.line) + ":" + Cc(e && e.column);
}
function Sc(e) {
  return Lu(e && e.start) + "-" + Lu(e && e.end);
}
function Cc(e) {
  return e && typeof e == "number" ? e : 1;
}
class ze extends Error {
  /**
   * Create a message for `reason`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {Options | null | undefined} [options]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | Options | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // eslint-disable-next-line complexity
  constructor(t, n, r) {
    super(), typeof n == "string" && (r = n, n = void 0);
    let i = "", l = {}, o = !1;
    if (n && ("line" in n && "column" in n ? l = { place: n } : "start" in n && "end" in n ? l = { place: n } : "type" in n ? l = {
      ancestors: [n],
      place: n.position
    } : l = { ...n }), typeof t == "string" ? i = t : !l.cause && t && (o = !0, i = t.message, l.cause = t), !l.ruleId && !l.source && typeof r == "string") {
      const s = r.indexOf(":");
      s === -1 ? l.ruleId = r : (l.source = r.slice(0, s), l.ruleId = r.slice(s + 1));
    }
    if (!l.place && l.ancestors && l.ancestors) {
      const s = l.ancestors[l.ancestors.length - 1];
      s && (l.place = s.position);
    }
    const u = l.place && "start" in l.place ? l.place.start : l.place;
    this.ancestors = l.ancestors || void 0, this.cause = l.cause || void 0, this.column = u ? u.column : void 0, this.fatal = void 0, this.file = "", this.message = i, this.line = u ? u.line : void 0, this.name = Fr(l.place) || "1:1", this.place = l.place || void 0, this.reason = this.message, this.ruleId = l.ruleId || void 0, this.source = l.source || void 0, this.stack = o && l.cause && typeof l.cause.stack == "string" ? l.cause.stack : "", this.actual = void 0, this.expected = void 0, this.note = void 0, this.url = void 0;
  }
}
ze.prototype.file = "";
ze.prototype.name = "";
ze.prototype.reason = "";
ze.prototype.message = "";
ze.prototype.stack = "";
ze.prototype.column = void 0;
ze.prototype.line = void 0;
ze.prototype.ancestors = void 0;
ze.prototype.cause = void 0;
ze.prototype.fatal = void 0;
ze.prototype.place = void 0;
ze.prototype.ruleId = void 0;
ze.prototype.source = void 0;
const Ms = {}.hasOwnProperty, u1 = /* @__PURE__ */ new Map(), s1 = /[A-Z]/g, a1 = /* @__PURE__ */ new Set(["table", "tbody", "thead", "tfoot", "tr"]), c1 = /* @__PURE__ */ new Set(["td", "th"]), Fd = "https://github.com/syntax-tree/hast-util-to-jsx-runtime";
function f1(e, t) {
  if (!t || t.Fragment === void 0)
    throw new TypeError("Expected `Fragment` in options");
  const n = t.filePath || void 0;
  let r;
  if (t.development) {
    if (typeof t.jsxDEV != "function")
      throw new TypeError(
        "Expected `jsxDEV` in options when `development: true`"
      );
    r = v1(n, t.jsxDEV);
  } else {
    if (typeof t.jsx != "function")
      throw new TypeError("Expected `jsx` in production options");
    if (typeof t.jsxs != "function")
      throw new TypeError("Expected `jsxs` in production options");
    r = k1(n, t.jsx, t.jsxs);
  }
  const i = {
    Fragment: t.Fragment,
    ancestors: [],
    components: t.components || {},
    create: r,
    elementAttributeNameCase: t.elementAttributeNameCase || "react",
    evaluater: t.createEvaluater ? t.createEvaluater() : void 0,
    filePath: n,
    ignoreInvalidStyle: t.ignoreInvalidStyle || !1,
    passKeys: t.passKeys !== !1,
    passNode: t.passNode || !1,
    schema: t.space === "svg" ? Rs : Ly,
    stylePropertyNameCase: t.stylePropertyNameCase || "dom",
    tableCellAlignToStyle: t.tableCellAlignToStyle !== !1
  }, l = Od(i, e, void 0);
  return l && typeof l != "string" ? l : i.create(
    e,
    i.Fragment,
    { children: l || void 0 },
    void 0
  );
}
function Od(e, t, n) {
  if (t.type === "element")
    return p1(e, t, n);
  if (t.type === "mdxFlowExpression" || t.type === "mdxTextExpression")
    return d1(e, t);
  if (t.type === "mdxJsxFlowElement" || t.type === "mdxJsxTextElement")
    return m1(e, t, n);
  if (t.type === "mdxjsEsm")
    return h1(e, t);
  if (t.type === "root")
    return g1(e, t, n);
  if (t.type === "text")
    return y1(e, t);
}
function p1(e, t, n) {
  const r = e.schema;
  let i = r;
  t.tagName.toLowerCase() === "svg" && r.space === "html" && (i = Rs, e.schema = i), e.ancestors.push(t);
  const l = jd(e, t.tagName, !1), o = x1(e, t);
  let u = Bs(e, t);
  return a1.has(t.tagName) && (u = u.filter(function(s) {
    return typeof s == "string" ? !xy(s) : !0;
  })), Md(e, o, l, t), js(o, u), e.ancestors.pop(), e.schema = r, e.create(t, l, o, n);
}
function d1(e, t) {
  if (t.data && t.data.estree && e.evaluater) {
    const r = t.data.estree.body[0];
    return r.type, /** @type {Child | undefined} */
    e.evaluater.evaluateExpression(r.expression);
  }
  ni(e, t.position);
}
function h1(e, t) {
  if (t.data && t.data.estree && e.evaluater)
    return (
      /** @type {Child | undefined} */
      e.evaluater.evaluateProgram(t.data.estree)
    );
  ni(e, t.position);
}
function m1(e, t, n) {
  const r = e.schema;
  let i = r;
  t.name === "svg" && r.space === "html" && (i = Rs, e.schema = i), e.ancestors.push(t);
  const l = t.name === null ? e.Fragment : jd(e, t.name, !0), o = w1(e, t), u = Bs(e, t);
  return Md(e, o, l, t), js(o, u), e.ancestors.pop(), e.schema = r, e.create(t, l, o, n);
}
function g1(e, t, n) {
  const r = {};
  return js(r, Bs(e, t)), e.create(t, e.Fragment, r, n);
}
function y1(e, t) {
  return t.value;
}
function Md(e, t, n, r) {
  typeof n != "string" && n !== e.Fragment && e.passNode && (t.node = r);
}
function js(e, t) {
  if (t.length > 0) {
    const n = t.length > 1 ? t : t[0];
    n && (e.children = n);
  }
}
function k1(e, t, n) {
  return r;
  function r(i, l, o, u) {
    const a = Array.isArray(o.children) ? n : t;
    return u ? a(l, o, u) : a(l, o);
  }
}
function v1(e, t) {
  return n;
  function n(r, i, l, o) {
    const u = Array.isArray(l.children), s = Os(r);
    return t(
      i,
      l,
      o,
      u,
      {
        columnNumber: s ? s.column - 1 : void 0,
        fileName: e,
        lineNumber: s ? s.line : void 0
      },
      void 0
    );
  }
}
function x1(e, t) {
  const n = {};
  let r, i;
  for (i in t.properties)
    if (i !== "children" && Ms.call(t.properties, i)) {
      const l = S1(e, i, t.properties[i]);
      if (l) {
        const [o, u] = l;
        e.tableCellAlignToStyle && o === "align" && typeof u == "string" && c1.has(t.tagName) ? r = u : n[o] = u;
      }
    }
  if (r) {
    const l = (
      /** @type {Style} */
      n.style || (n.style = {})
    );
    l[e.stylePropertyNameCase === "css" ? "text-align" : "textAlign"] = r;
  }
  return n;
}
function w1(e, t) {
  const n = {};
  for (const r of t.attributes)
    if (r.type === "mdxJsxExpressionAttribute")
      if (r.data && r.data.estree && e.evaluater) {
        const l = r.data.estree.body[0];
        l.type;
        const o = l.expression;
        o.type;
        const u = o.properties[0];
        u.type, Object.assign(
          n,
          e.evaluater.evaluateExpression(u.argument)
        );
      } else
        ni(e, t.position);
    else {
      const i = r.name;
      let l;
      if (r.value && typeof r.value == "object")
        if (r.value.data && r.value.data.estree && e.evaluater) {
          const u = r.value.data.estree.body[0];
          u.type, l = e.evaluater.evaluateExpression(u.expression);
        } else
          ni(e, t.position);
      else
        l = r.value === null ? !0 : r.value;
      n[i] = /** @type {Props[keyof Props]} */
      l;
    }
  return n;
}
function Bs(e, t) {
  const n = [];
  let r = -1;
  const i = e.passKeys ? /* @__PURE__ */ new Map() : u1;
  for (; ++r < t.children.length; ) {
    const l = t.children[r];
    let o;
    if (e.passKeys) {
      const s = l.type === "element" ? l.tagName : l.type === "mdxJsxFlowElement" || l.type === "mdxJsxTextElement" ? l.name : void 0;
      if (s) {
        const a = i.get(s) || 0;
        o = s + "-" + a, i.set(s, a + 1);
      }
    }
    const u = Od(e, l, o);
    u !== void 0 && n.push(u);
  }
  return n;
}
function S1(e, t, n) {
  const r = Iy(e.schema, t);
  if (!(n == null || typeof n == "number" && Number.isNaN(n))) {
    if (Array.isArray(n) && (n = r.commaSeparated ? my(n) : by(n)), r.property === "style") {
      let i = typeof n == "object" ? n : C1(e, String(n));
      return e.stylePropertyNameCase === "css" && (i = E1(i)), ["style", i];
    }
    return [
      e.elementAttributeNameCase === "react" && r.space ? Ey[r.property] || r.property : r.attribute,
      n
    ];
  }
}
function C1(e, t) {
  try {
    return l1(t, { reactCompat: !0 });
  } catch (n) {
    if (e.ignoreInvalidStyle)
      return {};
    const r = (
      /** @type {Error} */
      n
    ), i = new ze("Cannot parse `style` attribute", {
      ancestors: e.ancestors,
      cause: r,
      ruleId: "style",
      source: "hast-util-to-jsx-runtime"
    });
    throw i.file = e.filePath || void 0, i.url = Fd + "#cannot-parse-style-attribute", i;
  }
}
function jd(e, t, n) {
  let r;
  if (!n)
    r = { type: "Literal", value: t };
  else if (t.includes(".")) {
    const i = t.split(".");
    let l = -1, o;
    for (; ++l < i.length; ) {
      const u = dc(i[l]) ? { type: "Identifier", name: i[l] } : { type: "Literal", value: i[l] };
      o = o ? {
        type: "MemberExpression",
        object: o,
        property: u,
        computed: !!(l && u.type === "Literal"),
        optional: !1
      } : u;
    }
    r = o;
  } else
    r = dc(t) && !/^[a-z]/.test(t) ? { type: "Identifier", name: t } : { type: "Literal", value: t };
  if (r.type === "Literal") {
    const i = (
      /** @type {string | number} */
      r.value
    );
    return Ms.call(e.components, i) ? e.components[i] : i;
  }
  if (e.evaluater)
    return e.evaluater.evaluateExpression(r);
  ni(e);
}
function ni(e, t) {
  const n = new ze(
    "Cannot handle MDX estrees without `createEvaluater`",
    {
      ancestors: e.ancestors,
      place: t,
      ruleId: "mdx-estree",
      source: "hast-util-to-jsx-runtime"
    }
  );
  throw n.file = e.filePath || void 0, n.url = Fd + "#cannot-handle-mdx-estrees-without-createevaluater", n;
}
function E1(e) {
  const t = {};
  let n;
  for (n in e)
    Ms.call(e, n) && (t[T1(n)] = e[n]);
  return t;
}
function T1(e) {
  let t = e.replace(s1, _1);
  return t.slice(0, 3) === "ms-" && (t = "-" + t), t;
}
function _1(e) {
  return "-" + e.toLowerCase();
}
const vo = {
  action: ["form"],
  cite: ["blockquote", "del", "ins", "q"],
  data: ["object"],
  formAction: ["button", "input"],
  href: ["a", "area", "base", "link"],
  icon: ["menuitem"],
  itemId: null,
  manifest: ["html"],
  ping: ["a", "area"],
  poster: ["video"],
  src: [
    "audio",
    "embed",
    "iframe",
    "img",
    "input",
    "script",
    "source",
    "track",
    "video"
  ]
}, I1 = {};
function Us(e, t) {
  const n = I1, r = typeof n.includeImageAlt == "boolean" ? n.includeImageAlt : !0, i = typeof n.includeHtml == "boolean" ? n.includeHtml : !0;
  return Bd(e, r, i);
}
function Bd(e, t, n) {
  if (P1(e)) {
    if ("value" in e)
      return e.type === "html" && !n ? "" : e.value;
    if (t && "alt" in e && e.alt)
      return e.alt;
    if ("children" in e)
      return Ec(e.children, t, n);
  }
  return Array.isArray(e) ? Ec(e, t, n) : "";
}
function Ec(e, t, n) {
  const r = [];
  let i = -1;
  for (; ++i < e.length; )
    r[i] = Bd(e[i], t, n);
  return r.join("");
}
function P1(e) {
  return !!(e && typeof e == "object");
}
const Tc = document.createElement("i");
function $s(e) {
  const t = "&" + e + ";";
  Tc.innerHTML = t;
  const n = Tc.textContent;
  return n.charCodeAt(n.length - 1) === 59 && e !== "semi" || n === t ? !1 : n;
}
function qe(e, t, n, r) {
  const i = e.length;
  let l = 0, o;
  if (t < 0 ? t = -t > i ? 0 : i + t : t = t > i ? i : t, n = n > 0 ? n : 0, r.length < 1e4)
    o = Array.from(r), o.unshift(t, n), e.splice(...o);
  else
    for (n && e.splice(t, n); l < r.length; )
      o = r.slice(l, l + 1e4), o.unshift(t, 0), e.splice(...o), l += 1e4, t += 1e4;
}
function et(e, t) {
  return e.length > 0 ? (qe(e, e.length, 0, t), e) : t;
}
const _c = {}.hasOwnProperty;
function Ud(e) {
  const t = {};
  let n = -1;
  for (; ++n < e.length; )
    z1(t, e[n]);
  return t;
}
function z1(e, t) {
  let n;
  for (n in t) {
    const i = (_c.call(e, n) ? e[n] : void 0) || (e[n] = {}), l = t[n];
    let o;
    if (l)
      for (o in l) {
        _c.call(i, o) || (i[o] = []);
        const u = l[o];
        L1(
          // @ts-expect-error Looks like a list.
          i[o],
          Array.isArray(u) ? u : u ? [u] : []
        );
      }
  }
}
function L1(e, t) {
  let n = -1;
  const r = [];
  for (; ++n < t.length; )
    (t[n].add === "after" ? e : r).push(t[n]);
  qe(e, 0, 0, r);
}
function $d(e, t) {
  const n = Number.parseInt(e, t);
  return (
    // C0 except for HT, LF, FF, CR, space.
    n < 9 || n === 11 || n > 13 && n < 32 || // Control character (DEL) of C0, and C1 controls.
    n > 126 && n < 160 || // Lone high surrogates and low surrogates.
    n > 55295 && n < 57344 || // Noncharacters.
    n > 64975 && n < 65008 || /* eslint-disable no-bitwise */
    (n & 65535) === 65535 || (n & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    n > 1114111 ? "�" : String.fromCodePoint(n)
  );
}
function dt(e) {
  return e.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}
const be = ln(/[A-Za-z]/), Ie = ln(/[\dA-Za-z]/), b1 = ln(/[#-'*+\--9=?A-Z^-~]/);
function vl(e) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    e !== null && (e < 32 || e === 127)
  );
}
const bu = ln(/\d/), N1 = ln(/[\dA-Fa-f]/), A1 = ln(/[!-/:-@[-`{-~]/);
function O(e) {
  return e !== null && e < -2;
}
function J(e) {
  return e !== null && (e < 0 || e === 32);
}
function $(e) {
  return e === -2 || e === -1 || e === 32;
}
const Bl = ln(/\p{P}|\p{S}/u), Sn = ln(/\s/);
function ln(e) {
  return t;
  function t(n) {
    return n !== null && n > -1 && e.test(String.fromCharCode(n));
  }
}
function ar(e) {
  const t = [];
  let n = -1, r = 0, i = 0;
  for (; ++n < e.length; ) {
    const l = e.charCodeAt(n);
    let o = "";
    if (l === 37 && Ie(e.charCodeAt(n + 1)) && Ie(e.charCodeAt(n + 2)))
      i = 2;
    else if (l < 128)
      /[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(l)) || (o = String.fromCharCode(l));
    else if (l > 55295 && l < 57344) {
      const u = e.charCodeAt(n + 1);
      l < 56320 && u > 56319 && u < 57344 ? (o = String.fromCharCode(l, u), i = 1) : o = "�";
    } else
      o = String.fromCharCode(l);
    o && (t.push(e.slice(r, n), encodeURIComponent(o)), r = n + i + 1, o = ""), i && (n += i, i = 0);
  }
  return t.join("") + e.slice(r);
}
function Q(e, t, n, r) {
  const i = r ? r - 1 : Number.POSITIVE_INFINITY;
  let l = 0;
  return o;
  function o(s) {
    return $(s) ? (e.enter(n), u(s)) : t(s);
  }
  function u(s) {
    return $(s) && l++ < i ? (e.consume(s), u) : (e.exit(n), t(s));
  }
}
const D1 = {
  tokenize: R1
};
function R1(e) {
  const t = e.attempt(this.parser.constructs.contentInitial, r, i);
  let n;
  return t;
  function r(u) {
    if (u === null) {
      e.consume(u);
      return;
    }
    return e.enter("lineEnding"), e.consume(u), e.exit("lineEnding"), Q(e, t, "linePrefix");
  }
  function i(u) {
    return e.enter("paragraph"), l(u);
  }
  function l(u) {
    const s = e.enter("chunkText", {
      contentType: "text",
      previous: n
    });
    return n && (n.next = s), n = s, o(u);
  }
  function o(u) {
    if (u === null) {
      e.exit("chunkText"), e.exit("paragraph"), e.consume(u);
      return;
    }
    return O(u) ? (e.consume(u), e.exit("chunkText"), l) : (e.consume(u), o);
  }
}
const F1 = {
  tokenize: O1
}, Ic = {
  tokenize: M1
};
function O1(e) {
  const t = this, n = [];
  let r = 0, i, l, o;
  return u;
  function u(y) {
    if (r < n.length) {
      const C = n[r];
      return t.containerState = C[1], e.attempt(C[0].continuation, s, a)(y);
    }
    return a(y);
  }
  function s(y) {
    if (r++, t.containerState._closeFlow) {
      t.containerState._closeFlow = void 0, i && m();
      const C = t.events.length;
      let _ = C, w;
      for (; _--; )
        if (t.events[_][0] === "exit" && t.events[_][1].type === "chunkFlow") {
          w = t.events[_][1].end;
          break;
        }
      h(r);
      let P = C;
      for (; P < t.events.length; )
        t.events[P][1].end = {
          ...w
        }, P++;
      return qe(t.events, _ + 1, 0, t.events.slice(C)), t.events.length = P, a(y);
    }
    return u(y);
  }
  function a(y) {
    if (r === n.length) {
      if (!i)
        return p(y);
      if (i.currentConstruct && i.currentConstruct.concrete)
        return g(y);
      t.interrupt = !!(i.currentConstruct && !i._gfmTableDynamicInterruptHack);
    }
    return t.containerState = {}, e.check(Ic, f, c)(y);
  }
  function f(y) {
    return i && m(), h(r), p(y);
  }
  function c(y) {
    return t.parser.lazy[t.now().line] = r !== n.length, o = t.now().offset, g(y);
  }
  function p(y) {
    return t.containerState = {}, e.attempt(Ic, d, g)(y);
  }
  function d(y) {
    return r++, n.push([t.currentConstruct, t.containerState]), p(y);
  }
  function g(y) {
    if (y === null) {
      i && m(), h(0), e.consume(y);
      return;
    }
    return i = i || t.parser.flow(t.now()), e.enter("chunkFlow", {
      _tokenizer: i,
      contentType: "flow",
      previous: l
    }), x(y);
  }
  function x(y) {
    if (y === null) {
      T(e.exit("chunkFlow"), !0), h(0), e.consume(y);
      return;
    }
    return O(y) ? (e.consume(y), T(e.exit("chunkFlow")), r = 0, t.interrupt = void 0, u) : (e.consume(y), x);
  }
  function T(y, C) {
    const _ = t.sliceStream(y);
    if (C && _.push(null), y.previous = l, l && (l.next = y), l = y, i.defineSkip(y.start), i.write(_), t.parser.lazy[y.start.line]) {
      let w = i.events.length;
      for (; w--; )
        if (
          // The token starts before the line ending…
          i.events[w][1].start.offset < o && // …and either is not ended yet…
          (!i.events[w][1].end || // …or ends after it.
          i.events[w][1].end.offset > o)
        )
          return;
      const P = t.events.length;
      let L = P, M, S;
      for (; L--; )
        if (t.events[L][0] === "exit" && t.events[L][1].type === "chunkFlow") {
          if (M) {
            S = t.events[L][1].end;
            break;
          }
          M = !0;
        }
      for (h(r), w = P; w < t.events.length; )
        t.events[w][1].end = {
          ...S
        }, w++;
      qe(t.events, L + 1, 0, t.events.slice(P)), t.events.length = w;
    }
  }
  function h(y) {
    let C = n.length;
    for (; C-- > y; ) {
      const _ = n[C];
      t.containerState = _[1], _[0].exit.call(t, e);
    }
    n.length = y;
  }
  function m() {
    i.write([null]), l = void 0, i = void 0, t.containerState._closeFlow = void 0;
  }
}
function M1(e, t, n) {
  return Q(e, e.attempt(this.parser.constructs.document, t, n), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}
function ir(e) {
  if (e === null || J(e) || Sn(e))
    return 1;
  if (Bl(e))
    return 2;
}
function Ul(e, t, n) {
  const r = [];
  let i = -1;
  for (; ++i < e.length; ) {
    const l = e[i].resolveAll;
    l && !r.includes(l) && (t = l(t, n), r.push(l));
  }
  return t;
}
const Nu = {
  name: "attention",
  resolveAll: j1,
  tokenize: B1
};
function j1(e, t) {
  let n = -1, r, i, l, o, u, s, a, f;
  for (; ++n < e.length; )
    if (e[n][0] === "enter" && e[n][1].type === "attentionSequence" && e[n][1]._close) {
      for (r = n; r--; )
        if (e[r][0] === "exit" && e[r][1].type === "attentionSequence" && e[r][1]._open && // If the markers are the same:
        t.sliceSerialize(e[r][1]).charCodeAt(0) === t.sliceSerialize(e[n][1]).charCodeAt(0)) {
          if ((e[r][1]._close || e[n][1]._open) && (e[n][1].end.offset - e[n][1].start.offset) % 3 && !((e[r][1].end.offset - e[r][1].start.offset + e[n][1].end.offset - e[n][1].start.offset) % 3))
            continue;
          s = e[r][1].end.offset - e[r][1].start.offset > 1 && e[n][1].end.offset - e[n][1].start.offset > 1 ? 2 : 1;
          const c = {
            ...e[r][1].end
          }, p = {
            ...e[n][1].start
          };
          Pc(c, -s), Pc(p, s), o = {
            type: s > 1 ? "strongSequence" : "emphasisSequence",
            start: c,
            end: {
              ...e[r][1].end
            }
          }, u = {
            type: s > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...e[n][1].start
            },
            end: p
          }, l = {
            type: s > 1 ? "strongText" : "emphasisText",
            start: {
              ...e[r][1].end
            },
            end: {
              ...e[n][1].start
            }
          }, i = {
            type: s > 1 ? "strong" : "emphasis",
            start: {
              ...o.start
            },
            end: {
              ...u.end
            }
          }, e[r][1].end = {
            ...o.start
          }, e[n][1].start = {
            ...u.end
          }, a = [], e[r][1].end.offset - e[r][1].start.offset && (a = et(a, [["enter", e[r][1], t], ["exit", e[r][1], t]])), a = et(a, [["enter", i, t], ["enter", o, t], ["exit", o, t], ["enter", l, t]]), a = et(a, Ul(t.parser.constructs.insideSpan.null, e.slice(r + 1, n), t)), a = et(a, [["exit", l, t], ["enter", u, t], ["exit", u, t], ["exit", i, t]]), e[n][1].end.offset - e[n][1].start.offset ? (f = 2, a = et(a, [["enter", e[n][1], t], ["exit", e[n][1], t]])) : f = 0, qe(e, r - 1, n - r + 3, a), n = r + a.length - f - 2;
          break;
        }
    }
  for (n = -1; ++n < e.length; )
    e[n][1].type === "attentionSequence" && (e[n][1].type = "data");
  return e;
}
function B1(e, t) {
  const n = this.parser.constructs.attentionMarkers.null, r = this.previous, i = ir(r);
  let l;
  return o;
  function o(s) {
    return l = s, e.enter("attentionSequence"), u(s);
  }
  function u(s) {
    if (s === l)
      return e.consume(s), u;
    const a = e.exit("attentionSequence"), f = ir(s), c = !f || f === 2 && i || n.includes(s), p = !i || i === 2 && f || n.includes(r);
    return a._open = !!(l === 42 ? c : c && (i || !p)), a._close = !!(l === 42 ? p : p && (f || !c)), t(s);
  }
}
function Pc(e, t) {
  e.column += t, e.offset += t, e._bufferIndex += t;
}
const U1 = {
  name: "autolink",
  tokenize: $1
};
function $1(e, t, n) {
  let r = 0;
  return i;
  function i(d) {
    return e.enter("autolink"), e.enter("autolinkMarker"), e.consume(d), e.exit("autolinkMarker"), e.enter("autolinkProtocol"), l;
  }
  function l(d) {
    return be(d) ? (e.consume(d), o) : d === 64 ? n(d) : a(d);
  }
  function o(d) {
    return d === 43 || d === 45 || d === 46 || Ie(d) ? (r = 1, u(d)) : a(d);
  }
  function u(d) {
    return d === 58 ? (e.consume(d), r = 0, s) : (d === 43 || d === 45 || d === 46 || Ie(d)) && r++ < 32 ? (e.consume(d), u) : (r = 0, a(d));
  }
  function s(d) {
    return d === 62 ? (e.exit("autolinkProtocol"), e.enter("autolinkMarker"), e.consume(d), e.exit("autolinkMarker"), e.exit("autolink"), t) : d === null || d === 32 || d === 60 || vl(d) ? n(d) : (e.consume(d), s);
  }
  function a(d) {
    return d === 64 ? (e.consume(d), f) : b1(d) ? (e.consume(d), a) : n(d);
  }
  function f(d) {
    return Ie(d) ? c(d) : n(d);
  }
  function c(d) {
    return d === 46 ? (e.consume(d), r = 0, f) : d === 62 ? (e.exit("autolinkProtocol").type = "autolinkEmail", e.enter("autolinkMarker"), e.consume(d), e.exit("autolinkMarker"), e.exit("autolink"), t) : p(d);
  }
  function p(d) {
    if ((d === 45 || Ie(d)) && r++ < 63) {
      const g = d === 45 ? p : c;
      return e.consume(d), g;
    }
    return n(d);
  }
}
const ci = {
  partial: !0,
  tokenize: H1
};
function H1(e, t, n) {
  return r;
  function r(l) {
    return $(l) ? Q(e, i, "linePrefix")(l) : i(l);
  }
  function i(l) {
    return l === null || O(l) ? t(l) : n(l);
  }
}
const Hd = {
  continuation: {
    tokenize: W1
  },
  exit: Q1,
  name: "blockQuote",
  tokenize: V1
};
function V1(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    if (o === 62) {
      const u = r.containerState;
      return u.open || (e.enter("blockQuote", {
        _container: !0
      }), u.open = !0), e.enter("blockQuotePrefix"), e.enter("blockQuoteMarker"), e.consume(o), e.exit("blockQuoteMarker"), l;
    }
    return n(o);
  }
  function l(o) {
    return $(o) ? (e.enter("blockQuotePrefixWhitespace"), e.consume(o), e.exit("blockQuotePrefixWhitespace"), e.exit("blockQuotePrefix"), t) : (e.exit("blockQuotePrefix"), t(o));
  }
}
function W1(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    return $(o) ? Q(e, l, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(o) : l(o);
  }
  function l(o) {
    return e.attempt(Hd, t, n)(o);
  }
}
function Q1(e) {
  e.exit("blockQuote");
}
const Vd = {
  name: "characterEscape",
  tokenize: K1
};
function K1(e, t, n) {
  return r;
  function r(l) {
    return e.enter("characterEscape"), e.enter("escapeMarker"), e.consume(l), e.exit("escapeMarker"), i;
  }
  function i(l) {
    return A1(l) ? (e.enter("characterEscapeValue"), e.consume(l), e.exit("characterEscapeValue"), e.exit("characterEscape"), t) : n(l);
  }
}
const Wd = {
  name: "characterReference",
  tokenize: q1
};
function q1(e, t, n) {
  const r = this;
  let i = 0, l, o;
  return u;
  function u(c) {
    return e.enter("characterReference"), e.enter("characterReferenceMarker"), e.consume(c), e.exit("characterReferenceMarker"), s;
  }
  function s(c) {
    return c === 35 ? (e.enter("characterReferenceMarkerNumeric"), e.consume(c), e.exit("characterReferenceMarkerNumeric"), a) : (e.enter("characterReferenceValue"), l = 31, o = Ie, f(c));
  }
  function a(c) {
    return c === 88 || c === 120 ? (e.enter("characterReferenceMarkerHexadecimal"), e.consume(c), e.exit("characterReferenceMarkerHexadecimal"), e.enter("characterReferenceValue"), l = 6, o = N1, f) : (e.enter("characterReferenceValue"), l = 7, o = bu, f(c));
  }
  function f(c) {
    if (c === 59 && i) {
      const p = e.exit("characterReferenceValue");
      return o === Ie && !$s(r.sliceSerialize(p)) ? n(c) : (e.enter("characterReferenceMarker"), e.consume(c), e.exit("characterReferenceMarker"), e.exit("characterReference"), t);
    }
    return o(c) && i++ < l ? (e.consume(c), f) : n(c);
  }
}
const zc = {
  partial: !0,
  tokenize: X1
}, Lc = {
  concrete: !0,
  name: "codeFenced",
  tokenize: Y1
};
function Y1(e, t, n) {
  const r = this, i = {
    partial: !0,
    tokenize: _
  };
  let l = 0, o = 0, u;
  return s;
  function s(w) {
    return a(w);
  }
  function a(w) {
    const P = r.events[r.events.length - 1];
    return l = P && P[1].type === "linePrefix" ? P[2].sliceSerialize(P[1], !0).length : 0, u = w, e.enter("codeFenced"), e.enter("codeFencedFence"), e.enter("codeFencedFenceSequence"), f(w);
  }
  function f(w) {
    return w === u ? (o++, e.consume(w), f) : o < 3 ? n(w) : (e.exit("codeFencedFenceSequence"), $(w) ? Q(e, c, "whitespace")(w) : c(w));
  }
  function c(w) {
    return w === null || O(w) ? (e.exit("codeFencedFence"), r.interrupt ? t(w) : e.check(zc, x, C)(w)) : (e.enter("codeFencedFenceInfo"), e.enter("chunkString", {
      contentType: "string"
    }), p(w));
  }
  function p(w) {
    return w === null || O(w) ? (e.exit("chunkString"), e.exit("codeFencedFenceInfo"), c(w)) : $(w) ? (e.exit("chunkString"), e.exit("codeFencedFenceInfo"), Q(e, d, "whitespace")(w)) : w === 96 && w === u ? n(w) : (e.consume(w), p);
  }
  function d(w) {
    return w === null || O(w) ? c(w) : (e.enter("codeFencedFenceMeta"), e.enter("chunkString", {
      contentType: "string"
    }), g(w));
  }
  function g(w) {
    return w === null || O(w) ? (e.exit("chunkString"), e.exit("codeFencedFenceMeta"), c(w)) : w === 96 && w === u ? n(w) : (e.consume(w), g);
  }
  function x(w) {
    return e.attempt(i, C, T)(w);
  }
  function T(w) {
    return e.enter("lineEnding"), e.consume(w), e.exit("lineEnding"), h;
  }
  function h(w) {
    return l > 0 && $(w) ? Q(e, m, "linePrefix", l + 1)(w) : m(w);
  }
  function m(w) {
    return w === null || O(w) ? e.check(zc, x, C)(w) : (e.enter("codeFlowValue"), y(w));
  }
  function y(w) {
    return w === null || O(w) ? (e.exit("codeFlowValue"), m(w)) : (e.consume(w), y);
  }
  function C(w) {
    return e.exit("codeFenced"), t(w);
  }
  function _(w, P, L) {
    let M = 0;
    return S;
    function S(V) {
      return w.enter("lineEnding"), w.consume(V), w.exit("lineEnding"), A;
    }
    function A(V) {
      return w.enter("codeFencedFence"), $(V) ? Q(w, R, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(V) : R(V);
    }
    function R(V) {
      return V === u ? (w.enter("codeFencedFenceSequence"), K(V)) : L(V);
    }
    function K(V) {
      return V === u ? (M++, w.consume(V), K) : M >= o ? (w.exit("codeFencedFenceSequence"), $(V) ? Q(w, ee, "whitespace")(V) : ee(V)) : L(V);
    }
    function ee(V) {
      return V === null || O(V) ? (w.exit("codeFencedFence"), P(V)) : L(V);
    }
  }
}
function X1(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    return o === null ? n(o) : (e.enter("lineEnding"), e.consume(o), e.exit("lineEnding"), l);
  }
  function l(o) {
    return r.parser.lazy[r.now().line] ? n(o) : t(o);
  }
}
const xo = {
  name: "codeIndented",
  tokenize: Z1
}, G1 = {
  partial: !0,
  tokenize: J1
};
function Z1(e, t, n) {
  const r = this;
  return i;
  function i(a) {
    return e.enter("codeIndented"), Q(e, l, "linePrefix", 5)(a);
  }
  function l(a) {
    const f = r.events[r.events.length - 1];
    return f && f[1].type === "linePrefix" && f[2].sliceSerialize(f[1], !0).length >= 4 ? o(a) : n(a);
  }
  function o(a) {
    return a === null ? s(a) : O(a) ? e.attempt(G1, o, s)(a) : (e.enter("codeFlowValue"), u(a));
  }
  function u(a) {
    return a === null || O(a) ? (e.exit("codeFlowValue"), o(a)) : (e.consume(a), u);
  }
  function s(a) {
    return e.exit("codeIndented"), t(a);
  }
}
function J1(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    return r.parser.lazy[r.now().line] ? n(o) : O(o) ? (e.enter("lineEnding"), e.consume(o), e.exit("lineEnding"), i) : Q(e, l, "linePrefix", 5)(o);
  }
  function l(o) {
    const u = r.events[r.events.length - 1];
    return u && u[1].type === "linePrefix" && u[2].sliceSerialize(u[1], !0).length >= 4 ? t(o) : O(o) ? i(o) : n(o);
  }
}
const ek = {
  name: "codeText",
  previous: nk,
  resolve: tk,
  tokenize: rk
};
function tk(e) {
  let t = e.length - 4, n = 3, r, i;
  if ((e[n][1].type === "lineEnding" || e[n][1].type === "space") && (e[t][1].type === "lineEnding" || e[t][1].type === "space")) {
    for (r = n; ++r < t; )
      if (e[r][1].type === "codeTextData") {
        e[n][1].type = "codeTextPadding", e[t][1].type = "codeTextPadding", n += 2, t -= 2;
        break;
      }
  }
  for (r = n - 1, t++; ++r <= t; )
    i === void 0 ? r !== t && e[r][1].type !== "lineEnding" && (i = r) : (r === t || e[r][1].type === "lineEnding") && (e[i][1].type = "codeTextData", r !== i + 2 && (e[i][1].end = e[r - 1][1].end, e.splice(i + 2, r - i - 2), t -= r - i - 2, r = i + 2), i = void 0);
  return e;
}
function nk(e) {
  return e !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function rk(e, t, n) {
  let r = 0, i, l;
  return o;
  function o(c) {
    return e.enter("codeText"), e.enter("codeTextSequence"), u(c);
  }
  function u(c) {
    return c === 96 ? (e.consume(c), r++, u) : (e.exit("codeTextSequence"), s(c));
  }
  function s(c) {
    return c === null ? n(c) : c === 32 ? (e.enter("space"), e.consume(c), e.exit("space"), s) : c === 96 ? (l = e.enter("codeTextSequence"), i = 0, f(c)) : O(c) ? (e.enter("lineEnding"), e.consume(c), e.exit("lineEnding"), s) : (e.enter("codeTextData"), a(c));
  }
  function a(c) {
    return c === null || c === 32 || c === 96 || O(c) ? (e.exit("codeTextData"), s(c)) : (e.consume(c), a);
  }
  function f(c) {
    return c === 96 ? (e.consume(c), i++, f) : i === r ? (e.exit("codeTextSequence"), e.exit("codeText"), t(c)) : (l.type = "codeTextData", a(c));
  }
}
class ik {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(t) {
    this.left = t ? [...t] : [], this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(t) {
    if (t < 0 || t >= this.left.length + this.right.length)
      throw new RangeError("Cannot access index `" + t + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    return t < this.left.length ? this.left[t] : this.right[this.right.length - t + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    return this.setCursor(0), this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(t, n) {
    const r = n == null ? Number.POSITIVE_INFINITY : n;
    return r < this.left.length ? this.left.slice(t, r) : t > this.left.length ? this.right.slice(this.right.length - r + this.left.length, this.right.length - t + this.left.length).reverse() : this.left.slice(t).concat(this.right.slice(this.right.length - r + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(t, n, r) {
    const i = n || 0;
    this.setCursor(Math.trunc(t));
    const l = this.right.splice(this.right.length - i, Number.POSITIVE_INFINITY);
    return r && xr(this.left, r), l.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    return this.setCursor(Number.POSITIVE_INFINITY), this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(t) {
    this.setCursor(Number.POSITIVE_INFINITY), this.left.push(t);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(t) {
    this.setCursor(Number.POSITIVE_INFINITY), xr(this.left, t);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(t) {
    this.setCursor(0), this.right.push(t);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(t) {
    this.setCursor(0), xr(this.right, t.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(t) {
    if (!(t === this.left.length || t > this.left.length && this.right.length === 0 || t < 0 && this.left.length === 0))
      if (t < this.left.length) {
        const n = this.left.splice(t, Number.POSITIVE_INFINITY);
        xr(this.right, n.reverse());
      } else {
        const n = this.right.splice(this.left.length + this.right.length - t, Number.POSITIVE_INFINITY);
        xr(this.left, n.reverse());
      }
  }
}
function xr(e, t) {
  let n = 0;
  if (t.length < 1e4)
    e.push(...t);
  else
    for (; n < t.length; )
      e.push(...t.slice(n, n + 1e4)), n += 1e4;
}
function Qd(e) {
  const t = {};
  let n = -1, r, i, l, o, u, s, a;
  const f = new ik(e);
  for (; ++n < f.length; ) {
    for (; n in t; )
      n = t[n];
    if (r = f.get(n), n && r[1].type === "chunkFlow" && f.get(n - 1)[1].type === "listItemPrefix" && (s = r[1]._tokenizer.events, l = 0, l < s.length && s[l][1].type === "lineEndingBlank" && (l += 2), l < s.length && s[l][1].type === "content"))
      for (; ++l < s.length && s[l][1].type !== "content"; )
        s[l][1].type === "chunkText" && (s[l][1]._isInFirstContentOfListItem = !0, l++);
    if (r[0] === "enter")
      r[1].contentType && (Object.assign(t, lk(f, n)), n = t[n], a = !0);
    else if (r[1]._container) {
      for (l = n, i = void 0; l--; )
        if (o = f.get(l), o[1].type === "lineEnding" || o[1].type === "lineEndingBlank")
          o[0] === "enter" && (i && (f.get(i)[1].type = "lineEndingBlank"), o[1].type = "lineEnding", i = l);
        else if (!(o[1].type === "linePrefix" || o[1].type === "listItemIndent")) break;
      i && (r[1].end = {
        ...f.get(i)[1].start
      }, u = f.slice(i, n), u.unshift(r), f.splice(i, n - i + 1, u));
    }
  }
  return qe(e, 0, Number.POSITIVE_INFINITY, f.slice(0)), !a;
}
function lk(e, t) {
  const n = e.get(t)[1], r = e.get(t)[2];
  let i = t - 1;
  const l = [];
  let o = n._tokenizer;
  o || (o = r.parser[n.contentType](n.start), n._contentTypeTextTrailing && (o._contentTypeTextTrailing = !0));
  const u = o.events, s = [], a = {};
  let f, c, p = -1, d = n, g = 0, x = 0;
  const T = [x];
  for (; d; ) {
    for (; e.get(++i)[1] !== d; )
      ;
    l.push(i), d._tokenizer || (f = r.sliceStream(d), d.next || f.push(null), c && o.defineSkip(d.start), d._isInFirstContentOfListItem && (o._gfmTasklistFirstContentOfListItem = !0), o.write(f), d._isInFirstContentOfListItem && (o._gfmTasklistFirstContentOfListItem = void 0)), c = d, d = d.next;
  }
  for (d = n; ++p < u.length; )
    // Find a void token that includes a break.
    u[p][0] === "exit" && u[p - 1][0] === "enter" && u[p][1].type === u[p - 1][1].type && u[p][1].start.line !== u[p][1].end.line && (x = p + 1, T.push(x), d._tokenizer = void 0, d.previous = void 0, d = d.next);
  for (o.events = [], d ? (d._tokenizer = void 0, d.previous = void 0) : T.pop(), p = T.length; p--; ) {
    const h = u.slice(T[p], T[p + 1]), m = l.pop();
    s.push([m, m + h.length - 1]), e.splice(m, 2, h);
  }
  for (s.reverse(), p = -1; ++p < s.length; )
    a[g + s[p][0]] = g + s[p][1], g += s[p][1] - s[p][0] - 1;
  return a;
}
const ok = {
  resolve: sk,
  tokenize: ak
}, uk = {
  partial: !0,
  tokenize: ck
};
function sk(e) {
  return Qd(e), e;
}
function ak(e, t) {
  let n;
  return r;
  function r(u) {
    return e.enter("content"), n = e.enter("chunkContent", {
      contentType: "content"
    }), i(u);
  }
  function i(u) {
    return u === null ? l(u) : O(u) ? e.check(uk, o, l)(u) : (e.consume(u), i);
  }
  function l(u) {
    return e.exit("chunkContent"), e.exit("content"), t(u);
  }
  function o(u) {
    return e.consume(u), e.exit("chunkContent"), n.next = e.enter("chunkContent", {
      contentType: "content",
      previous: n
    }), n = n.next, i;
  }
}
function ck(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    return e.exit("chunkContent"), e.enter("lineEnding"), e.consume(o), e.exit("lineEnding"), Q(e, l, "linePrefix");
  }
  function l(o) {
    if (o === null || O(o))
      return n(o);
    const u = r.events[r.events.length - 1];
    return !r.parser.constructs.disable.null.includes("codeIndented") && u && u[1].type === "linePrefix" && u[2].sliceSerialize(u[1], !0).length >= 4 ? t(o) : e.interrupt(r.parser.constructs.flow, n, t)(o);
  }
}
function Kd(e, t, n, r, i, l, o, u, s) {
  const a = s || Number.POSITIVE_INFINITY;
  let f = 0;
  return c;
  function c(h) {
    return h === 60 ? (e.enter(r), e.enter(i), e.enter(l), e.consume(h), e.exit(l), p) : h === null || h === 32 || h === 41 || vl(h) ? n(h) : (e.enter(r), e.enter(o), e.enter(u), e.enter("chunkString", {
      contentType: "string"
    }), x(h));
  }
  function p(h) {
    return h === 62 ? (e.enter(l), e.consume(h), e.exit(l), e.exit(i), e.exit(r), t) : (e.enter(u), e.enter("chunkString", {
      contentType: "string"
    }), d(h));
  }
  function d(h) {
    return h === 62 ? (e.exit("chunkString"), e.exit(u), p(h)) : h === null || h === 60 || O(h) ? n(h) : (e.consume(h), h === 92 ? g : d);
  }
  function g(h) {
    return h === 60 || h === 62 || h === 92 ? (e.consume(h), d) : d(h);
  }
  function x(h) {
    return !f && (h === null || h === 41 || J(h)) ? (e.exit("chunkString"), e.exit(u), e.exit(o), e.exit(r), t(h)) : f < a && h === 40 ? (e.consume(h), f++, x) : h === 41 ? (e.consume(h), f--, x) : h === null || h === 32 || h === 40 || vl(h) ? n(h) : (e.consume(h), h === 92 ? T : x);
  }
  function T(h) {
    return h === 40 || h === 41 || h === 92 ? (e.consume(h), x) : x(h);
  }
}
function qd(e, t, n, r, i, l) {
  const o = this;
  let u = 0, s;
  return a;
  function a(d) {
    return e.enter(r), e.enter(i), e.consume(d), e.exit(i), e.enter(l), f;
  }
  function f(d) {
    return u > 999 || d === null || d === 91 || d === 93 && !s || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    d === 94 && !u && "_hiddenFootnoteSupport" in o.parser.constructs ? n(d) : d === 93 ? (e.exit(l), e.enter(i), e.consume(d), e.exit(i), e.exit(r), t) : O(d) ? (e.enter("lineEnding"), e.consume(d), e.exit("lineEnding"), f) : (e.enter("chunkString", {
      contentType: "string"
    }), c(d));
  }
  function c(d) {
    return d === null || d === 91 || d === 93 || O(d) || u++ > 999 ? (e.exit("chunkString"), f(d)) : (e.consume(d), s || (s = !$(d)), d === 92 ? p : c);
  }
  function p(d) {
    return d === 91 || d === 92 || d === 93 ? (e.consume(d), u++, c) : c(d);
  }
}
function Yd(e, t, n, r, i, l) {
  let o;
  return u;
  function u(p) {
    return p === 34 || p === 39 || p === 40 ? (e.enter(r), e.enter(i), e.consume(p), e.exit(i), o = p === 40 ? 41 : p, s) : n(p);
  }
  function s(p) {
    return p === o ? (e.enter(i), e.consume(p), e.exit(i), e.exit(r), t) : (e.enter(l), a(p));
  }
  function a(p) {
    return p === o ? (e.exit(l), s(o)) : p === null ? n(p) : O(p) ? (e.enter("lineEnding"), e.consume(p), e.exit("lineEnding"), Q(e, a, "linePrefix")) : (e.enter("chunkString", {
      contentType: "string"
    }), f(p));
  }
  function f(p) {
    return p === o || p === null || O(p) ? (e.exit("chunkString"), a(p)) : (e.consume(p), p === 92 ? c : f);
  }
  function c(p) {
    return p === o || p === 92 ? (e.consume(p), f) : f(p);
  }
}
function Or(e, t) {
  let n;
  return r;
  function r(i) {
    return O(i) ? (e.enter("lineEnding"), e.consume(i), e.exit("lineEnding"), n = !0, r) : $(i) ? Q(e, r, n ? "linePrefix" : "lineSuffix")(i) : t(i);
  }
}
const fk = {
  name: "definition",
  tokenize: dk
}, pk = {
  partial: !0,
  tokenize: hk
};
function dk(e, t, n) {
  const r = this;
  let i;
  return l;
  function l(d) {
    return e.enter("definition"), o(d);
  }
  function o(d) {
    return qd.call(
      r,
      e,
      u,
      // Note: we don’t need to reset the way `markdown-rs` does.
      n,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(d);
  }
  function u(d) {
    return i = dt(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1)), d === 58 ? (e.enter("definitionMarker"), e.consume(d), e.exit("definitionMarker"), s) : n(d);
  }
  function s(d) {
    return J(d) ? Or(e, a)(d) : a(d);
  }
  function a(d) {
    return Kd(
      e,
      f,
      // Note: we don’t need to reset the way `markdown-rs` does.
      n,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(d);
  }
  function f(d) {
    return e.attempt(pk, c, c)(d);
  }
  function c(d) {
    return $(d) ? Q(e, p, "whitespace")(d) : p(d);
  }
  function p(d) {
    return d === null || O(d) ? (e.exit("definition"), r.parser.defined.push(i), t(d)) : n(d);
  }
}
function hk(e, t, n) {
  return r;
  function r(u) {
    return J(u) ? Or(e, i)(u) : n(u);
  }
  function i(u) {
    return Yd(e, l, n, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(u);
  }
  function l(u) {
    return $(u) ? Q(e, o, "whitespace")(u) : o(u);
  }
  function o(u) {
    return u === null || O(u) ? t(u) : n(u);
  }
}
const mk = {
  name: "hardBreakEscape",
  tokenize: gk
};
function gk(e, t, n) {
  return r;
  function r(l) {
    return e.enter("hardBreakEscape"), e.consume(l), i;
  }
  function i(l) {
    return O(l) ? (e.exit("hardBreakEscape"), t(l)) : n(l);
  }
}
const yk = {
  name: "headingAtx",
  resolve: kk,
  tokenize: vk
};
function kk(e, t) {
  let n = e.length - 2, r = 3, i, l;
  return e[r][1].type === "whitespace" && (r += 2), n - 2 > r && e[n][1].type === "whitespace" && (n -= 2), e[n][1].type === "atxHeadingSequence" && (r === n - 1 || n - 4 > r && e[n - 2][1].type === "whitespace") && (n -= r + 1 === n ? 2 : 4), n > r && (i = {
    type: "atxHeadingText",
    start: e[r][1].start,
    end: e[n][1].end
  }, l = {
    type: "chunkText",
    start: e[r][1].start,
    end: e[n][1].end,
    contentType: "text"
  }, qe(e, r, n - r + 1, [["enter", i, t], ["enter", l, t], ["exit", l, t], ["exit", i, t]])), e;
}
function vk(e, t, n) {
  let r = 0;
  return i;
  function i(f) {
    return e.enter("atxHeading"), l(f);
  }
  function l(f) {
    return e.enter("atxHeadingSequence"), o(f);
  }
  function o(f) {
    return f === 35 && r++ < 6 ? (e.consume(f), o) : f === null || J(f) ? (e.exit("atxHeadingSequence"), u(f)) : n(f);
  }
  function u(f) {
    return f === 35 ? (e.enter("atxHeadingSequence"), s(f)) : f === null || O(f) ? (e.exit("atxHeading"), t(f)) : $(f) ? Q(e, u, "whitespace")(f) : (e.enter("atxHeadingText"), a(f));
  }
  function s(f) {
    return f === 35 ? (e.consume(f), s) : (e.exit("atxHeadingSequence"), u(f));
  }
  function a(f) {
    return f === null || f === 35 || J(f) ? (e.exit("atxHeadingText"), u(f)) : (e.consume(f), a);
  }
}
const xk = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
], bc = ["pre", "script", "style", "textarea"], wk = {
  concrete: !0,
  name: "htmlFlow",
  resolveTo: Ek,
  tokenize: Tk
}, Sk = {
  partial: !0,
  tokenize: Ik
}, Ck = {
  partial: !0,
  tokenize: _k
};
function Ek(e) {
  let t = e.length;
  for (; t-- && !(e[t][0] === "enter" && e[t][1].type === "htmlFlow"); )
    ;
  return t > 1 && e[t - 2][1].type === "linePrefix" && (e[t][1].start = e[t - 2][1].start, e[t + 1][1].start = e[t - 2][1].start, e.splice(t - 2, 2)), e;
}
function Tk(e, t, n) {
  const r = this;
  let i, l, o, u, s;
  return a;
  function a(v) {
    return f(v);
  }
  function f(v) {
    return e.enter("htmlFlow"), e.enter("htmlFlowData"), e.consume(v), c;
  }
  function c(v) {
    return v === 33 ? (e.consume(v), p) : v === 47 ? (e.consume(v), l = !0, x) : v === 63 ? (e.consume(v), i = 3, r.interrupt ? t : k) : be(v) ? (e.consume(v), o = String.fromCharCode(v), T) : n(v);
  }
  function p(v) {
    return v === 45 ? (e.consume(v), i = 2, d) : v === 91 ? (e.consume(v), i = 5, u = 0, g) : be(v) ? (e.consume(v), i = 4, r.interrupt ? t : k) : n(v);
  }
  function d(v) {
    return v === 45 ? (e.consume(v), r.interrupt ? t : k) : n(v);
  }
  function g(v) {
    const ge = "CDATA[";
    return v === ge.charCodeAt(u++) ? (e.consume(v), u === ge.length ? r.interrupt ? t : R : g) : n(v);
  }
  function x(v) {
    return be(v) ? (e.consume(v), o = String.fromCharCode(v), T) : n(v);
  }
  function T(v) {
    if (v === null || v === 47 || v === 62 || J(v)) {
      const ge = v === 47, lt = o.toLowerCase();
      return !ge && !l && bc.includes(lt) ? (i = 1, r.interrupt ? t(v) : R(v)) : xk.includes(o.toLowerCase()) ? (i = 6, ge ? (e.consume(v), h) : r.interrupt ? t(v) : R(v)) : (i = 7, r.interrupt && !r.parser.lazy[r.now().line] ? n(v) : l ? m(v) : y(v));
    }
    return v === 45 || Ie(v) ? (e.consume(v), o += String.fromCharCode(v), T) : n(v);
  }
  function h(v) {
    return v === 62 ? (e.consume(v), r.interrupt ? t : R) : n(v);
  }
  function m(v) {
    return $(v) ? (e.consume(v), m) : S(v);
  }
  function y(v) {
    return v === 47 ? (e.consume(v), S) : v === 58 || v === 95 || be(v) ? (e.consume(v), C) : $(v) ? (e.consume(v), y) : S(v);
  }
  function C(v) {
    return v === 45 || v === 46 || v === 58 || v === 95 || Ie(v) ? (e.consume(v), C) : _(v);
  }
  function _(v) {
    return v === 61 ? (e.consume(v), w) : $(v) ? (e.consume(v), _) : y(v);
  }
  function w(v) {
    return v === null || v === 60 || v === 61 || v === 62 || v === 96 ? n(v) : v === 34 || v === 39 ? (e.consume(v), s = v, P) : $(v) ? (e.consume(v), w) : L(v);
  }
  function P(v) {
    return v === s ? (e.consume(v), s = null, M) : v === null || O(v) ? n(v) : (e.consume(v), P);
  }
  function L(v) {
    return v === null || v === 34 || v === 39 || v === 47 || v === 60 || v === 61 || v === 62 || v === 96 || J(v) ? _(v) : (e.consume(v), L);
  }
  function M(v) {
    return v === 47 || v === 62 || $(v) ? y(v) : n(v);
  }
  function S(v) {
    return v === 62 ? (e.consume(v), A) : n(v);
  }
  function A(v) {
    return v === null || O(v) ? R(v) : $(v) ? (e.consume(v), A) : n(v);
  }
  function R(v) {
    return v === 45 && i === 2 ? (e.consume(v), de) : v === 60 && i === 1 ? (e.consume(v), fe) : v === 62 && i === 4 ? (e.consume(v), q) : v === 63 && i === 3 ? (e.consume(v), k) : v === 93 && i === 5 ? (e.consume(v), j) : O(v) && (i === 6 || i === 7) ? (e.exit("htmlFlowData"), e.check(Sk, G, K)(v)) : v === null || O(v) ? (e.exit("htmlFlowData"), K(v)) : (e.consume(v), R);
  }
  function K(v) {
    return e.check(Ck, ee, G)(v);
  }
  function ee(v) {
    return e.enter("lineEnding"), e.consume(v), e.exit("lineEnding"), V;
  }
  function V(v) {
    return v === null || O(v) ? K(v) : (e.enter("htmlFlowData"), R(v));
  }
  function de(v) {
    return v === 45 ? (e.consume(v), k) : R(v);
  }
  function fe(v) {
    return v === 47 ? (e.consume(v), o = "", N) : R(v);
  }
  function N(v) {
    if (v === 62) {
      const ge = o.toLowerCase();
      return bc.includes(ge) ? (e.consume(v), q) : R(v);
    }
    return be(v) && o.length < 8 ? (e.consume(v), o += String.fromCharCode(v), N) : R(v);
  }
  function j(v) {
    return v === 93 ? (e.consume(v), k) : R(v);
  }
  function k(v) {
    return v === 62 ? (e.consume(v), q) : v === 45 && i === 2 ? (e.consume(v), k) : R(v);
  }
  function q(v) {
    return v === null || O(v) ? (e.exit("htmlFlowData"), G(v)) : (e.consume(v), q);
  }
  function G(v) {
    return e.exit("htmlFlow"), t(v);
  }
}
function _k(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    return O(o) ? (e.enter("lineEnding"), e.consume(o), e.exit("lineEnding"), l) : n(o);
  }
  function l(o) {
    return r.parser.lazy[r.now().line] ? n(o) : t(o);
  }
}
function Ik(e, t, n) {
  return r;
  function r(i) {
    return e.enter("lineEnding"), e.consume(i), e.exit("lineEnding"), e.attempt(ci, t, n);
  }
}
const Pk = {
  name: "htmlText",
  tokenize: zk
};
function zk(e, t, n) {
  const r = this;
  let i, l, o;
  return u;
  function u(k) {
    return e.enter("htmlText"), e.enter("htmlTextData"), e.consume(k), s;
  }
  function s(k) {
    return k === 33 ? (e.consume(k), a) : k === 47 ? (e.consume(k), _) : k === 63 ? (e.consume(k), y) : be(k) ? (e.consume(k), L) : n(k);
  }
  function a(k) {
    return k === 45 ? (e.consume(k), f) : k === 91 ? (e.consume(k), l = 0, g) : be(k) ? (e.consume(k), m) : n(k);
  }
  function f(k) {
    return k === 45 ? (e.consume(k), d) : n(k);
  }
  function c(k) {
    return k === null ? n(k) : k === 45 ? (e.consume(k), p) : O(k) ? (o = c, fe(k)) : (e.consume(k), c);
  }
  function p(k) {
    return k === 45 ? (e.consume(k), d) : c(k);
  }
  function d(k) {
    return k === 62 ? de(k) : k === 45 ? p(k) : c(k);
  }
  function g(k) {
    const q = "CDATA[";
    return k === q.charCodeAt(l++) ? (e.consume(k), l === q.length ? x : g) : n(k);
  }
  function x(k) {
    return k === null ? n(k) : k === 93 ? (e.consume(k), T) : O(k) ? (o = x, fe(k)) : (e.consume(k), x);
  }
  function T(k) {
    return k === 93 ? (e.consume(k), h) : x(k);
  }
  function h(k) {
    return k === 62 ? de(k) : k === 93 ? (e.consume(k), h) : x(k);
  }
  function m(k) {
    return k === null || k === 62 ? de(k) : O(k) ? (o = m, fe(k)) : (e.consume(k), m);
  }
  function y(k) {
    return k === null ? n(k) : k === 63 ? (e.consume(k), C) : O(k) ? (o = y, fe(k)) : (e.consume(k), y);
  }
  function C(k) {
    return k === 62 ? de(k) : y(k);
  }
  function _(k) {
    return be(k) ? (e.consume(k), w) : n(k);
  }
  function w(k) {
    return k === 45 || Ie(k) ? (e.consume(k), w) : P(k);
  }
  function P(k) {
    return O(k) ? (o = P, fe(k)) : $(k) ? (e.consume(k), P) : de(k);
  }
  function L(k) {
    return k === 45 || Ie(k) ? (e.consume(k), L) : k === 47 || k === 62 || J(k) ? M(k) : n(k);
  }
  function M(k) {
    return k === 47 ? (e.consume(k), de) : k === 58 || k === 95 || be(k) ? (e.consume(k), S) : O(k) ? (o = M, fe(k)) : $(k) ? (e.consume(k), M) : de(k);
  }
  function S(k) {
    return k === 45 || k === 46 || k === 58 || k === 95 || Ie(k) ? (e.consume(k), S) : A(k);
  }
  function A(k) {
    return k === 61 ? (e.consume(k), R) : O(k) ? (o = A, fe(k)) : $(k) ? (e.consume(k), A) : M(k);
  }
  function R(k) {
    return k === null || k === 60 || k === 61 || k === 62 || k === 96 ? n(k) : k === 34 || k === 39 ? (e.consume(k), i = k, K) : O(k) ? (o = R, fe(k)) : $(k) ? (e.consume(k), R) : (e.consume(k), ee);
  }
  function K(k) {
    return k === i ? (e.consume(k), i = void 0, V) : k === null ? n(k) : O(k) ? (o = K, fe(k)) : (e.consume(k), K);
  }
  function ee(k) {
    return k === null || k === 34 || k === 39 || k === 60 || k === 61 || k === 96 ? n(k) : k === 47 || k === 62 || J(k) ? M(k) : (e.consume(k), ee);
  }
  function V(k) {
    return k === 47 || k === 62 || J(k) ? M(k) : n(k);
  }
  function de(k) {
    return k === 62 ? (e.consume(k), e.exit("htmlTextData"), e.exit("htmlText"), t) : n(k);
  }
  function fe(k) {
    return e.exit("htmlTextData"), e.enter("lineEnding"), e.consume(k), e.exit("lineEnding"), N;
  }
  function N(k) {
    return $(k) ? Q(e, j, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(k) : j(k);
  }
  function j(k) {
    return e.enter("htmlTextData"), o(k);
  }
}
const Hs = {
  name: "labelEnd",
  resolveAll: Ak,
  resolveTo: Dk,
  tokenize: Rk
}, Lk = {
  tokenize: Fk
}, bk = {
  tokenize: Ok
}, Nk = {
  tokenize: Mk
};
function Ak(e) {
  let t = -1;
  const n = [];
  for (; ++t < e.length; ) {
    const r = e[t][1];
    if (n.push(e[t]), r.type === "labelImage" || r.type === "labelLink" || r.type === "labelEnd") {
      const i = r.type === "labelImage" ? 4 : 2;
      r.type = "data", t += i;
    }
  }
  return e.length !== n.length && qe(e, 0, e.length, n), e;
}
function Dk(e, t) {
  let n = e.length, r = 0, i, l, o, u;
  for (; n--; )
    if (i = e[n][1], l) {
      if (i.type === "link" || i.type === "labelLink" && i._inactive)
        break;
      e[n][0] === "enter" && i.type === "labelLink" && (i._inactive = !0);
    } else if (o) {
      if (e[n][0] === "enter" && (i.type === "labelImage" || i.type === "labelLink") && !i._balanced && (l = n, i.type !== "labelLink")) {
        r = 2;
        break;
      }
    } else i.type === "labelEnd" && (o = n);
  const s = {
    type: e[l][1].type === "labelLink" ? "link" : "image",
    start: {
      ...e[l][1].start
    },
    end: {
      ...e[e.length - 1][1].end
    }
  }, a = {
    type: "label",
    start: {
      ...e[l][1].start
    },
    end: {
      ...e[o][1].end
    }
  }, f = {
    type: "labelText",
    start: {
      ...e[l + r + 2][1].end
    },
    end: {
      ...e[o - 2][1].start
    }
  };
  return u = [["enter", s, t], ["enter", a, t]], u = et(u, e.slice(l + 1, l + r + 3)), u = et(u, [["enter", f, t]]), u = et(u, Ul(t.parser.constructs.insideSpan.null, e.slice(l + r + 4, o - 3), t)), u = et(u, [["exit", f, t], e[o - 2], e[o - 1], ["exit", a, t]]), u = et(u, e.slice(o + 1)), u = et(u, [["exit", s, t]]), qe(e, l, e.length, u), e;
}
function Rk(e, t, n) {
  const r = this;
  let i = r.events.length, l, o;
  for (; i--; )
    if ((r.events[i][1].type === "labelImage" || r.events[i][1].type === "labelLink") && !r.events[i][1]._balanced) {
      l = r.events[i][1];
      break;
    }
  return u;
  function u(p) {
    return l ? l._inactive ? c(p) : (o = r.parser.defined.includes(dt(r.sliceSerialize({
      start: l.end,
      end: r.now()
    }))), e.enter("labelEnd"), e.enter("labelMarker"), e.consume(p), e.exit("labelMarker"), e.exit("labelEnd"), s) : n(p);
  }
  function s(p) {
    return p === 40 ? e.attempt(Lk, f, o ? f : c)(p) : p === 91 ? e.attempt(bk, f, o ? a : c)(p) : o ? f(p) : c(p);
  }
  function a(p) {
    return e.attempt(Nk, f, c)(p);
  }
  function f(p) {
    return t(p);
  }
  function c(p) {
    return l._balanced = !0, n(p);
  }
}
function Fk(e, t, n) {
  return r;
  function r(c) {
    return e.enter("resource"), e.enter("resourceMarker"), e.consume(c), e.exit("resourceMarker"), i;
  }
  function i(c) {
    return J(c) ? Or(e, l)(c) : l(c);
  }
  function l(c) {
    return c === 41 ? f(c) : Kd(e, o, u, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(c);
  }
  function o(c) {
    return J(c) ? Or(e, s)(c) : f(c);
  }
  function u(c) {
    return n(c);
  }
  function s(c) {
    return c === 34 || c === 39 || c === 40 ? Yd(e, a, n, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(c) : f(c);
  }
  function a(c) {
    return J(c) ? Or(e, f)(c) : f(c);
  }
  function f(c) {
    return c === 41 ? (e.enter("resourceMarker"), e.consume(c), e.exit("resourceMarker"), e.exit("resource"), t) : n(c);
  }
}
function Ok(e, t, n) {
  const r = this;
  return i;
  function i(u) {
    return qd.call(r, e, l, o, "reference", "referenceMarker", "referenceString")(u);
  }
  function l(u) {
    return r.parser.defined.includes(dt(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1))) ? t(u) : n(u);
  }
  function o(u) {
    return n(u);
  }
}
function Mk(e, t, n) {
  return r;
  function r(l) {
    return e.enter("reference"), e.enter("referenceMarker"), e.consume(l), e.exit("referenceMarker"), i;
  }
  function i(l) {
    return l === 93 ? (e.enter("referenceMarker"), e.consume(l), e.exit("referenceMarker"), e.exit("reference"), t) : n(l);
  }
}
const jk = {
  name: "labelStartImage",
  resolveAll: Hs.resolveAll,
  tokenize: Bk
};
function Bk(e, t, n) {
  const r = this;
  return i;
  function i(u) {
    return e.enter("labelImage"), e.enter("labelImageMarker"), e.consume(u), e.exit("labelImageMarker"), l;
  }
  function l(u) {
    return u === 91 ? (e.enter("labelMarker"), e.consume(u), e.exit("labelMarker"), e.exit("labelImage"), o) : n(u);
  }
  function o(u) {
    return u === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? n(u) : t(u);
  }
}
const Uk = {
  name: "labelStartLink",
  resolveAll: Hs.resolveAll,
  tokenize: $k
};
function $k(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    return e.enter("labelLink"), e.enter("labelMarker"), e.consume(o), e.exit("labelMarker"), e.exit("labelLink"), l;
  }
  function l(o) {
    return o === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? n(o) : t(o);
  }
}
const wo = {
  name: "lineEnding",
  tokenize: Hk
};
function Hk(e, t) {
  return n;
  function n(r) {
    return e.enter("lineEnding"), e.consume(r), e.exit("lineEnding"), Q(e, t, "linePrefix");
  }
}
const Qi = {
  name: "thematicBreak",
  tokenize: Vk
};
function Vk(e, t, n) {
  let r = 0, i;
  return l;
  function l(a) {
    return e.enter("thematicBreak"), o(a);
  }
  function o(a) {
    return i = a, u(a);
  }
  function u(a) {
    return a === i ? (e.enter("thematicBreakSequence"), s(a)) : r >= 3 && (a === null || O(a)) ? (e.exit("thematicBreak"), t(a)) : n(a);
  }
  function s(a) {
    return a === i ? (e.consume(a), r++, s) : (e.exit("thematicBreakSequence"), $(a) ? Q(e, u, "whitespace")(a) : u(a));
  }
}
const Re = {
  continuation: {
    tokenize: qk
  },
  exit: Xk,
  name: "list",
  tokenize: Kk
}, Wk = {
  partial: !0,
  tokenize: Gk
}, Qk = {
  partial: !0,
  tokenize: Yk
};
function Kk(e, t, n) {
  const r = this, i = r.events[r.events.length - 1];
  let l = i && i[1].type === "linePrefix" ? i[2].sliceSerialize(i[1], !0).length : 0, o = 0;
  return u;
  function u(d) {
    const g = r.containerState.type || (d === 42 || d === 43 || d === 45 ? "listUnordered" : "listOrdered");
    if (g === "listUnordered" ? !r.containerState.marker || d === r.containerState.marker : bu(d)) {
      if (r.containerState.type || (r.containerState.type = g, e.enter(g, {
        _container: !0
      })), g === "listUnordered")
        return e.enter("listItemPrefix"), d === 42 || d === 45 ? e.check(Qi, n, a)(d) : a(d);
      if (!r.interrupt || d === 49)
        return e.enter("listItemPrefix"), e.enter("listItemValue"), s(d);
    }
    return n(d);
  }
  function s(d) {
    return bu(d) && ++o < 10 ? (e.consume(d), s) : (!r.interrupt || o < 2) && (r.containerState.marker ? d === r.containerState.marker : d === 41 || d === 46) ? (e.exit("listItemValue"), a(d)) : n(d);
  }
  function a(d) {
    return e.enter("listItemMarker"), e.consume(d), e.exit("listItemMarker"), r.containerState.marker = r.containerState.marker || d, e.check(
      ci,
      // Can’t be empty when interrupting.
      r.interrupt ? n : f,
      e.attempt(Wk, p, c)
    );
  }
  function f(d) {
    return r.containerState.initialBlankLine = !0, l++, p(d);
  }
  function c(d) {
    return $(d) ? (e.enter("listItemPrefixWhitespace"), e.consume(d), e.exit("listItemPrefixWhitespace"), p) : n(d);
  }
  function p(d) {
    return r.containerState.size = l + r.sliceSerialize(e.exit("listItemPrefix"), !0).length, t(d);
  }
}
function qk(e, t, n) {
  const r = this;
  return r.containerState._closeFlow = void 0, e.check(ci, i, l);
  function i(u) {
    return r.containerState.furtherBlankLines = r.containerState.furtherBlankLines || r.containerState.initialBlankLine, Q(e, t, "listItemIndent", r.containerState.size + 1)(u);
  }
  function l(u) {
    return r.containerState.furtherBlankLines || !$(u) ? (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, o(u)) : (r.containerState.furtherBlankLines = void 0, r.containerState.initialBlankLine = void 0, e.attempt(Qk, t, o)(u));
  }
  function o(u) {
    return r.containerState._closeFlow = !0, r.interrupt = void 0, Q(e, e.attempt(Re, t, n), "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(u);
  }
}
function Yk(e, t, n) {
  const r = this;
  return Q(e, i, "listItemIndent", r.containerState.size + 1);
  function i(l) {
    const o = r.events[r.events.length - 1];
    return o && o[1].type === "listItemIndent" && o[2].sliceSerialize(o[1], !0).length === r.containerState.size ? t(l) : n(l);
  }
}
function Xk(e) {
  e.exit(this.containerState.type);
}
function Gk(e, t, n) {
  const r = this;
  return Q(e, i, "listItemPrefixWhitespace", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 5);
  function i(l) {
    const o = r.events[r.events.length - 1];
    return !$(l) && o && o[1].type === "listItemPrefixWhitespace" ? t(l) : n(l);
  }
}
const Nc = {
  name: "setextUnderline",
  resolveTo: Zk,
  tokenize: Jk
};
function Zk(e, t) {
  let n = e.length, r, i, l;
  for (; n--; )
    if (e[n][0] === "enter") {
      if (e[n][1].type === "content") {
        r = n;
        break;
      }
      e[n][1].type === "paragraph" && (i = n);
    } else
      e[n][1].type === "content" && e.splice(n, 1), !l && e[n][1].type === "definition" && (l = n);
  const o = {
    type: "setextHeading",
    start: {
      ...e[r][1].start
    },
    end: {
      ...e[e.length - 1][1].end
    }
  };
  return e[i][1].type = "setextHeadingText", l ? (e.splice(i, 0, ["enter", o, t]), e.splice(l + 1, 0, ["exit", e[r][1], t]), e[r][1].end = {
    ...e[l][1].end
  }) : e[r][1] = o, e.push(["exit", o, t]), e;
}
function Jk(e, t, n) {
  const r = this;
  let i;
  return l;
  function l(a) {
    let f = r.events.length, c;
    for (; f--; )
      if (r.events[f][1].type !== "lineEnding" && r.events[f][1].type !== "linePrefix" && r.events[f][1].type !== "content") {
        c = r.events[f][1].type === "paragraph";
        break;
      }
    return !r.parser.lazy[r.now().line] && (r.interrupt || c) ? (e.enter("setextHeadingLine"), i = a, o(a)) : n(a);
  }
  function o(a) {
    return e.enter("setextHeadingLineSequence"), u(a);
  }
  function u(a) {
    return a === i ? (e.consume(a), u) : (e.exit("setextHeadingLineSequence"), $(a) ? Q(e, s, "lineSuffix")(a) : s(a));
  }
  function s(a) {
    return a === null || O(a) ? (e.exit("setextHeadingLine"), t(a)) : n(a);
  }
}
const ev = {
  tokenize: tv
};
function tv(e) {
  const t = this, n = e.attempt(
    // Try to parse a blank line.
    ci,
    r,
    // Try to parse initial flow (essentially, only code).
    e.attempt(this.parser.constructs.flowInitial, i, Q(e, e.attempt(this.parser.constructs.flow, i, e.attempt(ok, i)), "linePrefix"))
  );
  return n;
  function r(l) {
    if (l === null) {
      e.consume(l);
      return;
    }
    return e.enter("lineEndingBlank"), e.consume(l), e.exit("lineEndingBlank"), t.currentConstruct = void 0, n;
  }
  function i(l) {
    if (l === null) {
      e.consume(l);
      return;
    }
    return e.enter("lineEnding"), e.consume(l), e.exit("lineEnding"), t.currentConstruct = void 0, n;
  }
}
const nv = {
  resolveAll: Gd()
}, rv = Xd("string"), iv = Xd("text");
function Xd(e) {
  return {
    resolveAll: Gd(e === "text" ? lv : void 0),
    tokenize: t
  };
  function t(n) {
    const r = this, i = this.parser.constructs[e], l = n.attempt(i, o, u);
    return o;
    function o(f) {
      return a(f) ? l(f) : u(f);
    }
    function u(f) {
      if (f === null) {
        n.consume(f);
        return;
      }
      return n.enter("data"), n.consume(f), s;
    }
    function s(f) {
      return a(f) ? (n.exit("data"), l(f)) : (n.consume(f), s);
    }
    function a(f) {
      if (f === null)
        return !0;
      const c = i[f];
      let p = -1;
      if (c)
        for (; ++p < c.length; ) {
          const d = c[p];
          if (!d.previous || d.previous.call(r, r.previous))
            return !0;
        }
      return !1;
    }
  }
}
function Gd(e) {
  return t;
  function t(n, r) {
    let i = -1, l;
    for (; ++i <= n.length; )
      l === void 0 ? n[i] && n[i][1].type === "data" && (l = i, i++) : (!n[i] || n[i][1].type !== "data") && (i !== l + 2 && (n[l][1].end = n[i - 1][1].end, n.splice(l + 2, i - l - 2), i = l + 2), l = void 0);
    return e ? e(n, r) : n;
  }
}
function lv(e, t) {
  let n = 0;
  for (; ++n <= e.length; )
    if ((n === e.length || e[n][1].type === "lineEnding") && e[n - 1][1].type === "data") {
      const r = e[n - 1][1], i = t.sliceStream(r);
      let l = i.length, o = -1, u = 0, s;
      for (; l--; ) {
        const a = i[l];
        if (typeof a == "string") {
          for (o = a.length; a.charCodeAt(o - 1) === 32; )
            u++, o--;
          if (o) break;
          o = -1;
        } else if (a === -2)
          s = !0, u++;
        else if (a !== -1) {
          l++;
          break;
        }
      }
      if (t._contentTypeTextTrailing && n === e.length && (u = 0), u) {
        const a = {
          type: n === e.length || s || u < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: l ? o : r.start._bufferIndex + o,
            _index: r.start._index + l,
            line: r.end.line,
            column: r.end.column - u,
            offset: r.end.offset - u
          },
          end: {
            ...r.end
          }
        };
        r.end = {
          ...a.start
        }, r.start.offset === r.end.offset ? Object.assign(r, a) : (e.splice(n, 0, ["enter", a, t], ["exit", a, t]), n += 2);
      }
      n++;
    }
  return e;
}
const ov = {
  42: Re,
  43: Re,
  45: Re,
  48: Re,
  49: Re,
  50: Re,
  51: Re,
  52: Re,
  53: Re,
  54: Re,
  55: Re,
  56: Re,
  57: Re,
  62: Hd
}, uv = {
  91: fk
}, sv = {
  [-2]: xo,
  [-1]: xo,
  32: xo
}, av = {
  35: yk,
  42: Qi,
  45: [Nc, Qi],
  60: wk,
  61: Nc,
  95: Qi,
  96: Lc,
  126: Lc
}, cv = {
  38: Wd,
  92: Vd
}, fv = {
  [-5]: wo,
  [-4]: wo,
  [-3]: wo,
  33: jk,
  38: Wd,
  42: Nu,
  60: [U1, Pk],
  91: Uk,
  92: [mk, Vd],
  93: Hs,
  95: Nu,
  96: ek
}, pv = {
  null: [Nu, nv]
}, dv = {
  null: [42, 95]
}, hv = {
  null: []
}, mv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  attentionMarkers: dv,
  contentInitial: uv,
  disable: hv,
  document: ov,
  flow: av,
  flowInitial: sv,
  insideSpan: pv,
  string: cv,
  text: fv
}, Symbol.toStringTag, { value: "Module" }));
function gv(e, t, n) {
  let r = {
    _bufferIndex: -1,
    _index: 0,
    line: n && n.line || 1,
    column: n && n.column || 1,
    offset: n && n.offset || 0
  };
  const i = {}, l = [];
  let o = [], u = [];
  const s = {
    attempt: P(_),
    check: P(w),
    consume: m,
    enter: y,
    exit: C,
    interrupt: P(w, {
      interrupt: !0
    })
  }, a = {
    code: null,
    containerState: {},
    defineSkip: x,
    events: [],
    now: g,
    parser: e,
    previous: null,
    sliceSerialize: p,
    sliceStream: d,
    write: c
  };
  let f = t.tokenize.call(a, s);
  return t.resolveAll && l.push(t), a;
  function c(A) {
    return o = et(o, A), T(), o[o.length - 1] !== null ? [] : (L(t, 0), a.events = Ul(l, a.events, a), a.events);
  }
  function p(A, R) {
    return kv(d(A), R);
  }
  function d(A) {
    return yv(o, A);
  }
  function g() {
    const {
      _bufferIndex: A,
      _index: R,
      line: K,
      column: ee,
      offset: V
    } = r;
    return {
      _bufferIndex: A,
      _index: R,
      line: K,
      column: ee,
      offset: V
    };
  }
  function x(A) {
    i[A.line] = A.column, S();
  }
  function T() {
    let A;
    for (; r._index < o.length; ) {
      const R = o[r._index];
      if (typeof R == "string")
        for (A = r._index, r._bufferIndex < 0 && (r._bufferIndex = 0); r._index === A && r._bufferIndex < R.length; )
          h(R.charCodeAt(r._bufferIndex));
      else
        h(R);
    }
  }
  function h(A) {
    f = f(A);
  }
  function m(A) {
    O(A) ? (r.line++, r.column = 1, r.offset += A === -3 ? 2 : 1, S()) : A !== -1 && (r.column++, r.offset++), r._bufferIndex < 0 ? r._index++ : (r._bufferIndex++, r._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
    // strings.
    /** @type {string} */
    o[r._index].length && (r._bufferIndex = -1, r._index++)), a.previous = A;
  }
  function y(A, R) {
    const K = R || {};
    return K.type = A, K.start = g(), a.events.push(["enter", K, a]), u.push(K), K;
  }
  function C(A) {
    const R = u.pop();
    return R.end = g(), a.events.push(["exit", R, a]), R;
  }
  function _(A, R) {
    L(A, R.from);
  }
  function w(A, R) {
    R.restore();
  }
  function P(A, R) {
    return K;
    function K(ee, V, de) {
      let fe, N, j, k;
      return Array.isArray(ee) ? (
        /* c8 ignore next 1 */
        G(ee)
      ) : "tokenize" in ee ? (
        // Looks like a construct.
        G([
          /** @type {Construct} */
          ee
        ])
      ) : q(ee);
      function q(re) {
        return mt;
        function mt(Ft) {
          const _n = Ft !== null && re[Ft], In = Ft !== null && re.null, pi = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(_n) ? _n : _n ? [_n] : [],
            ...Array.isArray(In) ? In : In ? [In] : []
          ];
          return G(pi)(Ft);
        }
      }
      function G(re) {
        return fe = re, N = 0, re.length === 0 ? de : v(re[N]);
      }
      function v(re) {
        return mt;
        function mt(Ft) {
          return k = M(), j = re, re.partial || (a.currentConstruct = re), re.name && a.parser.constructs.disable.null.includes(re.name) ? lt() : re.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            R ? Object.assign(Object.create(a), R) : a,
            s,
            ge,
            lt
          )(Ft);
        }
      }
      function ge(re) {
        return A(j, k), V;
      }
      function lt(re) {
        return k.restore(), ++N < fe.length ? v(fe[N]) : de;
      }
    }
  }
  function L(A, R) {
    A.resolveAll && !l.includes(A) && l.push(A), A.resolve && qe(a.events, R, a.events.length - R, A.resolve(a.events.slice(R), a)), A.resolveTo && (a.events = A.resolveTo(a.events, a));
  }
  function M() {
    const A = g(), R = a.previous, K = a.currentConstruct, ee = a.events.length, V = Array.from(u);
    return {
      from: ee,
      restore: de
    };
    function de() {
      r = A, a.previous = R, a.currentConstruct = K, a.events.length = ee, u = V, S();
    }
  }
  function S() {
    r.line in i && r.column < 2 && (r.column = i[r.line], r.offset += i[r.line] - 1);
  }
}
function yv(e, t) {
  const n = t.start._index, r = t.start._bufferIndex, i = t.end._index, l = t.end._bufferIndex;
  let o;
  if (n === i)
    o = [e[n].slice(r, l)];
  else {
    if (o = e.slice(n, i), r > -1) {
      const u = o[0];
      typeof u == "string" ? o[0] = u.slice(r) : o.shift();
    }
    l > 0 && o.push(e[i].slice(0, l));
  }
  return o;
}
function kv(e, t) {
  let n = -1;
  const r = [];
  let i;
  for (; ++n < e.length; ) {
    const l = e[n];
    let o;
    if (typeof l == "string")
      o = l;
    else switch (l) {
      case -5: {
        o = "\r";
        break;
      }
      case -4: {
        o = `
`;
        break;
      }
      case -3: {
        o = `\r
`;
        break;
      }
      case -2: {
        o = t ? " " : "	";
        break;
      }
      case -1: {
        if (!t && i) continue;
        o = " ";
        break;
      }
      default:
        o = String.fromCharCode(l);
    }
    i = l === -2, r.push(o);
  }
  return r.join("");
}
function vv(e) {
  const r = {
    constructs: (
      /** @type {FullNormalizedExtension} */
      Ud([mv, ...(e || {}).extensions || []])
    ),
    content: i(D1),
    defined: [],
    document: i(F1),
    flow: i(ev),
    lazy: {},
    string: i(rv),
    text: i(iv)
  };
  return r;
  function i(l) {
    return o;
    function o(u) {
      return gv(r, l, u);
    }
  }
}
function xv(e) {
  for (; !Qd(e); )
    ;
  return e;
}
const Ac = /[\0\t\n\r]/g;
function wv() {
  let e = 1, t = "", n = !0, r;
  return i;
  function i(l, o, u) {
    const s = [];
    let a, f, c, p, d;
    for (l = t + (typeof l == "string" ? l.toString() : new TextDecoder(o || void 0).decode(l)), c = 0, t = "", n && (l.charCodeAt(0) === 65279 && c++, n = void 0); c < l.length; ) {
      if (Ac.lastIndex = c, a = Ac.exec(l), p = a && a.index !== void 0 ? a.index : l.length, d = l.charCodeAt(p), !a) {
        t = l.slice(c);
        break;
      }
      if (d === 10 && c === p && r)
        s.push(-3), r = void 0;
      else
        switch (r && (s.push(-5), r = void 0), c < p && (s.push(l.slice(c, p)), e += p - c), d) {
          case 0: {
            s.push(65533), e++;
            break;
          }
          case 9: {
            for (f = Math.ceil(e / 4) * 4, s.push(-2); e++ < f; ) s.push(-1);
            break;
          }
          case 10: {
            s.push(-4), e = 1;
            break;
          }
          default:
            r = !0, e = 1;
        }
      c = p + 1;
    }
    return u && (r && s.push(-5), t && s.push(t), s.push(null)), s;
  }
}
const Sv = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function Cv(e) {
  return e.replace(Sv, Ev);
}
function Ev(e, t, n) {
  if (t)
    return t;
  if (n.charCodeAt(0) === 35) {
    const i = n.charCodeAt(1), l = i === 120 || i === 88;
    return $d(n.slice(l ? 2 : 1), l ? 16 : 10);
  }
  return $s(n) || e;
}
const Zd = {}.hasOwnProperty;
function Tv(e, t, n) {
  return typeof t != "string" && (n = t, t = void 0), _v(n)(xv(vv(n).document().write(wv()(e, t, !0))));
}
function _v(e) {
  const t = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: l(na),
      autolinkProtocol: M,
      autolinkEmail: M,
      atxHeading: l(Js),
      blockQuote: l(In),
      characterEscape: M,
      characterReference: M,
      codeFenced: l(pi),
      codeFencedFenceInfo: o,
      codeFencedFenceMeta: o,
      codeIndented: l(pi, o),
      codeText: l(Dh, o),
      codeTextData: M,
      data: M,
      codeFlowValue: M,
      definition: l(Rh),
      definitionDestinationString: o,
      definitionLabelString: o,
      definitionTitleString: o,
      emphasis: l(Fh),
      hardBreakEscape: l(ea),
      hardBreakTrailing: l(ea),
      htmlFlow: l(ta, o),
      htmlFlowData: M,
      htmlText: l(ta, o),
      htmlTextData: M,
      image: l(Oh),
      label: o,
      link: l(na),
      listItem: l(Mh),
      listItemValue: p,
      listOrdered: l(ra, c),
      listUnordered: l(ra),
      paragraph: l(jh),
      reference: v,
      referenceString: o,
      resourceDestinationString: o,
      resourceTitleString: o,
      setextHeading: l(Js),
      strong: l(Bh),
      thematicBreak: l($h)
    },
    exit: {
      atxHeading: s(),
      atxHeadingSequence: _,
      autolink: s(),
      autolinkEmail: _n,
      autolinkProtocol: Ft,
      blockQuote: s(),
      characterEscapeValue: S,
      characterReferenceMarkerHexadecimal: lt,
      characterReferenceMarkerNumeric: lt,
      characterReferenceValue: re,
      characterReference: mt,
      codeFenced: s(T),
      codeFencedFence: x,
      codeFencedFenceInfo: d,
      codeFencedFenceMeta: g,
      codeFlowValue: S,
      codeIndented: s(h),
      codeText: s(V),
      codeTextData: S,
      data: S,
      definition: s(),
      definitionDestinationString: C,
      definitionLabelString: m,
      definitionTitleString: y,
      emphasis: s(),
      hardBreakEscape: s(R),
      hardBreakTrailing: s(R),
      htmlFlow: s(K),
      htmlFlowData: S,
      htmlText: s(ee),
      htmlTextData: S,
      image: s(fe),
      label: j,
      labelText: N,
      lineEnding: A,
      link: s(de),
      listItem: s(),
      listOrdered: s(),
      listUnordered: s(),
      paragraph: s(),
      referenceString: ge,
      resourceDestinationString: k,
      resourceTitleString: q,
      resource: G,
      setextHeading: s(L),
      setextHeadingLineSequence: P,
      setextHeadingText: w,
      strong: s(),
      thematicBreak: s()
    }
  };
  Jd(t, (e || {}).mdastExtensions || []);
  const n = {};
  return r;
  function r(E) {
    let b = {
      type: "root",
      children: []
    };
    const B = {
      stack: [b],
      tokenStack: [],
      config: t,
      enter: u,
      exit: a,
      buffer: o,
      resume: f,
      data: n
    }, W = [];
    let Z = -1;
    for (; ++Z < E.length; )
      if (E[Z][1].type === "listOrdered" || E[Z][1].type === "listUnordered")
        if (E[Z][0] === "enter")
          W.push(Z);
        else {
          const ot = W.pop();
          Z = i(E, ot, Z);
        }
    for (Z = -1; ++Z < E.length; ) {
      const ot = t[E[Z][0]];
      Zd.call(ot, E[Z][1].type) && ot[E[Z][1].type].call(Object.assign({
        sliceSerialize: E[Z][2].sliceSerialize
      }, B), E[Z][1]);
    }
    if (B.tokenStack.length > 0) {
      const ot = B.tokenStack[B.tokenStack.length - 1];
      (ot[1] || Dc).call(B, void 0, ot[0]);
    }
    for (b.position = {
      start: Mt(E.length > 0 ? E[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: Mt(E.length > 0 ? E[E.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    }, Z = -1; ++Z < t.transforms.length; )
      b = t.transforms[Z](b) || b;
    return b;
  }
  function i(E, b, B) {
    let W = b - 1, Z = -1, ot = !1, on, Ct, cr, fr;
    for (; ++W <= B; ) {
      const $e = E[W];
      switch ($e[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          $e[0] === "enter" ? Z++ : Z--, fr = void 0;
          break;
        }
        case "lineEndingBlank": {
          $e[0] === "enter" && (on && !fr && !Z && !cr && (cr = W), fr = void 0);
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace":
          break;
        default:
          fr = void 0;
      }
      if (!Z && $e[0] === "enter" && $e[1].type === "listItemPrefix" || Z === -1 && $e[0] === "exit" && ($e[1].type === "listUnordered" || $e[1].type === "listOrdered")) {
        if (on) {
          let Pn = W;
          for (Ct = void 0; Pn--; ) {
            const Et = E[Pn];
            if (Et[1].type === "lineEnding" || Et[1].type === "lineEndingBlank") {
              if (Et[0] === "exit") continue;
              Ct && (E[Ct][1].type = "lineEndingBlank", ot = !0), Et[1].type = "lineEnding", Ct = Pn;
            } else if (!(Et[1].type === "linePrefix" || Et[1].type === "blockQuotePrefix" || Et[1].type === "blockQuotePrefixWhitespace" || Et[1].type === "blockQuoteMarker" || Et[1].type === "listItemIndent")) break;
          }
          cr && (!Ct || cr < Ct) && (on._spread = !0), on.end = Object.assign({}, Ct ? E[Ct][1].start : $e[1].end), E.splice(Ct || W, 0, ["exit", on, $e[2]]), W++, B++;
        }
        if ($e[1].type === "listItemPrefix") {
          const Pn = {
            type: "listItem",
            _spread: !1,
            start: Object.assign({}, $e[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          on = Pn, E.splice(W, 0, ["enter", Pn, $e[2]]), W++, B++, cr = void 0, fr = !0;
        }
      }
    }
    return E[b][1]._spread = ot, B;
  }
  function l(E, b) {
    return B;
    function B(W) {
      u.call(this, E(W), W), b && b.call(this, W);
    }
  }
  function o() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function u(E, b, B) {
    this.stack[this.stack.length - 1].children.push(E), this.stack.push(E), this.tokenStack.push([b, B || void 0]), E.position = {
      start: Mt(b.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function s(E) {
    return b;
    function b(B) {
      E && E.call(this, B), a.call(this, B);
    }
  }
  function a(E, b) {
    const B = this.stack.pop(), W = this.tokenStack.pop();
    if (W)
      W[0].type !== E.type && (b ? b.call(this, E, W[0]) : (W[1] || Dc).call(this, E, W[0]));
    else throw new Error("Cannot close `" + E.type + "` (" + Fr({
      start: E.start,
      end: E.end
    }) + "): it’s not open");
    B.position.end = Mt(E.end);
  }
  function f() {
    return Us(this.stack.pop());
  }
  function c() {
    this.data.expectingFirstListItemValue = !0;
  }
  function p(E) {
    if (this.data.expectingFirstListItemValue) {
      const b = this.stack[this.stack.length - 2];
      b.start = Number.parseInt(this.sliceSerialize(E), 10), this.data.expectingFirstListItemValue = void 0;
    }
  }
  function d() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.lang = E;
  }
  function g() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.meta = E;
  }
  function x() {
    this.data.flowCodeInside || (this.buffer(), this.data.flowCodeInside = !0);
  }
  function T() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.value = E.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, ""), this.data.flowCodeInside = void 0;
  }
  function h() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.value = E.replace(/(\r?\n|\r)$/g, "");
  }
  function m(E) {
    const b = this.resume(), B = this.stack[this.stack.length - 1];
    B.label = b, B.identifier = dt(this.sliceSerialize(E)).toLowerCase();
  }
  function y() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.title = E;
  }
  function C() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.url = E;
  }
  function _(E) {
    const b = this.stack[this.stack.length - 1];
    if (!b.depth) {
      const B = this.sliceSerialize(E).length;
      b.depth = B;
    }
  }
  function w() {
    this.data.setextHeadingSlurpLineEnding = !0;
  }
  function P(E) {
    const b = this.stack[this.stack.length - 1];
    b.depth = this.sliceSerialize(E).codePointAt(0) === 61 ? 1 : 2;
  }
  function L() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function M(E) {
    const B = this.stack[this.stack.length - 1].children;
    let W = B[B.length - 1];
    (!W || W.type !== "text") && (W = Uh(), W.position = {
      start: Mt(E.start),
      // @ts-expect-error: we’ll add `end` later.
      end: void 0
    }, B.push(W)), this.stack.push(W);
  }
  function S(E) {
    const b = this.stack.pop();
    b.value += this.sliceSerialize(E), b.position.end = Mt(E.end);
  }
  function A(E) {
    const b = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const B = b.children[b.children.length - 1];
      B.position.end = Mt(E.end), this.data.atHardBreak = void 0;
      return;
    }
    !this.data.setextHeadingSlurpLineEnding && t.canContainEols.includes(b.type) && (M.call(this, E), S.call(this, E));
  }
  function R() {
    this.data.atHardBreak = !0;
  }
  function K() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.value = E;
  }
  function ee() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.value = E;
  }
  function V() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.value = E;
  }
  function de() {
    const E = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const b = this.data.referenceType || "shortcut";
      E.type += "Reference", E.referenceType = b, delete E.url, delete E.title;
    } else
      delete E.identifier, delete E.label;
    this.data.referenceType = void 0;
  }
  function fe() {
    const E = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const b = this.data.referenceType || "shortcut";
      E.type += "Reference", E.referenceType = b, delete E.url, delete E.title;
    } else
      delete E.identifier, delete E.label;
    this.data.referenceType = void 0;
  }
  function N(E) {
    const b = this.sliceSerialize(E), B = this.stack[this.stack.length - 2];
    B.label = Cv(b), B.identifier = dt(b).toLowerCase();
  }
  function j() {
    const E = this.stack[this.stack.length - 1], b = this.resume(), B = this.stack[this.stack.length - 1];
    if (this.data.inReference = !0, B.type === "link") {
      const W = E.children;
      B.children = W;
    } else
      B.alt = b;
  }
  function k() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.url = E;
  }
  function q() {
    const E = this.resume(), b = this.stack[this.stack.length - 1];
    b.title = E;
  }
  function G() {
    this.data.inReference = void 0;
  }
  function v() {
    this.data.referenceType = "collapsed";
  }
  function ge(E) {
    const b = this.resume(), B = this.stack[this.stack.length - 1];
    B.label = b, B.identifier = dt(this.sliceSerialize(E)).toLowerCase(), this.data.referenceType = "full";
  }
  function lt(E) {
    this.data.characterReferenceType = E.type;
  }
  function re(E) {
    const b = this.sliceSerialize(E), B = this.data.characterReferenceType;
    let W;
    B ? (W = $d(b, B === "characterReferenceMarkerNumeric" ? 10 : 16), this.data.characterReferenceType = void 0) : W = $s(b);
    const Z = this.stack[this.stack.length - 1];
    Z.value += W;
  }
  function mt(E) {
    const b = this.stack.pop();
    b.position.end = Mt(E.end);
  }
  function Ft(E) {
    S.call(this, E);
    const b = this.stack[this.stack.length - 1];
    b.url = this.sliceSerialize(E);
  }
  function _n(E) {
    S.call(this, E);
    const b = this.stack[this.stack.length - 1];
    b.url = "mailto:" + this.sliceSerialize(E);
  }
  function In() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function pi() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function Dh() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function Rh() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function Fh() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function Js() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function ea() {
    return {
      type: "break"
    };
  }
  function ta() {
    return {
      type: "html",
      value: ""
    };
  }
  function Oh() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function na() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function ra(E) {
    return {
      type: "list",
      ordered: E.type === "listOrdered",
      start: null,
      spread: E._spread,
      children: []
    };
  }
  function Mh(E) {
    return {
      type: "listItem",
      spread: E._spread,
      checked: null,
      children: []
    };
  }
  function jh() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function Bh() {
    return {
      type: "strong",
      children: []
    };
  }
  function Uh() {
    return {
      type: "text",
      value: ""
    };
  }
  function $h() {
    return {
      type: "thematicBreak"
    };
  }
}
function Mt(e) {
  return {
    line: e.line,
    column: e.column,
    offset: e.offset
  };
}
function Jd(e, t) {
  let n = -1;
  for (; ++n < t.length; ) {
    const r = t[n];
    Array.isArray(r) ? Jd(e, r) : Iv(e, r);
  }
}
function Iv(e, t) {
  let n;
  for (n in t)
    if (Zd.call(t, n))
      switch (n) {
        case "canContainEols": {
          const r = t[n];
          r && e[n].push(...r);
          break;
        }
        case "transforms": {
          const r = t[n];
          r && e[n].push(...r);
          break;
        }
        case "enter":
        case "exit": {
          const r = t[n];
          r && Object.assign(e[n], r);
          break;
        }
      }
}
function Dc(e, t) {
  throw e ? new Error("Cannot close `" + e.type + "` (" + Fr({
    start: e.start,
    end: e.end
  }) + "): a different token (`" + t.type + "`, " + Fr({
    start: t.start,
    end: t.end
  }) + ") is open") : new Error("Cannot close document, a token (`" + t.type + "`, " + Fr({
    start: t.start,
    end: t.end
  }) + ") is still open");
}
function Pv(e) {
  const t = this;
  t.parser = n;
  function n(r) {
    return Tv(r, {
      ...t.data("settings"),
      ...e,
      // Note: these options are not in the readme.
      // The goal is for them to be set by plugins on `data` instead of being
      // passed by users.
      extensions: t.data("micromarkExtensions") || [],
      mdastExtensions: t.data("fromMarkdownExtensions") || []
    });
  }
}
function zv(e, t) {
  const n = {
    type: "element",
    tagName: "blockquote",
    properties: {},
    children: e.wrap(e.all(t), !0)
  };
  return e.patch(t, n), e.applyData(t, n);
}
function Lv(e, t) {
  const n = { type: "element", tagName: "br", properties: {}, children: [] };
  return e.patch(t, n), [e.applyData(t, n), { type: "text", value: `
` }];
}
function bv(e, t) {
  const n = t.value ? t.value + `
` : "", r = {}, i = t.lang ? t.lang.split(/\s+/) : [];
  i.length > 0 && (r.className = ["language-" + i[0]]);
  let l = {
    type: "element",
    tagName: "code",
    properties: r,
    children: [{ type: "text", value: n }]
  };
  return t.meta && (l.data = { meta: t.meta }), e.patch(t, l), l = e.applyData(t, l), l = { type: "element", tagName: "pre", properties: {}, children: [l] }, e.patch(t, l), l;
}
function Nv(e, t) {
  const n = {
    type: "element",
    tagName: "del",
    properties: {},
    children: e.all(t)
  };
  return e.patch(t, n), e.applyData(t, n);
}
function Av(e, t) {
  const n = {
    type: "element",
    tagName: "em",
    properties: {},
    children: e.all(t)
  };
  return e.patch(t, n), e.applyData(t, n);
}
function Dv(e, t) {
  const n = typeof e.options.clobberPrefix == "string" ? e.options.clobberPrefix : "user-content-", r = String(t.identifier).toUpperCase(), i = ar(r.toLowerCase()), l = e.footnoteOrder.indexOf(r);
  let o, u = e.footnoteCounts.get(r);
  u === void 0 ? (u = 0, e.footnoteOrder.push(r), o = e.footnoteOrder.length) : o = l + 1, u += 1, e.footnoteCounts.set(r, u);
  const s = {
    type: "element",
    tagName: "a",
    properties: {
      href: "#" + n + "fn-" + i,
      id: n + "fnref-" + i + (u > 1 ? "-" + u : ""),
      dataFootnoteRef: !0,
      ariaDescribedBy: ["footnote-label"]
    },
    children: [{ type: "text", value: String(o) }]
  };
  e.patch(t, s);
  const a = {
    type: "element",
    tagName: "sup",
    properties: {},
    children: [s]
  };
  return e.patch(t, a), e.applyData(t, a);
}
function Rv(e, t) {
  const n = {
    type: "element",
    tagName: "h" + t.depth,
    properties: {},
    children: e.all(t)
  };
  return e.patch(t, n), e.applyData(t, n);
}
function Fv(e, t) {
  if (e.options.allowDangerousHtml) {
    const n = { type: "raw", value: t.value };
    return e.patch(t, n), e.applyData(t, n);
  }
}
function eh(e, t) {
  const n = t.referenceType;
  let r = "]";
  if (n === "collapsed" ? r += "[]" : n === "full" && (r += "[" + (t.label || t.identifier) + "]"), t.type === "imageReference")
    return [{ type: "text", value: "![" + t.alt + r }];
  const i = e.all(t), l = i[0];
  l && l.type === "text" ? l.value = "[" + l.value : i.unshift({ type: "text", value: "[" });
  const o = i[i.length - 1];
  return o && o.type === "text" ? o.value += r : i.push({ type: "text", value: r }), i;
}
function Ov(e, t) {
  const n = String(t.identifier).toUpperCase(), r = e.definitionById.get(n);
  if (!r)
    return eh(e, t);
  const i = { src: ar(r.url || ""), alt: t.alt };
  r.title !== null && r.title !== void 0 && (i.title = r.title);
  const l = { type: "element", tagName: "img", properties: i, children: [] };
  return e.patch(t, l), e.applyData(t, l);
}
function Mv(e, t) {
  const n = { src: ar(t.url) };
  t.alt !== null && t.alt !== void 0 && (n.alt = t.alt), t.title !== null && t.title !== void 0 && (n.title = t.title);
  const r = { type: "element", tagName: "img", properties: n, children: [] };
  return e.patch(t, r), e.applyData(t, r);
}
function jv(e, t) {
  const n = { type: "text", value: t.value.replace(/\r?\n|\r/g, " ") };
  e.patch(t, n);
  const r = {
    type: "element",
    tagName: "code",
    properties: {},
    children: [n]
  };
  return e.patch(t, r), e.applyData(t, r);
}
function Bv(e, t) {
  const n = String(t.identifier).toUpperCase(), r = e.definitionById.get(n);
  if (!r)
    return eh(e, t);
  const i = { href: ar(r.url || "") };
  r.title !== null && r.title !== void 0 && (i.title = r.title);
  const l = {
    type: "element",
    tagName: "a",
    properties: i,
    children: e.all(t)
  };
  return e.patch(t, l), e.applyData(t, l);
}
function Uv(e, t) {
  const n = { href: ar(t.url) };
  t.title !== null && t.title !== void 0 && (n.title = t.title);
  const r = {
    type: "element",
    tagName: "a",
    properties: n,
    children: e.all(t)
  };
  return e.patch(t, r), e.applyData(t, r);
}
function $v(e, t, n) {
  const r = e.all(t), i = n ? Hv(n) : th(t), l = {}, o = [];
  if (typeof t.checked == "boolean") {
    const f = r[0];
    let c;
    f && f.type === "element" && f.tagName === "p" ? c = f : (c = { type: "element", tagName: "p", properties: {}, children: [] }, r.unshift(c)), c.children.length > 0 && c.children.unshift({ type: "text", value: " " }), c.children.unshift({
      type: "element",
      tagName: "input",
      properties: { type: "checkbox", checked: t.checked, disabled: !0 },
      children: []
    }), l.className = ["task-list-item"];
  }
  let u = -1;
  for (; ++u < r.length; ) {
    const f = r[u];
    (i || u !== 0 || f.type !== "element" || f.tagName !== "p") && o.push({ type: "text", value: `
` }), f.type === "element" && f.tagName === "p" && !i ? o.push(...f.children) : o.push(f);
  }
  const s = r[r.length - 1];
  s && (i || s.type !== "element" || s.tagName !== "p") && o.push({ type: "text", value: `
` });
  const a = { type: "element", tagName: "li", properties: l, children: o };
  return e.patch(t, a), e.applyData(t, a);
}
function Hv(e) {
  let t = !1;
  if (e.type === "list") {
    t = e.spread || !1;
    const n = e.children;
    let r = -1;
    for (; !t && ++r < n.length; )
      t = th(n[r]);
  }
  return t;
}
function th(e) {
  const t = e.spread;
  return t == null ? e.children.length > 1 : t;
}
function Vv(e, t) {
  const n = {}, r = e.all(t);
  let i = -1;
  for (typeof t.start == "number" && t.start !== 1 && (n.start = t.start); ++i < r.length; ) {
    const o = r[i];
    if (o.type === "element" && o.tagName === "li" && o.properties && Array.isArray(o.properties.className) && o.properties.className.includes("task-list-item")) {
      n.className = ["contains-task-list"];
      break;
    }
  }
  const l = {
    type: "element",
    tagName: t.ordered ? "ol" : "ul",
    properties: n,
    children: e.wrap(r, !0)
  };
  return e.patch(t, l), e.applyData(t, l);
}
function Wv(e, t) {
  const n = {
    type: "element",
    tagName: "p",
    properties: {},
    children: e.all(t)
  };
  return e.patch(t, n), e.applyData(t, n);
}
function Qv(e, t) {
  const n = { type: "root", children: e.wrap(e.all(t)) };
  return e.patch(t, n), e.applyData(t, n);
}
function Kv(e, t) {
  const n = {
    type: "element",
    tagName: "strong",
    properties: {},
    children: e.all(t)
  };
  return e.patch(t, n), e.applyData(t, n);
}
function qv(e, t) {
  const n = e.all(t), r = n.shift(), i = [];
  if (r) {
    const o = {
      type: "element",
      tagName: "thead",
      properties: {},
      children: e.wrap([r], !0)
    };
    e.patch(t.children[0], o), i.push(o);
  }
  if (n.length > 0) {
    const o = {
      type: "element",
      tagName: "tbody",
      properties: {},
      children: e.wrap(n, !0)
    }, u = Os(t.children[1]), s = Dd(t.children[t.children.length - 1]);
    u && s && (o.position = { start: u, end: s }), i.push(o);
  }
  const l = {
    type: "element",
    tagName: "table",
    properties: {},
    children: e.wrap(i, !0)
  };
  return e.patch(t, l), e.applyData(t, l);
}
function Yv(e, t, n) {
  const r = n ? n.children : void 0, l = (r ? r.indexOf(t) : 1) === 0 ? "th" : "td", o = n && n.type === "table" ? n.align : void 0, u = o ? o.length : t.children.length;
  let s = -1;
  const a = [];
  for (; ++s < u; ) {
    const c = t.children[s], p = {}, d = o ? o[s] : void 0;
    d && (p.align = d);
    let g = { type: "element", tagName: l, properties: p, children: [] };
    c && (g.children = e.all(c), e.patch(c, g), g = e.applyData(c, g)), a.push(g);
  }
  const f = {
    type: "element",
    tagName: "tr",
    properties: {},
    children: e.wrap(a, !0)
  };
  return e.patch(t, f), e.applyData(t, f);
}
function Xv(e, t) {
  const n = {
    type: "element",
    tagName: "td",
    // Assume body cell.
    properties: {},
    children: e.all(t)
  };
  return e.patch(t, n), e.applyData(t, n);
}
const Rc = 9, Fc = 32;
function Gv(e) {
  const t = String(e), n = /\r?\n|\r/g;
  let r = n.exec(t), i = 0;
  const l = [];
  for (; r; )
    l.push(
      Oc(t.slice(i, r.index), i > 0, !0),
      r[0]
    ), i = r.index + r[0].length, r = n.exec(t);
  return l.push(Oc(t.slice(i), i > 0, !1)), l.join("");
}
function Oc(e, t, n) {
  let r = 0, i = e.length;
  if (t) {
    let l = e.codePointAt(r);
    for (; l === Rc || l === Fc; )
      r++, l = e.codePointAt(r);
  }
  if (n) {
    let l = e.codePointAt(i - 1);
    for (; l === Rc || l === Fc; )
      i--, l = e.codePointAt(i - 1);
  }
  return i > r ? e.slice(r, i) : "";
}
function Zv(e, t) {
  const n = { type: "text", value: Gv(String(t.value)) };
  return e.patch(t, n), e.applyData(t, n);
}
function Jv(e, t) {
  const n = {
    type: "element",
    tagName: "hr",
    properties: {},
    children: []
  };
  return e.patch(t, n), e.applyData(t, n);
}
const ex = {
  blockquote: zv,
  break: Lv,
  code: bv,
  delete: Nv,
  emphasis: Av,
  footnoteReference: Dv,
  heading: Rv,
  html: Fv,
  imageReference: Ov,
  image: Mv,
  inlineCode: jv,
  linkReference: Bv,
  link: Uv,
  listItem: $v,
  list: Vv,
  paragraph: Wv,
  // @ts-expect-error: root is different, but hard to type.
  root: Qv,
  strong: Kv,
  table: qv,
  tableCell: Xv,
  tableRow: Yv,
  text: Zv,
  thematicBreak: Jv,
  toml: Li,
  yaml: Li,
  definition: Li,
  footnoteDefinition: Li
};
function Li() {
}
const nh = -1, $l = 0, Mr = 1, xl = 2, Vs = 3, Ws = 4, Qs = 5, Ks = 6, rh = 7, ih = 8, Mc = typeof self == "object" ? self : globalThis, tx = (e, t) => {
  const n = (i, l) => (e.set(l, i), i), r = (i) => {
    if (e.has(i))
      return e.get(i);
    const [l, o] = t[i];
    switch (l) {
      case $l:
      case nh:
        return n(o, i);
      case Mr: {
        const u = n([], i);
        for (const s of o)
          u.push(r(s));
        return u;
      }
      case xl: {
        const u = n({}, i);
        for (const [s, a] of o)
          u[r(s)] = r(a);
        return u;
      }
      case Vs:
        return n(new Date(o), i);
      case Ws: {
        const { source: u, flags: s } = o;
        return n(new RegExp(u, s), i);
      }
      case Qs: {
        const u = n(/* @__PURE__ */ new Map(), i);
        for (const [s, a] of o)
          u.set(r(s), r(a));
        return u;
      }
      case Ks: {
        const u = n(/* @__PURE__ */ new Set(), i);
        for (const s of o)
          u.add(r(s));
        return u;
      }
      case rh: {
        const { name: u, message: s } = o;
        return n(new Mc[u](s), i);
      }
      case ih:
        return n(BigInt(o), i);
      case "BigInt":
        return n(Object(BigInt(o)), i);
      case "ArrayBuffer":
        return n(new Uint8Array(o).buffer, o);
      case "DataView": {
        const { buffer: u } = new Uint8Array(o);
        return n(new DataView(u), o);
      }
    }
    return n(new Mc[l](o), i);
  };
  return r;
}, jc = (e) => tx(/* @__PURE__ */ new Map(), e)(0), Ln = "", { toString: nx } = {}, { keys: rx } = Object, wr = (e) => {
  const t = typeof e;
  if (t !== "object" || !e)
    return [$l, t];
  const n = nx.call(e).slice(8, -1);
  switch (n) {
    case "Array":
      return [Mr, Ln];
    case "Object":
      return [xl, Ln];
    case "Date":
      return [Vs, Ln];
    case "RegExp":
      return [Ws, Ln];
    case "Map":
      return [Qs, Ln];
    case "Set":
      return [Ks, Ln];
    case "DataView":
      return [Mr, n];
  }
  return n.includes("Array") ? [Mr, n] : n.includes("Error") ? [rh, n] : [xl, n];
}, bi = ([e, t]) => e === $l && (t === "function" || t === "symbol"), ix = (e, t, n, r) => {
  const i = (o, u) => {
    const s = r.push(o) - 1;
    return n.set(u, s), s;
  }, l = (o) => {
    if (n.has(o))
      return n.get(o);
    let [u, s] = wr(o);
    switch (u) {
      case $l: {
        let f = o;
        switch (s) {
          case "bigint":
            u = ih, f = o.toString();
            break;
          case "function":
          case "symbol":
            if (e)
              throw new TypeError("unable to serialize " + s);
            f = null;
            break;
          case "undefined":
            return i([nh], o);
        }
        return i([u, f], o);
      }
      case Mr: {
        if (s) {
          let p = o;
          return s === "DataView" ? p = new Uint8Array(o.buffer) : s === "ArrayBuffer" && (p = new Uint8Array(o)), i([s, [...p]], o);
        }
        const f = [], c = i([u, f], o);
        for (const p of o)
          f.push(l(p));
        return c;
      }
      case xl: {
        if (s)
          switch (s) {
            case "BigInt":
              return i([s, o.toString()], o);
            case "Boolean":
            case "Number":
            case "String":
              return i([s, o.valueOf()], o);
          }
        if (t && "toJSON" in o)
          return l(o.toJSON());
        const f = [], c = i([u, f], o);
        for (const p of rx(o))
          (e || !bi(wr(o[p]))) && f.push([l(p), l(o[p])]);
        return c;
      }
      case Vs:
        return i([u, o.toISOString()], o);
      case Ws: {
        const { source: f, flags: c } = o;
        return i([u, { source: f, flags: c }], o);
      }
      case Qs: {
        const f = [], c = i([u, f], o);
        for (const [p, d] of o)
          (e || !(bi(wr(p)) || bi(wr(d)))) && f.push([l(p), l(d)]);
        return c;
      }
      case Ks: {
        const f = [], c = i([u, f], o);
        for (const p of o)
          (e || !bi(wr(p))) && f.push(l(p));
        return c;
      }
    }
    const { message: a } = o;
    return i([u, { name: s, message: a }], o);
  };
  return l;
}, Bc = (e, { json: t, lossy: n } = {}) => {
  const r = [];
  return ix(!(t || n), !!t, /* @__PURE__ */ new Map(), r)(e), r;
}, wl = typeof structuredClone == "function" ? (
  /* c8 ignore start */
  (e, t) => t && ("json" in t || "lossy" in t) ? jc(Bc(e, t)) : structuredClone(e)
) : (e, t) => jc(Bc(e, t));
function lx(e, t) {
  const n = [{ type: "text", value: "↩" }];
  return t > 1 && n.push({
    type: "element",
    tagName: "sup",
    properties: {},
    children: [{ type: "text", value: String(t) }]
  }), n;
}
function ox(e, t) {
  return "Back to reference " + (e + 1) + (t > 1 ? "-" + t : "");
}
function ux(e) {
  const t = typeof e.options.clobberPrefix == "string" ? e.options.clobberPrefix : "user-content-", n = e.options.footnoteBackContent || lx, r = e.options.footnoteBackLabel || ox, i = e.options.footnoteLabel || "Footnotes", l = e.options.footnoteLabelTagName || "h2", o = e.options.footnoteLabelProperties || {
    className: ["sr-only"]
  }, u = [];
  let s = -1;
  for (; ++s < e.footnoteOrder.length; ) {
    const a = e.footnoteById.get(
      e.footnoteOrder[s]
    );
    if (!a)
      continue;
    const f = e.all(a), c = String(a.identifier).toUpperCase(), p = ar(c.toLowerCase());
    let d = 0;
    const g = [], x = e.footnoteCounts.get(c);
    for (; x !== void 0 && ++d <= x; ) {
      g.length > 0 && g.push({ type: "text", value: " " });
      let m = typeof n == "string" ? n : n(s, d);
      typeof m == "string" && (m = { type: "text", value: m }), g.push({
        type: "element",
        tagName: "a",
        properties: {
          href: "#" + t + "fnref-" + p + (d > 1 ? "-" + d : ""),
          dataFootnoteBackref: "",
          ariaLabel: typeof r == "string" ? r : r(s, d),
          className: ["data-footnote-backref"]
        },
        children: Array.isArray(m) ? m : [m]
      });
    }
    const T = f[f.length - 1];
    if (T && T.type === "element" && T.tagName === "p") {
      const m = T.children[T.children.length - 1];
      m && m.type === "text" ? m.value += " " : T.children.push({ type: "text", value: " " }), T.children.push(...g);
    } else
      f.push(...g);
    const h = {
      type: "element",
      tagName: "li",
      properties: { id: t + "fn-" + p },
      children: e.wrap(f, !0)
    };
    e.patch(a, h), u.push(h);
  }
  if (u.length !== 0)
    return {
      type: "element",
      tagName: "section",
      properties: { dataFootnotes: !0, className: ["footnotes"] },
      children: [
        {
          type: "element",
          tagName: l,
          properties: {
            ...wl(o),
            id: "footnote-label"
          },
          children: [{ type: "text", value: i }]
        },
        { type: "text", value: `
` },
        {
          type: "element",
          tagName: "ol",
          properties: {},
          children: e.wrap(u, !0)
        },
        { type: "text", value: `
` }
      ]
    };
}
const Hl = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  function(e) {
    if (e == null)
      return fx;
    if (typeof e == "function")
      return Vl(e);
    if (typeof e == "object")
      return Array.isArray(e) ? sx(e) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        ax(
          /** @type {Props} */
          e
        )
      );
    if (typeof e == "string")
      return cx(e);
    throw new Error("Expected function, string, or object as test");
  }
);
function sx(e) {
  const t = [];
  let n = -1;
  for (; ++n < e.length; )
    t[n] = Hl(e[n]);
  return Vl(r);
  function r(...i) {
    let l = -1;
    for (; ++l < t.length; )
      if (t[l].apply(this, i)) return !0;
    return !1;
  }
}
function ax(e) {
  const t = (
    /** @type {Record<string, unknown>} */
    e
  );
  return Vl(n);
  function n(r) {
    const i = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      r
    );
    let l;
    for (l in e)
      if (i[l] !== t[l]) return !1;
    return !0;
  }
}
function cx(e) {
  return Vl(t);
  function t(n) {
    return n && n.type === e;
  }
}
function Vl(e) {
  return t;
  function t(n, r, i) {
    return !!(px(n) && e.call(
      this,
      n,
      typeof r == "number" ? r : void 0,
      i || void 0
    ));
  }
}
function fx() {
  return !0;
}
function px(e) {
  return e !== null && typeof e == "object" && "type" in e;
}
const lh = [], dx = !0, Au = !1, hx = "skip";
function oh(e, t, n, r) {
  let i;
  typeof t == "function" && typeof n != "function" ? (r = n, n = t) : i = t;
  const l = Hl(i), o = r ? -1 : 1;
  u(e, void 0, [])();
  function u(s, a, f) {
    const c = (
      /** @type {Record<string, unknown>} */
      s && typeof s == "object" ? s : {}
    );
    if (typeof c.type == "string") {
      const d = (
        // `hast`
        typeof c.tagName == "string" ? c.tagName : (
          // `xast`
          typeof c.name == "string" ? c.name : void 0
        )
      );
      Object.defineProperty(p, "name", {
        value: "node (" + (s.type + (d ? "<" + d + ">" : "")) + ")"
      });
    }
    return p;
    function p() {
      let d = lh, g, x, T;
      if ((!t || l(s, a, f[f.length - 1] || void 0)) && (d = mx(n(s, f)), d[0] === Au))
        return d;
      if ("children" in s && s.children) {
        const h = (
          /** @type {UnistParent} */
          s
        );
        if (h.children && d[0] !== hx)
          for (x = (r ? h.children.length : -1) + o, T = f.concat(h); x > -1 && x < h.children.length; ) {
            const m = h.children[x];
            if (g = u(m, x, T)(), g[0] === Au)
              return g;
            x = typeof g[1] == "number" ? g[1] : x + o;
          }
      }
      return d;
    }
  }
}
function mx(e) {
  return Array.isArray(e) ? e : typeof e == "number" ? [dx, e] : e == null ? lh : [e];
}
function qs(e, t, n, r) {
  let i, l, o;
  typeof t == "function" && typeof n != "function" ? (l = void 0, o = t, i = n) : (l = t, o = n, i = r), oh(e, l, u, i);
  function u(s, a) {
    const f = a[a.length - 1], c = f ? f.children.indexOf(s) : void 0;
    return o(s, c, f);
  }
}
const Du = {}.hasOwnProperty, gx = {};
function yx(e, t) {
  const n = t || gx, r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), o = { ...ex, ...n.handlers }, u = {
    all: a,
    applyData: vx,
    definitionById: r,
    footnoteById: i,
    footnoteCounts: l,
    footnoteOrder: [],
    handlers: o,
    one: s,
    options: n,
    patch: kx,
    wrap: wx
  };
  return qs(e, function(f) {
    if (f.type === "definition" || f.type === "footnoteDefinition") {
      const c = f.type === "definition" ? r : i, p = String(f.identifier).toUpperCase();
      c.has(p) || c.set(p, f);
    }
  }), u;
  function s(f, c) {
    const p = f.type, d = u.handlers[p];
    if (Du.call(u.handlers, p) && d)
      return d(u, f, c);
    if (u.options.passThrough && u.options.passThrough.includes(p)) {
      if ("children" in f) {
        const { children: x, ...T } = f, h = wl(T);
        return h.children = u.all(f), h;
      }
      return wl(f);
    }
    return (u.options.unknownHandler || xx)(u, f, c);
  }
  function a(f) {
    const c = [];
    if ("children" in f) {
      const p = f.children;
      let d = -1;
      for (; ++d < p.length; ) {
        const g = u.one(p[d], f);
        if (g) {
          if (d && p[d - 1].type === "break" && (!Array.isArray(g) && g.type === "text" && (g.value = Uc(g.value)), !Array.isArray(g) && g.type === "element")) {
            const x = g.children[0];
            x && x.type === "text" && (x.value = Uc(x.value));
          }
          Array.isArray(g) ? c.push(...g) : c.push(g);
        }
      }
    }
    return c;
  }
}
function kx(e, t) {
  e.position && (t.position = o1(e));
}
function vx(e, t) {
  let n = t;
  if (e && e.data) {
    const r = e.data.hName, i = e.data.hChildren, l = e.data.hProperties;
    if (typeof r == "string")
      if (n.type === "element")
        n.tagName = r;
      else {
        const o = "children" in n ? n.children : [n];
        n = { type: "element", tagName: r, properties: {}, children: o };
      }
    n.type === "element" && l && Object.assign(n.properties, wl(l)), "children" in n && n.children && i !== null && i !== void 0 && (n.children = i);
  }
  return n;
}
function xx(e, t) {
  const n = t.data || {}, r = "value" in t && !(Du.call(n, "hProperties") || Du.call(n, "hChildren")) ? { type: "text", value: t.value } : {
    type: "element",
    tagName: "div",
    properties: {},
    children: e.all(t)
  };
  return e.patch(t, r), e.applyData(t, r);
}
function wx(e, t) {
  const n = [];
  let r = -1;
  for (t && n.push({ type: "text", value: `
` }); ++r < e.length; )
    r && n.push({ type: "text", value: `
` }), n.push(e[r]);
  return t && e.length > 0 && n.push({ type: "text", value: `
` }), n;
}
function Uc(e) {
  let t = 0, n = e.charCodeAt(t);
  for (; n === 9 || n === 32; )
    t++, n = e.charCodeAt(t);
  return e.slice(t);
}
function $c(e, t) {
  const n = yx(e, t), r = n.one(e, void 0), i = ux(n), l = Array.isArray(r) ? { type: "root", children: r } : r || { type: "root", children: [] };
  return i && l.children.push({ type: "text", value: `
` }, i), l;
}
function Sx(e, t) {
  return e && "run" in e ? async function(n, r) {
    const i = (
      /** @type {HastRoot} */
      $c(n, { file: r, ...t })
    );
    await e.run(i, r);
  } : function(n, r) {
    return (
      /** @type {HastRoot} */
      $c(n, { file: r, ...e || t })
    );
  };
}
function Hc(e) {
  if (e)
    throw e;
}
var Ki = Object.prototype.hasOwnProperty, uh = Object.prototype.toString, Vc = Object.defineProperty, Wc = Object.getOwnPropertyDescriptor, Qc = function(t) {
  return typeof Array.isArray == "function" ? Array.isArray(t) : uh.call(t) === "[object Array]";
}, Kc = function(t) {
  if (!t || uh.call(t) !== "[object Object]")
    return !1;
  var n = Ki.call(t, "constructor"), r = t.constructor && t.constructor.prototype && Ki.call(t.constructor.prototype, "isPrototypeOf");
  if (t.constructor && !n && !r)
    return !1;
  var i;
  for (i in t)
    ;
  return typeof i == "undefined" || Ki.call(t, i);
}, qc = function(t, n) {
  Vc && n.name === "__proto__" ? Vc(t, n.name, {
    enumerable: !0,
    configurable: !0,
    value: n.newValue,
    writable: !0
  }) : t[n.name] = n.newValue;
}, Yc = function(t, n) {
  if (n === "__proto__")
    if (Ki.call(t, n)) {
      if (Wc)
        return Wc(t, n).value;
    } else return;
  return t[n];
}, Cx = function e() {
  var t, n, r, i, l, o, u = arguments[0], s = 1, a = arguments.length, f = !1;
  for (typeof u == "boolean" && (f = u, u = arguments[1] || {}, s = 2), (u == null || typeof u != "object" && typeof u != "function") && (u = {}); s < a; ++s)
    if (t = arguments[s], t != null)
      for (n in t)
        r = Yc(u, n), i = Yc(t, n), u !== i && (f && i && (Kc(i) || (l = Qc(i))) ? (l ? (l = !1, o = r && Qc(r) ? r : []) : o = r && Kc(r) ? r : {}, qc(u, { name: n, newValue: e(f, o, i) })) : typeof i != "undefined" && qc(u, { name: n, newValue: i }));
  return u;
};
const So = /* @__PURE__ */ df(Cx);
function Ru(e) {
  if (typeof e != "object" || e === null)
    return !1;
  const t = Object.getPrototypeOf(e);
  return (t === null || t === Object.prototype || Object.getPrototypeOf(t) === null) && !(Symbol.toStringTag in e) && !(Symbol.iterator in e);
}
function Ex() {
  const e = [], t = { run: n, use: r };
  return t;
  function n(...i) {
    let l = -1;
    const o = i.pop();
    if (typeof o != "function")
      throw new TypeError("Expected function as last argument, not " + o);
    u(null, ...i);
    function u(s, ...a) {
      const f = e[++l];
      let c = -1;
      if (s) {
        o(s);
        return;
      }
      for (; ++c < i.length; )
        (a[c] === null || a[c] === void 0) && (a[c] = i[c]);
      i = a, f ? Tx(f, u)(...a) : o(null, ...a);
    }
  }
  function r(i) {
    if (typeof i != "function")
      throw new TypeError(
        "Expected `middelware` to be a function, not " + i
      );
    return e.push(i), t;
  }
}
function Tx(e, t) {
  let n;
  return r;
  function r(...o) {
    const u = e.length > o.length;
    let s;
    u && o.push(i);
    try {
      s = e.apply(this, o);
    } catch (a) {
      const f = (
        /** @type {Error} */
        a
      );
      if (u && n)
        throw f;
      return i(f);
    }
    u || (s && s.then && typeof s.then == "function" ? s.then(l, i) : s instanceof Error ? i(s) : l(s));
  }
  function i(o, ...u) {
    n || (n = !0, t(o, ...u));
  }
  function l(o) {
    i(null, o);
  }
}
const kt = { basename: _x, dirname: Ix, extname: Px, join: zx, sep: "/" };
function _x(e, t) {
  if (t !== void 0 && typeof t != "string")
    throw new TypeError('"ext" argument must be a string');
  fi(e);
  let n = 0, r = -1, i = e.length, l;
  if (t === void 0 || t.length === 0 || t.length > e.length) {
    for (; i--; )
      if (e.codePointAt(i) === 47) {
        if (l) {
          n = i + 1;
          break;
        }
      } else r < 0 && (l = !0, r = i + 1);
    return r < 0 ? "" : e.slice(n, r);
  }
  if (t === e)
    return "";
  let o = -1, u = t.length - 1;
  for (; i--; )
    if (e.codePointAt(i) === 47) {
      if (l) {
        n = i + 1;
        break;
      }
    } else
      o < 0 && (l = !0, o = i + 1), u > -1 && (e.codePointAt(i) === t.codePointAt(u--) ? u < 0 && (r = i) : (u = -1, r = o));
  return n === r ? r = o : r < 0 && (r = e.length), e.slice(n, r);
}
function Ix(e) {
  if (fi(e), e.length === 0)
    return ".";
  let t = -1, n = e.length, r;
  for (; --n; )
    if (e.codePointAt(n) === 47) {
      if (r) {
        t = n;
        break;
      }
    } else r || (r = !0);
  return t < 0 ? e.codePointAt(0) === 47 ? "/" : "." : t === 1 && e.codePointAt(0) === 47 ? "//" : e.slice(0, t);
}
function Px(e) {
  fi(e);
  let t = e.length, n = -1, r = 0, i = -1, l = 0, o;
  for (; t--; ) {
    const u = e.codePointAt(t);
    if (u === 47) {
      if (o) {
        r = t + 1;
        break;
      }
      continue;
    }
    n < 0 && (o = !0, n = t + 1), u === 46 ? i < 0 ? i = t : l !== 1 && (l = 1) : i > -1 && (l = -1);
  }
  return i < 0 || n < 0 || // We saw a non-dot character immediately before the dot.
  l === 0 || // The (right-most) trimmed path component is exactly `..`.
  l === 1 && i === n - 1 && i === r + 1 ? "" : e.slice(i, n);
}
function zx(...e) {
  let t = -1, n;
  for (; ++t < e.length; )
    fi(e[t]), e[t] && (n = n === void 0 ? e[t] : n + "/" + e[t]);
  return n === void 0 ? "." : Lx(n);
}
function Lx(e) {
  fi(e);
  const t = e.codePointAt(0) === 47;
  let n = bx(e, !t);
  return n.length === 0 && !t && (n = "."), n.length > 0 && e.codePointAt(e.length - 1) === 47 && (n += "/"), t ? "/" + n : n;
}
function bx(e, t) {
  let n = "", r = 0, i = -1, l = 0, o = -1, u, s;
  for (; ++o <= e.length; ) {
    if (o < e.length)
      u = e.codePointAt(o);
    else {
      if (u === 47)
        break;
      u = 47;
    }
    if (u === 47) {
      if (!(i === o - 1 || l === 1)) if (i !== o - 1 && l === 2) {
        if (n.length < 2 || r !== 2 || n.codePointAt(n.length - 1) !== 46 || n.codePointAt(n.length - 2) !== 46) {
          if (n.length > 2) {
            if (s = n.lastIndexOf("/"), s !== n.length - 1) {
              s < 0 ? (n = "", r = 0) : (n = n.slice(0, s), r = n.length - 1 - n.lastIndexOf("/")), i = o, l = 0;
              continue;
            }
          } else if (n.length > 0) {
            n = "", r = 0, i = o, l = 0;
            continue;
          }
        }
        t && (n = n.length > 0 ? n + "/.." : "..", r = 2);
      } else
        n.length > 0 ? n += "/" + e.slice(i + 1, o) : n = e.slice(i + 1, o), r = o - i - 1;
      i = o, l = 0;
    } else u === 46 && l > -1 ? l++ : l = -1;
  }
  return n;
}
function fi(e) {
  if (typeof e != "string")
    throw new TypeError(
      "Path must be a string. Received " + JSON.stringify(e)
    );
}
const Nx = { cwd: Ax };
function Ax() {
  return "/";
}
function Fu(e) {
  return !!(e !== null && typeof e == "object" && "href" in e && e.href && "protocol" in e && e.protocol && // @ts-expect-error: indexing is fine.
  e.auth === void 0);
}
function Dx(e) {
  if (typeof e == "string")
    e = new URL(e);
  else if (!Fu(e)) {
    const t = new TypeError(
      'The "path" argument must be of type string or an instance of URL. Received `' + e + "`"
    );
    throw t.code = "ERR_INVALID_ARG_TYPE", t;
  }
  if (e.protocol !== "file:") {
    const t = new TypeError("The URL must be of scheme file");
    throw t.code = "ERR_INVALID_URL_SCHEME", t;
  }
  return Rx(e);
}
function Rx(e) {
  if (e.hostname !== "") {
    const r = new TypeError(
      'File URL host must be "localhost" or empty on darwin'
    );
    throw r.code = "ERR_INVALID_FILE_URL_HOST", r;
  }
  const t = e.pathname;
  let n = -1;
  for (; ++n < t.length; )
    if (t.codePointAt(n) === 37 && t.codePointAt(n + 1) === 50) {
      const r = t.codePointAt(n + 2);
      if (r === 70 || r === 102) {
        const i = new TypeError(
          "File URL path must not include encoded / characters"
        );
        throw i.code = "ERR_INVALID_FILE_URL_PATH", i;
      }
    }
  return decodeURIComponent(t);
}
const Co = (
  /** @type {const} */
  [
    "history",
    "path",
    "basename",
    "stem",
    "extname",
    "dirname"
  ]
);
class sh {
  /**
   * Create a new virtual file.
   *
   * `options` is treated as:
   *
   * *   `string` or `Uint8Array` — `{value: options}`
   * *   `URL` — `{path: options}`
   * *   `VFile` — shallow copies its data over to the new file
   * *   `object` — all fields are shallow copied over to the new file
   *
   * Path related fields are set in the following order (least specific to
   * most specific): `history`, `path`, `basename`, `stem`, `extname`,
   * `dirname`.
   *
   * You cannot set `dirname` or `extname` without setting either `history`,
   * `path`, `basename`, or `stem` too.
   *
   * @param {Compatible | null | undefined} [value]
   *   File value.
   * @returns
   *   New instance.
   */
  constructor(t) {
    let n;
    t ? Fu(t) ? n = { path: t } : typeof t == "string" || Fx(t) ? n = { value: t } : n = t : n = {}, this.cwd = "cwd" in n ? "" : Nx.cwd(), this.data = {}, this.history = [], this.messages = [], this.value, this.map, this.result, this.stored;
    let r = -1;
    for (; ++r < Co.length; ) {
      const l = Co[r];
      l in n && n[l] !== void 0 && n[l] !== null && (this[l] = l === "history" ? [...n[l]] : n[l]);
    }
    let i;
    for (i in n)
      Co.includes(i) || (this[i] = n[i]);
  }
  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   *
   * @returns {string | undefined}
   *   Basename.
   */
  get basename() {
    return typeof this.path == "string" ? kt.basename(this.path) : void 0;
  }
  /**
   * Set basename (including extname) (`'index.min.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} basename
   *   Basename.
   * @returns {undefined}
   *   Nothing.
   */
  set basename(t) {
    To(t, "basename"), Eo(t, "basename"), this.path = kt.join(this.dirname || "", t);
  }
  /**
   * Get the parent path (example: `'~'`).
   *
   * @returns {string | undefined}
   *   Dirname.
   */
  get dirname() {
    return typeof this.path == "string" ? kt.dirname(this.path) : void 0;
  }
  /**
   * Set the parent path (example: `'~'`).
   *
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} dirname
   *   Dirname.
   * @returns {undefined}
   *   Nothing.
   */
  set dirname(t) {
    Xc(this.basename, "dirname"), this.path = kt.join(t || "", this.basename);
  }
  /**
   * Get the extname (including dot) (example: `'.js'`).
   *
   * @returns {string | undefined}
   *   Extname.
   */
  get extname() {
    return typeof this.path == "string" ? kt.extname(this.path) : void 0;
  }
  /**
   * Set the extname (including dot) (example: `'.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} extname
   *   Extname.
   * @returns {undefined}
   *   Nothing.
   */
  set extname(t) {
    if (Eo(t, "extname"), Xc(this.dirname, "extname"), t) {
      if (t.codePointAt(0) !== 46)
        throw new Error("`extname` must start with `.`");
      if (t.includes(".", 1))
        throw new Error("`extname` cannot contain multiple dots");
    }
    this.path = kt.join(this.dirname, this.stem + (t || ""));
  }
  /**
   * Get the full path (example: `'~/index.min.js'`).
   *
   * @returns {string}
   *   Path.
   */
  get path() {
    return this.history[this.history.length - 1];
  }
  /**
   * Set the full path (example: `'~/index.min.js'`).
   *
   * Cannot be nullified.
   * You can set a file URL (a `URL` object with a `file:` protocol) which will
   * be turned into a path with `url.fileURLToPath`.
   *
   * @param {URL | string} path
   *   Path.
   * @returns {undefined}
   *   Nothing.
   */
  set path(t) {
    Fu(t) && (t = Dx(t)), To(t, "path"), this.path !== t && this.history.push(t);
  }
  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   *
   * @returns {string | undefined}
   *   Stem.
   */
  get stem() {
    return typeof this.path == "string" ? kt.basename(this.path, this.extname) : void 0;
  }
  /**
   * Set the stem (basename w/o extname) (example: `'index.min'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} stem
   *   Stem.
   * @returns {undefined}
   *   Nothing.
   */
  set stem(t) {
    To(t, "stem"), Eo(t, "stem"), this.path = kt.join(this.dirname || "", t + (this.extname || ""));
  }
  // Normal prototypal methods.
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(t, n, r) {
    const i = this.message(t, n, r);
    throw i.fatal = !0, i;
  }
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(t, n, r) {
    const i = this.message(t, n, r);
    return i.fatal = void 0, i;
  }
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(t, n, r) {
    const i = new ze(
      // @ts-expect-error: the overloads are fine.
      t,
      n,
      r
    );
    return this.path && (i.name = this.path + ":" + i.name, i.file = this.path), i.fatal = !1, this.messages.push(i), i;
  }
  /**
   * Serialize the file.
   *
   * > **Note**: which encodings are supported depends on the engine.
   * > For info on Node.js, see:
   * > <https://nodejs.org/api/util.html#whatwg-supported-encodings>.
   *
   * @param {string | null | undefined} [encoding='utf8']
   *   Character encoding to understand `value` as when it’s a `Uint8Array`
   *   (default: `'utf-8'`).
   * @returns {string}
   *   Serialized file.
   */
  toString(t) {
    return this.value === void 0 ? "" : typeof this.value == "string" ? this.value : new TextDecoder(t || void 0).decode(this.value);
  }
}
function Eo(e, t) {
  if (e && e.includes(kt.sep))
    throw new Error(
      "`" + t + "` cannot be a path: did not expect `" + kt.sep + "`"
    );
}
function To(e, t) {
  if (!e)
    throw new Error("`" + t + "` cannot be empty");
}
function Xc(e, t) {
  if (!e)
    throw new Error("Setting `" + t + "` requires `path` to be set too");
}
function Fx(e) {
  return !!(e && typeof e == "object" && "byteLength" in e && "byteOffset" in e);
}
const Ox = (
  /**
   * @type {new <Parameters extends Array<unknown>, Result>(property: string | symbol) => (...parameters: Parameters) => Result}
   */
  /** @type {unknown} */
  /**
   * @this {Function}
   * @param {string | symbol} property
   * @returns {(...parameters: Array<unknown>) => unknown}
   */
  function(e) {
    const r = (
      /** @type {Record<string | symbol, Function>} */
      // Prototypes do exist.
      // type-coverage:ignore-next-line
      this.constructor.prototype
    ), i = r[e], l = function() {
      return i.apply(l, arguments);
    };
    return Object.setPrototypeOf(l, r), l;
  }
), Mx = {}.hasOwnProperty;
class Ys extends Ox {
  /**
   * Create a processor.
   */
  constructor() {
    super("copy"), this.Compiler = void 0, this.Parser = void 0, this.attachers = [], this.compiler = void 0, this.freezeIndex = -1, this.frozen = void 0, this.namespace = {}, this.parser = void 0, this.transformers = Ex();
  }
  /**
   * Copy a processor.
   *
   * @deprecated
   *   This is a private internal method and should not be used.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   New *unfrozen* processor ({@linkcode Processor}) that is
   *   configured to work the same as its ancestor.
   *   When the descendant processor is configured in the future it does not
   *   affect the ancestral processor.
   */
  copy() {
    const t = (
      /** @type {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>} */
      new Ys()
    );
    let n = -1;
    for (; ++n < this.attachers.length; ) {
      const r = this.attachers[n];
      t.use(...r);
    }
    return t.data(So(!0, {}, this.namespace)), t;
  }
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data(t, n) {
    return typeof t == "string" ? arguments.length === 2 ? (Po("data", this.frozen), this.namespace[t] = n, this) : Mx.call(this.namespace, t) && this.namespace[t] || void 0 : t ? (Po("data", this.frozen), this.namespace = t, this) : this.namespace;
  }
  /**
   * Freeze a processor.
   *
   * Frozen processors are meant to be extended and not to be configured
   * directly.
   *
   * When a processor is frozen it cannot be unfrozen.
   * New processors working the same way can be created by calling the
   * processor.
   *
   * It’s possible to freeze processors explicitly by calling `.freeze()`.
   * Processors freeze automatically when `.parse()`, `.run()`, `.runSync()`,
   * `.stringify()`, `.process()`, or `.processSync()` are called.
   *
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   The current processor.
   */
  freeze() {
    if (this.frozen)
      return this;
    const t = (
      /** @type {Processor} */
      /** @type {unknown} */
      this
    );
    for (; ++this.freezeIndex < this.attachers.length; ) {
      const [n, ...r] = this.attachers[this.freezeIndex];
      if (r[0] === !1)
        continue;
      r[0] === !0 && (r[0] = void 0);
      const i = n.call(t, ...r);
      typeof i == "function" && this.transformers.use(i);
    }
    return this.frozen = !0, this.freezeIndex = Number.POSITIVE_INFINITY, this;
  }
  /**
   * Parse text to a syntax tree.
   *
   * > **Note**: `parse` freezes the processor if not already *frozen*.
   *
   * > **Note**: `parse` performs the parse phase, not the run phase or other
   * > phases.
   *
   * @param {Compatible | undefined} [file]
   *   file to parse (optional); typically `string` or `VFile`; any value
   *   accepted as `x` in `new VFile(x)`.
   * @returns {ParseTree extends undefined ? Node : ParseTree}
   *   Syntax tree representing `file`.
   */
  parse(t) {
    this.freeze();
    const n = Ni(t), r = this.parser || this.Parser;
    return _o("parse", r), r(String(n), n);
  }
  /**
   * Process the given file as configured on the processor.
   *
   * > **Note**: `process` freezes the processor if not already *frozen*.
   *
   * > **Note**: `process` performs the parse, run, and stringify phases.
   *
   * @overload
   * @param {Compatible | undefined} file
   * @param {ProcessCallback<VFileWithOutput<CompileResult>>} done
   * @returns {undefined}
   *
   * @overload
   * @param {Compatible | undefined} [file]
   * @returns {Promise<VFileWithOutput<CompileResult>>}
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`]; any value accepted as
   *   `x` in `new VFile(x)`.
   * @param {ProcessCallback<VFileWithOutput<CompileResult>> | undefined} [done]
   *   Callback (optional).
   * @returns {Promise<VFile> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise a promise, rejected with a fatal error or resolved with the
   *   processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  process(t, n) {
    const r = this;
    return this.freeze(), _o("process", this.parser || this.Parser), Io("process", this.compiler || this.Compiler), n ? i(void 0, n) : new Promise(i);
    function i(l, o) {
      const u = Ni(t), s = (
        /** @type {HeadTree extends undefined ? Node : HeadTree} */
        /** @type {unknown} */
        r.parse(u)
      );
      r.run(s, u, function(f, c, p) {
        if (f || !c || !p)
          return a(f);
        const d = (
          /** @type {CompileTree extends undefined ? Node : CompileTree} */
          /** @type {unknown} */
          c
        ), g = r.stringify(d, p);
        Ux(g) ? p.value = g : p.result = g, a(
          f,
          /** @type {VFileWithOutput<CompileResult>} */
          p
        );
      });
      function a(f, c) {
        f || !c ? o(f) : l ? l(c) : n(void 0, c);
      }
    }
  }
  /**
   * Process the given file as configured on the processor.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `processSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `processSync` performs the parse, run, and stringify phases.
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`; any value accepted as
   *   `x` in `new VFile(x)`.
   * @returns {VFileWithOutput<CompileResult>}
   *   The processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  processSync(t) {
    let n = !1, r;
    return this.freeze(), _o("processSync", this.parser || this.Parser), Io("processSync", this.compiler || this.Compiler), this.process(t, i), Zc("processSync", "process", n), r;
    function i(l, o) {
      n = !0, Hc(l), r = o;
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(t, n, r) {
    Gc(t), this.freeze();
    const i = this.transformers;
    return !r && typeof n == "function" && (r = n, n = void 0), r ? l(void 0, r) : new Promise(l);
    function l(o, u) {
      const s = Ni(n);
      i.run(t, s, a);
      function a(f, c, p) {
        const d = (
          /** @type {TailTree extends undefined ? Node : TailTree} */
          c || t
        );
        f ? u(f) : o ? o(d) : r(void 0, d, p);
      }
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `runSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `runSync` performs the run phase, not other phases.
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {TailTree extends undefined ? Node : TailTree}
   *   Transformed tree.
   */
  runSync(t, n) {
    let r = !1, i;
    return this.run(t, n, l), Zc("runSync", "run", r), i;
    function l(o, u) {
      Hc(o), i = u, r = !0;
    }
  }
  /**
   * Compile a syntax tree.
   *
   * > **Note**: `stringify` freezes the processor if not already *frozen*.
   *
   * > **Note**: `stringify` performs the stringify phase, not the run phase
   * > or other phases.
   *
   * @param {CompileTree extends undefined ? Node : CompileTree} tree
   *   Tree to compile.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {CompileResult extends undefined ? Value : CompileResult}
   *   Textual representation of the tree (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most compilers
   *   > return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  stringify(t, n) {
    this.freeze();
    const r = Ni(n), i = this.compiler || this.Compiler;
    return Io("stringify", i), Gc(t), i(t, r);
  }
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use(t, ...n) {
    const r = this.attachers, i = this.namespace;
    if (Po("use", this.frozen), t != null) if (typeof t == "function")
      s(t, n);
    else if (typeof t == "object")
      Array.isArray(t) ? u(t) : o(t);
    else
      throw new TypeError("Expected usable value, not `" + t + "`");
    return this;
    function l(a) {
      if (typeof a == "function")
        s(a, []);
      else if (typeof a == "object")
        if (Array.isArray(a)) {
          const [f, ...c] = (
            /** @type {PluginTuple<Array<unknown>>} */
            a
          );
          s(f, c);
        } else
          o(a);
      else
        throw new TypeError("Expected usable value, not `" + a + "`");
    }
    function o(a) {
      if (!("plugins" in a) && !("settings" in a))
        throw new Error(
          "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither"
        );
      u(a.plugins), a.settings && (i.settings = So(!0, i.settings, a.settings));
    }
    function u(a) {
      let f = -1;
      if (a != null) if (Array.isArray(a))
        for (; ++f < a.length; ) {
          const c = a[f];
          l(c);
        }
      else
        throw new TypeError("Expected a list of plugins, not `" + a + "`");
    }
    function s(a, f) {
      let c = -1, p = -1;
      for (; ++c < r.length; )
        if (r[c][0] === a) {
          p = c;
          break;
        }
      if (p === -1)
        r.push([a, ...f]);
      else if (f.length > 0) {
        let [d, ...g] = f;
        const x = r[p][1];
        Ru(x) && Ru(d) && (d = So(!0, x, d)), r[p] = [a, d, ...g];
      }
    }
  }
}
const jx = new Ys().freeze();
function _o(e, t) {
  if (typeof t != "function")
    throw new TypeError("Cannot `" + e + "` without `parser`");
}
function Io(e, t) {
  if (typeof t != "function")
    throw new TypeError("Cannot `" + e + "` without `compiler`");
}
function Po(e, t) {
  if (t)
    throw new Error(
      "Cannot call `" + e + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`."
    );
}
function Gc(e) {
  if (!Ru(e) || typeof e.type != "string")
    throw new TypeError("Expected node, got `" + e + "`");
}
function Zc(e, t, n) {
  if (!n)
    throw new Error(
      "`" + e + "` finished async. Use `" + t + "` instead"
    );
}
function Ni(e) {
  return Bx(e) ? e : new sh(e);
}
function Bx(e) {
  return !!(e && typeof e == "object" && "message" in e && "messages" in e);
}
function Ux(e) {
  return typeof e == "string" || $x(e);
}
function $x(e) {
  return !!(e && typeof e == "object" && "byteLength" in e && "byteOffset" in e);
}
const Hx = "https://github.com/remarkjs/react-markdown/blob/main/changelog.md", Jc = [], ef = { allowDangerousHtml: !0 }, Vx = /^(https?|ircs?|mailto|xmpp)$/i, Wx = [
  { from: "astPlugins", id: "remove-buggy-html-in-markdown-parser" },
  { from: "allowDangerousHtml", id: "remove-buggy-html-in-markdown-parser" },
  {
    from: "allowNode",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "allowElement"
  },
  {
    from: "allowedTypes",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "allowedElements"
  },
  { from: "className", id: "remove-classname" },
  {
    from: "disallowedTypes",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "disallowedElements"
  },
  { from: "escapeHtml", id: "remove-buggy-html-in-markdown-parser" },
  { from: "includeElementIndex", id: "#remove-includeelementindex" },
  {
    from: "includeNodeIndex",
    id: "change-includenodeindex-to-includeelementindex"
  },
  { from: "linkTarget", id: "remove-linktarget" },
  { from: "plugins", id: "change-plugins-to-remarkplugins", to: "remarkPlugins" },
  { from: "rawSourcePos", id: "#remove-rawsourcepos" },
  { from: "renderers", id: "change-renderers-to-components", to: "components" },
  { from: "source", id: "change-source-to-children", to: "children" },
  { from: "sourcePos", id: "#remove-sourcepos" },
  { from: "transformImageUri", id: "#add-urltransform", to: "urlTransform" },
  { from: "transformLinkUri", id: "#add-urltransform", to: "urlTransform" }
];
function Qx(e) {
  const t = Kx(e), n = qx(e);
  return Yx(t.runSync(t.parse(n), n), e);
}
function Kx(e) {
  const t = e.rehypePlugins || Jc, n = e.remarkPlugins || Jc, r = e.remarkRehypeOptions ? { ...e.remarkRehypeOptions, ...ef } : ef;
  return jx().use(Pv).use(n).use(Sx, r).use(t);
}
function qx(e) {
  const t = e.children || "", n = new sh();
  return typeof t == "string" && (n.value = t), n;
}
function Yx(e, t) {
  const n = t.allowedElements, r = t.allowElement, i = t.components, l = t.disallowedElements, o = t.skipHtml, u = t.unwrapDisallowed, s = t.urlTransform || Xx;
  for (const f of Wx)
    Object.hasOwn(t, f.from) && ("" + f.from + (f.to ? "use `" + f.to + "` instead" : "remove it") + Hx + f.id, void 0);
  return qs(e, a), f1(e, {
    Fragment: F.Fragment,
    components: i,
    ignoreInvalidStyle: !0,
    jsx: F.jsx,
    jsxs: F.jsxs,
    passKeys: !0,
    passNode: !0
  });
  function a(f, c, p) {
    if (f.type === "raw" && p && typeof c == "number")
      return o ? p.children.splice(c, 1) : p.children[c] = { type: "text", value: f.value }, c;
    if (f.type === "element") {
      let d;
      for (d in vo)
        if (Object.hasOwn(vo, d) && Object.hasOwn(f.properties, d)) {
          const g = f.properties[d], x = vo[d];
          (x === null || x.includes(f.tagName)) && (f.properties[d] = s(String(g || ""), d, f));
        }
    }
    if (f.type === "element") {
      let d = n ? !n.includes(f.tagName) : l ? l.includes(f.tagName) : !1;
      if (!d && r && typeof c == "number" && (d = !r(f, c, p)), d && p && typeof c == "number")
        return u && f.children ? p.children.splice(c, 1, ...f.children) : p.children.splice(c, 1), c;
    }
  }
}
function Xx(e) {
  const t = e.indexOf(":"), n = e.indexOf("?"), r = e.indexOf("#"), i = e.indexOf("/");
  return (
    // If there is no protocol, it’s relative.
    t === -1 || // If the first colon is after a `?`, `#`, or `/`, it’s not a protocol.
    i !== -1 && t > i || n !== -1 && t > n || r !== -1 && t > r || // It is a protocol, it should be allowed.
    Vx.test(e.slice(0, t)) ? e : ""
  );
}
function tf(e, t) {
  const n = String(e);
  if (typeof t != "string")
    throw new TypeError("Expected character");
  let r = 0, i = n.indexOf(t);
  for (; i !== -1; )
    r++, i = n.indexOf(t, i + t.length);
  return r;
}
function Gx(e) {
  if (typeof e != "string")
    throw new TypeError("Expected a string");
  return e.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
function Zx(e, t, n) {
  const i = Hl((n || {}).ignore || []), l = Jx(t);
  let o = -1;
  for (; ++o < l.length; )
    oh(e, "text", u);
  function u(a, f) {
    let c = -1, p;
    for (; ++c < f.length; ) {
      const d = f[c], g = p ? p.children : void 0;
      if (i(
        d,
        g ? g.indexOf(d) : void 0,
        p
      ))
        return;
      p = d;
    }
    if (p)
      return s(a, f);
  }
  function s(a, f) {
    const c = f[f.length - 1], p = l[o][0], d = l[o][1];
    let g = 0;
    const T = c.children.indexOf(a);
    let h = !1, m = [];
    p.lastIndex = 0;
    let y = p.exec(a.value);
    for (; y; ) {
      const C = y.index, _ = {
        index: y.index,
        input: y.input,
        stack: [...f, a]
      };
      let w = d(...y, _);
      if (typeof w == "string" && (w = w.length > 0 ? { type: "text", value: w } : void 0), w === !1 ? p.lastIndex = C + 1 : (g !== C && m.push({
        type: "text",
        value: a.value.slice(g, C)
      }), Array.isArray(w) ? m.push(...w) : w && m.push(w), g = C + y[0].length, h = !0), !p.global)
        break;
      y = p.exec(a.value);
    }
    return h ? (g < a.value.length && m.push({ type: "text", value: a.value.slice(g) }), c.children.splice(T, 1, ...m)) : m = [a], T + m.length;
  }
}
function Jx(e) {
  const t = [];
  if (!Array.isArray(e))
    throw new TypeError("Expected find and replace tuple or list of tuples");
  const n = !e[0] || Array.isArray(e[0]) ? e : [e];
  let r = -1;
  for (; ++r < n.length; ) {
    const i = n[r];
    t.push([e0(i[0]), t0(i[1])]);
  }
  return t;
}
function e0(e) {
  return typeof e == "string" ? new RegExp(Gx(e), "g") : e;
}
function t0(e) {
  return typeof e == "function" ? e : function() {
    return e;
  };
}
const zo = "phrasing", Lo = ["autolink", "link", "image", "label"];
function n0() {
  return {
    transforms: [a0],
    enter: {
      literalAutolink: i0,
      literalAutolinkEmail: bo,
      literalAutolinkHttp: bo,
      literalAutolinkWww: bo
    },
    exit: {
      literalAutolink: s0,
      literalAutolinkEmail: u0,
      literalAutolinkHttp: l0,
      literalAutolinkWww: o0
    }
  };
}
function r0() {
  return {
    unsafe: [
      {
        character: "@",
        before: "[+\\-.\\w]",
        after: "[\\-.\\w]",
        inConstruct: zo,
        notInConstruct: Lo
      },
      {
        character: ".",
        before: "[Ww]",
        after: "[\\-.\\w]",
        inConstruct: zo,
        notInConstruct: Lo
      },
      {
        character: ":",
        before: "[ps]",
        after: "\\/",
        inConstruct: zo,
        notInConstruct: Lo
      }
    ]
  };
}
function i0(e) {
  this.enter({ type: "link", title: null, url: "", children: [] }, e);
}
function bo(e) {
  this.config.enter.autolinkProtocol.call(this, e);
}
function l0(e) {
  this.config.exit.autolinkProtocol.call(this, e);
}
function o0(e) {
  this.config.exit.data.call(this, e);
  const t = this.stack[this.stack.length - 1];
  t.type, t.url = "http://" + this.sliceSerialize(e);
}
function u0(e) {
  this.config.exit.autolinkEmail.call(this, e);
}
function s0(e) {
  this.exit(e);
}
function a0(e) {
  Zx(
    e,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, c0],
      [/(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu, f0]
    ],
    { ignore: ["link", "linkReference"] }
  );
}
function c0(e, t, n, r, i) {
  let l = "";
  if (!ah(i) || (/^w/i.test(t) && (n = t + n, t = "", l = "http://"), !p0(n)))
    return !1;
  const o = d0(n + r);
  if (!o[0]) return !1;
  const u = {
    type: "link",
    title: null,
    url: l + t + o[0],
    children: [{ type: "text", value: t + o[0] }]
  };
  return o[1] ? [u, { type: "text", value: o[1] }] : u;
}
function f0(e, t, n, r) {
  return (
    // Not an expected previous character.
    !ah(r, !0) || // Label ends in not allowed character.
    /[-\d_]$/.test(n) ? !1 : {
      type: "link",
      title: null,
      url: "mailto:" + t + "@" + n,
      children: [{ type: "text", value: t + "@" + n }]
    }
  );
}
function p0(e) {
  const t = e.split(".");
  return !(t.length < 2 || t[t.length - 1] && (/_/.test(t[t.length - 1]) || !/[a-zA-Z\d]/.test(t[t.length - 1])) || t[t.length - 2] && (/_/.test(t[t.length - 2]) || !/[a-zA-Z\d]/.test(t[t.length - 2])));
}
function d0(e) {
  const t = /[!"&'),.:;<>?\]}]+$/.exec(e);
  if (!t)
    return [e, void 0];
  e = e.slice(0, t.index);
  let n = t[0], r = n.indexOf(")");
  const i = tf(e, "(");
  let l = tf(e, ")");
  for (; r !== -1 && i > l; )
    e += n.slice(0, r + 1), n = n.slice(r + 1), r = n.indexOf(")"), l++;
  return [e, n];
}
function ah(e, t) {
  const n = e.input.charCodeAt(e.index - 1);
  return (e.index === 0 || Sn(n) || Bl(n)) && // If it’s an email, the previous character should not be a slash.
  (!t || n !== 47);
}
ch.peek = S0;
function h0() {
  this.buffer();
}
function m0(e) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, e);
}
function g0() {
  this.buffer();
}
function y0(e) {
  this.enter(
    { type: "footnoteDefinition", identifier: "", label: "", children: [] },
    e
  );
}
function k0(e) {
  const t = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = dt(
    this.sliceSerialize(e)
  ).toLowerCase(), n.label = t;
}
function v0(e) {
  this.exit(e);
}
function x0(e) {
  const t = this.resume(), n = this.stack[this.stack.length - 1];
  n.type, n.identifier = dt(
    this.sliceSerialize(e)
  ).toLowerCase(), n.label = t;
}
function w0(e) {
  this.exit(e);
}
function S0() {
  return "[";
}
function ch(e, t, n, r) {
  const i = n.createTracker(r);
  let l = i.move("[^");
  const o = n.enter("footnoteReference"), u = n.enter("reference");
  return l += i.move(
    n.safe(n.associationId(e), { after: "]", before: l })
  ), u(), o(), l += i.move("]"), l;
}
function C0() {
  return {
    enter: {
      gfmFootnoteCallString: h0,
      gfmFootnoteCall: m0,
      gfmFootnoteDefinitionLabelString: g0,
      gfmFootnoteDefinition: y0
    },
    exit: {
      gfmFootnoteCallString: k0,
      gfmFootnoteCall: v0,
      gfmFootnoteDefinitionLabelString: x0,
      gfmFootnoteDefinition: w0
    }
  };
}
function E0(e) {
  let t = !1;
  return e && e.firstLineBlank && (t = !0), {
    handlers: { footnoteDefinition: n, footnoteReference: ch },
    // This is on by default already.
    unsafe: [{ character: "[", inConstruct: ["label", "phrasing", "reference"] }]
  };
  function n(r, i, l, o) {
    const u = l.createTracker(o);
    let s = u.move("[^");
    const a = l.enter("footnoteDefinition"), f = l.enter("label");
    return s += u.move(
      l.safe(l.associationId(r), { before: s, after: "]" })
    ), f(), s += u.move("]:"), r.children && r.children.length > 0 && (u.shift(4), s += u.move(
      (t ? `
` : " ") + l.indentLines(
        l.containerFlow(r, u.current()),
        t ? fh : T0
      )
    )), a(), s;
  }
}
function T0(e, t, n) {
  return t === 0 ? e : fh(e, t, n);
}
function fh(e, t, n) {
  return (n ? "" : "    ") + e;
}
const _0 = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
];
ph.peek = b0;
function I0() {
  return {
    canContainEols: ["delete"],
    enter: { strikethrough: z0 },
    exit: { strikethrough: L0 }
  };
}
function P0() {
  return {
    unsafe: [
      {
        character: "~",
        inConstruct: "phrasing",
        notInConstruct: _0
      }
    ],
    handlers: { delete: ph }
  };
}
function z0(e) {
  this.enter({ type: "delete", children: [] }, e);
}
function L0(e) {
  this.exit(e);
}
function ph(e, t, n, r) {
  const i = n.createTracker(r), l = n.enter("strikethrough");
  let o = i.move("~~");
  return o += n.containerPhrasing(e, {
    ...i.current(),
    before: o,
    after: "~"
  }), o += i.move("~~"), l(), o;
}
function b0() {
  return "~";
}
function N0(e) {
  return e.length;
}
function A0(e, t) {
  const n = t || {}, r = (n.align || []).concat(), i = n.stringLength || N0, l = [], o = [], u = [], s = [];
  let a = 0, f = -1;
  for (; ++f < e.length; ) {
    const x = [], T = [];
    let h = -1;
    for (e[f].length > a && (a = e[f].length); ++h < e[f].length; ) {
      const m = D0(e[f][h]);
      if (n.alignDelimiters !== !1) {
        const y = i(m);
        T[h] = y, (s[h] === void 0 || y > s[h]) && (s[h] = y);
      }
      x.push(m);
    }
    o[f] = x, u[f] = T;
  }
  let c = -1;
  if (typeof r == "object" && "length" in r)
    for (; ++c < a; )
      l[c] = nf(r[c]);
  else {
    const x = nf(r);
    for (; ++c < a; )
      l[c] = x;
  }
  c = -1;
  const p = [], d = [];
  for (; ++c < a; ) {
    const x = l[c];
    let T = "", h = "";
    x === 99 ? (T = ":", h = ":") : x === 108 ? T = ":" : x === 114 && (h = ":");
    let m = n.alignDelimiters === !1 ? 1 : Math.max(
      1,
      s[c] - T.length - h.length
    );
    const y = T + "-".repeat(m) + h;
    n.alignDelimiters !== !1 && (m = T.length + m + h.length, m > s[c] && (s[c] = m), d[c] = m), p[c] = y;
  }
  o.splice(1, 0, p), u.splice(1, 0, d), f = -1;
  const g = [];
  for (; ++f < o.length; ) {
    const x = o[f], T = u[f];
    c = -1;
    const h = [];
    for (; ++c < a; ) {
      const m = x[c] || "";
      let y = "", C = "";
      if (n.alignDelimiters !== !1) {
        const _ = s[c] - (T[c] || 0), w = l[c];
        w === 114 ? y = " ".repeat(_) : w === 99 ? _ % 2 ? (y = " ".repeat(_ / 2 + 0.5), C = " ".repeat(_ / 2 - 0.5)) : (y = " ".repeat(_ / 2), C = y) : C = " ".repeat(_);
      }
      n.delimiterStart !== !1 && !c && h.push("|"), n.padding !== !1 && // Don’t add the opening space if we’re not aligning and the cell is
      // empty: there will be a closing space.
      !(n.alignDelimiters === !1 && m === "") && (n.delimiterStart !== !1 || c) && h.push(" "), n.alignDelimiters !== !1 && h.push(y), h.push(m), n.alignDelimiters !== !1 && h.push(C), n.padding !== !1 && h.push(" "), (n.delimiterEnd !== !1 || c !== a - 1) && h.push("|");
    }
    g.push(
      n.delimiterEnd === !1 ? h.join("").replace(/ +$/, "") : h.join("")
    );
  }
  return g.join(`
`);
}
function D0(e) {
  return e == null ? "" : String(e);
}
function nf(e) {
  const t = typeof e == "string" ? e.codePointAt(0) : 0;
  return t === 67 || t === 99 ? 99 : t === 76 || t === 108 ? 108 : t === 82 || t === 114 ? 114 : 0;
}
function R0(e, t, n, r) {
  const i = n.enter("blockquote"), l = n.createTracker(r);
  l.move("> "), l.shift(2);
  const o = n.indentLines(
    n.containerFlow(e, l.current()),
    F0
  );
  return i(), o;
}
function F0(e, t, n) {
  return ">" + (n ? "" : " ") + e;
}
function O0(e, t) {
  return rf(e, t.inConstruct, !0) && !rf(e, t.notInConstruct, !1);
}
function rf(e, t, n) {
  if (typeof t == "string" && (t = [t]), !t || t.length === 0)
    return n;
  let r = -1;
  for (; ++r < t.length; )
    if (e.includes(t[r]))
      return !0;
  return !1;
}
function lf(e, t, n, r) {
  let i = -1;
  for (; ++i < n.unsafe.length; )
    if (n.unsafe[i].character === `
` && O0(n.stack, n.unsafe[i]))
      return /[ \t]/.test(r.before) ? "" : " ";
  return `\\
`;
}
function M0(e, t) {
  const n = String(e);
  let r = n.indexOf(t), i = r, l = 0, o = 0;
  if (typeof t != "string")
    throw new TypeError("Expected substring");
  for (; r !== -1; )
    r === i ? ++l > o && (o = l) : l = 1, i = r + t.length, r = n.indexOf(t, i);
  return o;
}
function j0(e, t) {
  return !!(t.options.fences === !1 && e.value && // If there’s no info…
  !e.lang && // And there’s a non-whitespace character…
  /[^ \r\n]/.test(e.value) && // And the value doesn’t start or end in a blank…
  !/^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(e.value));
}
function B0(e) {
  const t = e.options.fence || "`";
  if (t !== "`" && t !== "~")
    throw new Error(
      "Cannot serialize code with `" + t + "` for `options.fence`, expected `` ` `` or `~`"
    );
  return t;
}
function U0(e, t, n, r) {
  const i = B0(n), l = e.value || "", o = i === "`" ? "GraveAccent" : "Tilde";
  if (j0(e, n)) {
    const c = n.enter("codeIndented"), p = n.indentLines(l, $0);
    return c(), p;
  }
  const u = n.createTracker(r), s = i.repeat(Math.max(M0(l, i) + 1, 3)), a = n.enter("codeFenced");
  let f = u.move(s);
  if (e.lang) {
    const c = n.enter(`codeFencedLang${o}`);
    f += u.move(
      n.safe(e.lang, {
        before: f,
        after: " ",
        encode: ["`"],
        ...u.current()
      })
    ), c();
  }
  if (e.lang && e.meta) {
    const c = n.enter(`codeFencedMeta${o}`);
    f += u.move(" "), f += u.move(
      n.safe(e.meta, {
        before: f,
        after: `
`,
        encode: ["`"],
        ...u.current()
      })
    ), c();
  }
  return f += u.move(`
`), l && (f += u.move(l + `
`)), f += u.move(s), a(), f;
}
function $0(e, t, n) {
  return (n ? "" : "    ") + e;
}
function Xs(e) {
  const t = e.options.quote || '"';
  if (t !== '"' && t !== "'")
    throw new Error(
      "Cannot serialize title with `" + t + "` for `options.quote`, expected `\"`, or `'`"
    );
  return t;
}
function H0(e, t, n, r) {
  const i = Xs(n), l = i === '"' ? "Quote" : "Apostrophe", o = n.enter("definition");
  let u = n.enter("label");
  const s = n.createTracker(r);
  let a = s.move("[");
  return a += s.move(
    n.safe(n.associationId(e), {
      before: a,
      after: "]",
      ...s.current()
    })
  ), a += s.move("]: "), u(), // If there’s no url, or…
  !e.url || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(e.url) ? (u = n.enter("destinationLiteral"), a += s.move("<"), a += s.move(
    n.safe(e.url, { before: a, after: ">", ...s.current() })
  ), a += s.move(">")) : (u = n.enter("destinationRaw"), a += s.move(
    n.safe(e.url, {
      before: a,
      after: e.title ? " " : `
`,
      ...s.current()
    })
  )), u(), e.title && (u = n.enter(`title${l}`), a += s.move(" " + i), a += s.move(
    n.safe(e.title, {
      before: a,
      after: i,
      ...s.current()
    })
  ), a += s.move(i), u()), o(), a;
}
function V0(e) {
  const t = e.options.emphasis || "*";
  if (t !== "*" && t !== "_")
    throw new Error(
      "Cannot serialize emphasis with `" + t + "` for `options.emphasis`, expected `*`, or `_`"
    );
  return t;
}
function ri(e) {
  return "&#x" + e.toString(16).toUpperCase() + ";";
}
function Sl(e, t, n) {
  const r = ir(e), i = ir(t);
  return r === void 0 ? i === void 0 ? (
    // Letter inside:
    // we have to encode *both* letters for `_` as it is looser.
    // it already forms for `*` (and GFMs `~`).
    n === "_" ? { inside: !0, outside: !0 } : { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode both (letter, whitespace).
    { inside: !0, outside: !0 }
  ) : (
    // Punctuation inside: encode outer (letter)
    { inside: !1, outside: !0 }
  ) : r === 1 ? i === void 0 ? (
    // Letter inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode both (whitespace).
    { inside: !0, outside: !0 }
  ) : (
    // Punctuation inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === void 0 ? (
    // Letter inside: already forms.
    { inside: !1, outside: !1 }
  ) : i === 1 ? (
    // Whitespace inside: encode inner (whitespace).
    { inside: !0, outside: !1 }
  ) : (
    // Punctuation inside: already forms.
    { inside: !1, outside: !1 }
  );
}
dh.peek = W0;
function dh(e, t, n, r) {
  const i = V0(n), l = n.enter("emphasis"), o = n.createTracker(r), u = o.move(i);
  let s = o.move(
    n.containerPhrasing(e, {
      after: i,
      before: u,
      ...o.current()
    })
  );
  const a = s.charCodeAt(0), f = Sl(
    r.before.charCodeAt(r.before.length - 1),
    a,
    i
  );
  f.inside && (s = ri(a) + s.slice(1));
  const c = s.charCodeAt(s.length - 1), p = Sl(r.after.charCodeAt(0), c, i);
  p.inside && (s = s.slice(0, -1) + ri(c));
  const d = o.move(i);
  return l(), n.attentionEncodeSurroundingInfo = {
    after: p.outside,
    before: f.outside
  }, u + s + d;
}
function W0(e, t, n) {
  return n.options.emphasis || "*";
}
function Q0(e, t) {
  let n = !1;
  return qs(e, function(r) {
    if ("value" in r && /\r?\n|\r/.test(r.value) || r.type === "break")
      return n = !0, Au;
  }), !!((!e.depth || e.depth < 3) && Us(e) && (t.options.setext || n));
}
function K0(e, t, n, r) {
  const i = Math.max(Math.min(6, e.depth || 1), 1), l = n.createTracker(r);
  if (Q0(e, n)) {
    const f = n.enter("headingSetext"), c = n.enter("phrasing"), p = n.containerPhrasing(e, {
      ...l.current(),
      before: `
`,
      after: `
`
    });
    return c(), f(), p + `
` + (i === 1 ? "=" : "-").repeat(
      // The whole size…
      p.length - // Minus the position of the character after the last EOL (or
      // 0 if there is none)…
      (Math.max(p.lastIndexOf("\r"), p.lastIndexOf(`
`)) + 1)
    );
  }
  const o = "#".repeat(i), u = n.enter("headingAtx"), s = n.enter("phrasing");
  l.move(o + " ");
  let a = n.containerPhrasing(e, {
    before: "# ",
    after: `
`,
    ...l.current()
  });
  return /^[\t ]/.test(a) && (a = ri(a.charCodeAt(0)) + a.slice(1)), a = a ? o + " " + a : o, n.options.closeAtx && (a += " " + o), s(), u(), a;
}
hh.peek = q0;
function hh(e) {
  return e.value || "";
}
function q0() {
  return "<";
}
mh.peek = Y0;
function mh(e, t, n, r) {
  const i = Xs(n), l = i === '"' ? "Quote" : "Apostrophe", o = n.enter("image");
  let u = n.enter("label");
  const s = n.createTracker(r);
  let a = s.move("![");
  return a += s.move(
    n.safe(e.alt, { before: a, after: "]", ...s.current() })
  ), a += s.move("]("), u(), // If there’s no url but there is a title…
  !e.url && e.title || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(e.url) ? (u = n.enter("destinationLiteral"), a += s.move("<"), a += s.move(
    n.safe(e.url, { before: a, after: ">", ...s.current() })
  ), a += s.move(">")) : (u = n.enter("destinationRaw"), a += s.move(
    n.safe(e.url, {
      before: a,
      after: e.title ? " " : ")",
      ...s.current()
    })
  )), u(), e.title && (u = n.enter(`title${l}`), a += s.move(" " + i), a += s.move(
    n.safe(e.title, {
      before: a,
      after: i,
      ...s.current()
    })
  ), a += s.move(i), u()), a += s.move(")"), o(), a;
}
function Y0() {
  return "!";
}
gh.peek = X0;
function gh(e, t, n, r) {
  const i = e.referenceType, l = n.enter("imageReference");
  let o = n.enter("label");
  const u = n.createTracker(r);
  let s = u.move("![");
  const a = n.safe(e.alt, {
    before: s,
    after: "]",
    ...u.current()
  });
  s += u.move(a + "]["), o();
  const f = n.stack;
  n.stack = [], o = n.enter("reference");
  const c = n.safe(n.associationId(e), {
    before: s,
    after: "]",
    ...u.current()
  });
  return o(), n.stack = f, l(), i === "full" || !a || a !== c ? s += u.move(c + "]") : i === "shortcut" ? s = s.slice(0, -1) : s += u.move("]"), s;
}
function X0() {
  return "!";
}
yh.peek = G0;
function yh(e, t, n) {
  let r = e.value || "", i = "`", l = -1;
  for (; new RegExp("(^|[^`])" + i + "([^`]|$)").test(r); )
    i += "`";
  for (/[^ \r\n]/.test(r) && (/^[ \r\n]/.test(r) && /[ \r\n]$/.test(r) || /^`|`$/.test(r)) && (r = " " + r + " "); ++l < n.unsafe.length; ) {
    const o = n.unsafe[l], u = n.compilePattern(o);
    let s;
    if (o.atBreak)
      for (; s = u.exec(r); ) {
        let a = s.index;
        r.charCodeAt(a) === 10 && r.charCodeAt(a - 1) === 13 && a--, r = r.slice(0, a) + " " + r.slice(s.index + 1);
      }
  }
  return i + r + i;
}
function G0() {
  return "`";
}
function kh(e, t) {
  const n = Us(e);
  return !!(!t.options.resourceLink && // If there’s a url…
  e.url && // And there’s a no title…
  !e.title && // And the content of `node` is a single text node…
  e.children && e.children.length === 1 && e.children[0].type === "text" && // And if the url is the same as the content…
  (n === e.url || "mailto:" + n === e.url) && // And that starts w/ a protocol…
  /^[a-z][a-z+.-]+:/i.test(e.url) && // And that doesn’t contain ASCII control codes (character escapes and
  // references don’t work), space, or angle brackets…
  !/[\0- <>\u007F]/.test(e.url));
}
vh.peek = Z0;
function vh(e, t, n, r) {
  const i = Xs(n), l = i === '"' ? "Quote" : "Apostrophe", o = n.createTracker(r);
  let u, s;
  if (kh(e, n)) {
    const f = n.stack;
    n.stack = [], u = n.enter("autolink");
    let c = o.move("<");
    return c += o.move(
      n.containerPhrasing(e, {
        before: c,
        after: ">",
        ...o.current()
      })
    ), c += o.move(">"), u(), n.stack = f, c;
  }
  u = n.enter("link"), s = n.enter("label");
  let a = o.move("[");
  return a += o.move(
    n.containerPhrasing(e, {
      before: a,
      after: "](",
      ...o.current()
    })
  ), a += o.move("]("), s(), // If there’s no url but there is a title…
  !e.url && e.title || // If there are control characters or whitespace.
  /[\0- \u007F]/.test(e.url) ? (s = n.enter("destinationLiteral"), a += o.move("<"), a += o.move(
    n.safe(e.url, { before: a, after: ">", ...o.current() })
  ), a += o.move(">")) : (s = n.enter("destinationRaw"), a += o.move(
    n.safe(e.url, {
      before: a,
      after: e.title ? " " : ")",
      ...o.current()
    })
  )), s(), e.title && (s = n.enter(`title${l}`), a += o.move(" " + i), a += o.move(
    n.safe(e.title, {
      before: a,
      after: i,
      ...o.current()
    })
  ), a += o.move(i), s()), a += o.move(")"), u(), a;
}
function Z0(e, t, n) {
  return kh(e, n) ? "<" : "[";
}
xh.peek = J0;
function xh(e, t, n, r) {
  const i = e.referenceType, l = n.enter("linkReference");
  let o = n.enter("label");
  const u = n.createTracker(r);
  let s = u.move("[");
  const a = n.containerPhrasing(e, {
    before: s,
    after: "]",
    ...u.current()
  });
  s += u.move(a + "]["), o();
  const f = n.stack;
  n.stack = [], o = n.enter("reference");
  const c = n.safe(n.associationId(e), {
    before: s,
    after: "]",
    ...u.current()
  });
  return o(), n.stack = f, l(), i === "full" || !a || a !== c ? s += u.move(c + "]") : i === "shortcut" ? s = s.slice(0, -1) : s += u.move("]"), s;
}
function J0() {
  return "[";
}
function Gs(e) {
  const t = e.options.bullet || "*";
  if (t !== "*" && t !== "+" && t !== "-")
    throw new Error(
      "Cannot serialize items with `" + t + "` for `options.bullet`, expected `*`, `+`, or `-`"
    );
  return t;
}
function ew(e) {
  const t = Gs(e), n = e.options.bulletOther;
  if (!n)
    return t === "*" ? "-" : "*";
  if (n !== "*" && n !== "+" && n !== "-")
    throw new Error(
      "Cannot serialize items with `" + n + "` for `options.bulletOther`, expected `*`, `+`, or `-`"
    );
  if (n === t)
    throw new Error(
      "Expected `bullet` (`" + t + "`) and `bulletOther` (`" + n + "`) to be different"
    );
  return n;
}
function tw(e) {
  const t = e.options.bulletOrdered || ".";
  if (t !== "." && t !== ")")
    throw new Error(
      "Cannot serialize items with `" + t + "` for `options.bulletOrdered`, expected `.` or `)`"
    );
  return t;
}
function wh(e) {
  const t = e.options.rule || "*";
  if (t !== "*" && t !== "-" && t !== "_")
    throw new Error(
      "Cannot serialize rules with `" + t + "` for `options.rule`, expected `*`, `-`, or `_`"
    );
  return t;
}
function nw(e, t, n, r) {
  const i = n.enter("list"), l = n.bulletCurrent;
  let o = e.ordered ? tw(n) : Gs(n);
  const u = e.ordered ? o === "." ? ")" : "." : ew(n);
  let s = t && n.bulletLastUsed ? o === n.bulletLastUsed : !1;
  if (!e.ordered) {
    const f = e.children ? e.children[0] : void 0;
    if (
      // Bullet could be used as a thematic break marker:
      (o === "*" || o === "-") && // Empty first list item:
      f && (!f.children || !f.children[0]) && // Directly in two other list items:
      n.stack[n.stack.length - 1] === "list" && n.stack[n.stack.length - 2] === "listItem" && n.stack[n.stack.length - 3] === "list" && n.stack[n.stack.length - 4] === "listItem" && // That are each the first child.
      n.indexStack[n.indexStack.length - 1] === 0 && n.indexStack[n.indexStack.length - 2] === 0 && n.indexStack[n.indexStack.length - 3] === 0 && (s = !0), wh(n) === o && f
    ) {
      let c = -1;
      for (; ++c < e.children.length; ) {
        const p = e.children[c];
        if (p && p.type === "listItem" && p.children && p.children[0] && p.children[0].type === "thematicBreak") {
          s = !0;
          break;
        }
      }
    }
  }
  s && (o = u), n.bulletCurrent = o;
  const a = n.containerFlow(e, r);
  return n.bulletLastUsed = o, n.bulletCurrent = l, i(), a;
}
function rw(e) {
  const t = e.options.listItemIndent || "one";
  if (t !== "tab" && t !== "one" && t !== "mixed")
    throw new Error(
      "Cannot serialize items with `" + t + "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`"
    );
  return t;
}
function iw(e, t, n, r) {
  const i = rw(n);
  let l = n.bulletCurrent || Gs(n);
  t && t.type === "list" && t.ordered && (l = (typeof t.start == "number" && t.start > -1 ? t.start : 1) + (n.options.incrementListMarker === !1 ? 0 : t.children.indexOf(e)) + l);
  let o = l.length + 1;
  (i === "tab" || i === "mixed" && (t && t.type === "list" && t.spread || e.spread)) && (o = Math.ceil(o / 4) * 4);
  const u = n.createTracker(r);
  u.move(l + " ".repeat(o - l.length)), u.shift(o);
  const s = n.enter("listItem"), a = n.indentLines(
    n.containerFlow(e, u.current()),
    f
  );
  return s(), a;
  function f(c, p, d) {
    return p ? (d ? "" : " ".repeat(o)) + c : (d ? l : l + " ".repeat(o - l.length)) + c;
  }
}
function lw(e, t, n, r) {
  const i = n.enter("paragraph"), l = n.enter("phrasing"), o = n.containerPhrasing(e, r);
  return l(), i(), o;
}
const ow = (
  /** @type {(node?: unknown) => node is Exclude<PhrasingContent, Html>} */
  Hl([
    "break",
    "delete",
    "emphasis",
    // To do: next major: removed since footnotes were added to GFM.
    "footnote",
    "footnoteReference",
    "image",
    "imageReference",
    "inlineCode",
    // Enabled by `mdast-util-math`:
    "inlineMath",
    "link",
    "linkReference",
    // Enabled by `mdast-util-mdx`:
    "mdxJsxTextElement",
    // Enabled by `mdast-util-mdx`:
    "mdxTextExpression",
    "strong",
    "text",
    // Enabled by `mdast-util-directive`:
    "textDirective"
  ])
);
function uw(e, t, n, r) {
  return (e.children.some(function(o) {
    return ow(o);
  }) ? n.containerPhrasing : n.containerFlow).call(n, e, r);
}
function sw(e) {
  const t = e.options.strong || "*";
  if (t !== "*" && t !== "_")
    throw new Error(
      "Cannot serialize strong with `" + t + "` for `options.strong`, expected `*`, or `_`"
    );
  return t;
}
Sh.peek = aw;
function Sh(e, t, n, r) {
  const i = sw(n), l = n.enter("strong"), o = n.createTracker(r), u = o.move(i + i);
  let s = o.move(
    n.containerPhrasing(e, {
      after: i,
      before: u,
      ...o.current()
    })
  );
  const a = s.charCodeAt(0), f = Sl(
    r.before.charCodeAt(r.before.length - 1),
    a,
    i
  );
  f.inside && (s = ri(a) + s.slice(1));
  const c = s.charCodeAt(s.length - 1), p = Sl(r.after.charCodeAt(0), c, i);
  p.inside && (s = s.slice(0, -1) + ri(c));
  const d = o.move(i + i);
  return l(), n.attentionEncodeSurroundingInfo = {
    after: p.outside,
    before: f.outside
  }, u + s + d;
}
function aw(e, t, n) {
  return n.options.strong || "*";
}
function cw(e, t, n, r) {
  return n.safe(e.value, r);
}
function fw(e) {
  const t = e.options.ruleRepetition || 3;
  if (t < 3)
    throw new Error(
      "Cannot serialize rules with repetition `" + t + "` for `options.ruleRepetition`, expected `3` or more"
    );
  return t;
}
function pw(e, t, n) {
  const r = (wh(n) + (n.options.ruleSpaces ? " " : "")).repeat(fw(n));
  return n.options.ruleSpaces ? r.slice(0, -1) : r;
}
const Ch = {
  blockquote: R0,
  break: lf,
  code: U0,
  definition: H0,
  emphasis: dh,
  hardBreak: lf,
  heading: K0,
  html: hh,
  image: mh,
  imageReference: gh,
  inlineCode: yh,
  link: vh,
  linkReference: xh,
  list: nw,
  listItem: iw,
  paragraph: lw,
  root: uw,
  strong: Sh,
  text: cw,
  thematicBreak: pw
};
function dw() {
  return {
    enter: {
      table: hw,
      tableData: of,
      tableHeader: of,
      tableRow: gw
    },
    exit: {
      codeText: yw,
      table: mw,
      tableData: No,
      tableHeader: No,
      tableRow: No
    }
  };
}
function hw(e) {
  const t = e._align;
  this.enter(
    {
      type: "table",
      align: t.map(function(n) {
        return n === "none" ? null : n;
      }),
      children: []
    },
    e
  ), this.data.inTable = !0;
}
function mw(e) {
  this.exit(e), this.data.inTable = void 0;
}
function gw(e) {
  this.enter({ type: "tableRow", children: [] }, e);
}
function No(e) {
  this.exit(e);
}
function of(e) {
  this.enter({ type: "tableCell", children: [] }, e);
}
function yw(e) {
  let t = this.resume();
  this.data.inTable && (t = t.replace(/\\([\\|])/g, kw));
  const n = this.stack[this.stack.length - 1];
  n.type, n.value = t, this.exit(e);
}
function kw(e, t) {
  return t === "|" ? t : e;
}
function vw(e) {
  const t = e || {}, n = t.tableCellPadding, r = t.tablePipeAlign, i = t.stringLength, l = n ? " " : "|";
  return {
    unsafe: [
      { character: "\r", inConstruct: "tableCell" },
      { character: `
`, inConstruct: "tableCell" },
      // A pipe, when followed by a tab or space (padding), or a dash or colon
      // (unpadded delimiter row), could result in a table.
      { atBreak: !0, character: "|", after: "[	 :-]" },
      // A pipe in a cell must be encoded.
      { character: "|", inConstruct: "tableCell" },
      // A colon must be followed by a dash, in which case it could start a
      // delimiter row.
      { atBreak: !0, character: ":", after: "-" },
      // A delimiter row can also start with a dash, when followed by more
      // dashes, a colon, or a pipe.
      // This is a stricter version than the built in check for lists, thematic
      // breaks, and setex heading underlines though:
      // <https://github.com/syntax-tree/mdast-util-to-markdown/blob/51a2038/lib/unsafe.js#L57>
      { atBreak: !0, character: "-", after: "[:|-]" }
    ],
    handlers: {
      inlineCode: p,
      table: o,
      tableCell: s,
      tableRow: u
    }
  };
  function o(d, g, x, T) {
    return a(f(d, x, T), d.align);
  }
  function u(d, g, x, T) {
    const h = c(d, x, T), m = a([h]);
    return m.slice(0, m.indexOf(`
`));
  }
  function s(d, g, x, T) {
    const h = x.enter("tableCell"), m = x.enter("phrasing"), y = x.containerPhrasing(d, {
      ...T,
      before: l,
      after: l
    });
    return m(), h(), y;
  }
  function a(d, g) {
    return A0(d, {
      align: g,
      // @ts-expect-error: `markdown-table` types should support `null`.
      alignDelimiters: r,
      // @ts-expect-error: `markdown-table` types should support `null`.
      padding: n,
      // @ts-expect-error: `markdown-table` types should support `null`.
      stringLength: i
    });
  }
  function f(d, g, x) {
    const T = d.children;
    let h = -1;
    const m = [], y = g.enter("table");
    for (; ++h < T.length; )
      m[h] = c(T[h], g, x);
    return y(), m;
  }
  function c(d, g, x) {
    const T = d.children;
    let h = -1;
    const m = [], y = g.enter("tableRow");
    for (; ++h < T.length; )
      m[h] = s(T[h], d, g, x);
    return y(), m;
  }
  function p(d, g, x) {
    let T = Ch.inlineCode(d, g, x);
    return x.stack.includes("tableCell") && (T = T.replace(/\|/g, "\\$&")), T;
  }
}
function xw() {
  return {
    exit: {
      taskListCheckValueChecked: uf,
      taskListCheckValueUnchecked: uf,
      paragraph: Sw
    }
  };
}
function ww() {
  return {
    unsafe: [{ atBreak: !0, character: "-", after: "[:|-]" }],
    handlers: { listItem: Cw }
  };
}
function uf(e) {
  const t = this.stack[this.stack.length - 2];
  t.type, t.checked = e.type === "taskListCheckValueChecked";
}
function Sw(e) {
  const t = this.stack[this.stack.length - 2];
  if (t && t.type === "listItem" && typeof t.checked == "boolean") {
    const n = this.stack[this.stack.length - 1];
    n.type;
    const r = n.children[0];
    if (r && r.type === "text") {
      const i = t.children;
      let l = -1, o;
      for (; ++l < i.length; ) {
        const u = i[l];
        if (u.type === "paragraph") {
          o = u;
          break;
        }
      }
      o === n && (r.value = r.value.slice(1), r.value.length === 0 ? n.children.shift() : n.position && r.position && typeof r.position.start.offset == "number" && (r.position.start.column++, r.position.start.offset++, n.position.start = Object.assign({}, r.position.start)));
    }
  }
  this.exit(e);
}
function Cw(e, t, n, r) {
  const i = e.children[0], l = typeof e.checked == "boolean" && i && i.type === "paragraph", o = "[" + (e.checked ? "x" : " ") + "] ", u = n.createTracker(r);
  l && u.move(o);
  let s = Ch.listItem(e, t, n, {
    ...r,
    ...u.current()
  });
  return l && (s = s.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, a)), s;
  function a(f) {
    return f + o;
  }
}
function Ew() {
  return [
    n0(),
    C0(),
    I0(),
    dw(),
    xw()
  ];
}
function Tw(e) {
  return {
    extensions: [
      r0(),
      E0(e),
      P0(),
      vw(e),
      ww()
    ]
  };
}
const _w = {
  tokenize: Nw,
  partial: !0
}, Eh = {
  tokenize: Aw,
  partial: !0
}, Th = {
  tokenize: Dw,
  partial: !0
}, _h = {
  tokenize: Rw,
  partial: !0
}, Iw = {
  tokenize: Fw,
  partial: !0
}, Ih = {
  name: "wwwAutolink",
  tokenize: Lw,
  previous: zh
}, Ph = {
  name: "protocolAutolink",
  tokenize: bw,
  previous: Lh
}, Rt = {
  name: "emailAutolink",
  tokenize: zw,
  previous: bh
}, St = {};
function Pw() {
  return {
    text: St
  };
}
let un = 48;
for (; un < 123; )
  St[un] = Rt, un++, un === 58 ? un = 65 : un === 91 && (un = 97);
St[43] = Rt;
St[45] = Rt;
St[46] = Rt;
St[95] = Rt;
St[72] = [Rt, Ph];
St[104] = [Rt, Ph];
St[87] = [Rt, Ih];
St[119] = [Rt, Ih];
function zw(e, t, n) {
  const r = this;
  let i, l;
  return o;
  function o(c) {
    return !Ou(c) || !bh.call(r, r.previous) || Zs(r.events) ? n(c) : (e.enter("literalAutolink"), e.enter("literalAutolinkEmail"), u(c));
  }
  function u(c) {
    return Ou(c) ? (e.consume(c), u) : c === 64 ? (e.consume(c), s) : n(c);
  }
  function s(c) {
    return c === 46 ? e.check(Iw, f, a)(c) : c === 45 || c === 95 || Ie(c) ? (l = !0, e.consume(c), s) : f(c);
  }
  function a(c) {
    return e.consume(c), i = !0, s;
  }
  function f(c) {
    return l && i && be(r.previous) ? (e.exit("literalAutolinkEmail"), e.exit("literalAutolink"), t(c)) : n(c);
  }
}
function Lw(e, t, n) {
  const r = this;
  return i;
  function i(o) {
    return o !== 87 && o !== 119 || !zh.call(r, r.previous) || Zs(r.events) ? n(o) : (e.enter("literalAutolink"), e.enter("literalAutolinkWww"), e.check(_w, e.attempt(Eh, e.attempt(Th, l), n), n)(o));
  }
  function l(o) {
    return e.exit("literalAutolinkWww"), e.exit("literalAutolink"), t(o);
  }
}
function bw(e, t, n) {
  const r = this;
  let i = "", l = !1;
  return o;
  function o(c) {
    return (c === 72 || c === 104) && Lh.call(r, r.previous) && !Zs(r.events) ? (e.enter("literalAutolink"), e.enter("literalAutolinkHttp"), i += String.fromCodePoint(c), e.consume(c), u) : n(c);
  }
  function u(c) {
    if (be(c) && i.length < 5)
      return i += String.fromCodePoint(c), e.consume(c), u;
    if (c === 58) {
      const p = i.toLowerCase();
      if (p === "http" || p === "https")
        return e.consume(c), s;
    }
    return n(c);
  }
  function s(c) {
    return c === 47 ? (e.consume(c), l ? a : (l = !0, s)) : n(c);
  }
  function a(c) {
    return c === null || vl(c) || J(c) || Sn(c) || Bl(c) ? n(c) : e.attempt(Eh, e.attempt(Th, f), n)(c);
  }
  function f(c) {
    return e.exit("literalAutolinkHttp"), e.exit("literalAutolink"), t(c);
  }
}
function Nw(e, t, n) {
  let r = 0;
  return i;
  function i(o) {
    return (o === 87 || o === 119) && r < 3 ? (r++, e.consume(o), i) : o === 46 && r === 3 ? (e.consume(o), l) : n(o);
  }
  function l(o) {
    return o === null ? n(o) : t(o);
  }
}
function Aw(e, t, n) {
  let r, i, l;
  return o;
  function o(a) {
    return a === 46 || a === 95 ? e.check(_h, s, u)(a) : a === null || J(a) || Sn(a) || a !== 45 && Bl(a) ? s(a) : (l = !0, e.consume(a), o);
  }
  function u(a) {
    return a === 95 ? r = !0 : (i = r, r = void 0), e.consume(a), o;
  }
  function s(a) {
    return i || r || !l ? n(a) : t(a);
  }
}
function Dw(e, t) {
  let n = 0, r = 0;
  return i;
  function i(o) {
    return o === 40 ? (n++, e.consume(o), i) : o === 41 && r < n ? l(o) : o === 33 || o === 34 || o === 38 || o === 39 || o === 41 || o === 42 || o === 44 || o === 46 || o === 58 || o === 59 || o === 60 || o === 63 || o === 93 || o === 95 || o === 126 ? e.check(_h, t, l)(o) : o === null || J(o) || Sn(o) ? t(o) : (e.consume(o), i);
  }
  function l(o) {
    return o === 41 && r++, e.consume(o), i;
  }
}
function Rw(e, t, n) {
  return r;
  function r(u) {
    return u === 33 || u === 34 || u === 39 || u === 41 || u === 42 || u === 44 || u === 46 || u === 58 || u === 59 || u === 63 || u === 95 || u === 126 ? (e.consume(u), r) : u === 38 ? (e.consume(u), l) : u === 93 ? (e.consume(u), i) : (
      // `<` is an end.
      u === 60 || // So is whitespace.
      u === null || J(u) || Sn(u) ? t(u) : n(u)
    );
  }
  function i(u) {
    return u === null || u === 40 || u === 91 || J(u) || Sn(u) ? t(u) : r(u);
  }
  function l(u) {
    return be(u) ? o(u) : n(u);
  }
  function o(u) {
    return u === 59 ? (e.consume(u), r) : be(u) ? (e.consume(u), o) : n(u);
  }
}
function Fw(e, t, n) {
  return r;
  function r(l) {
    return e.consume(l), i;
  }
  function i(l) {
    return Ie(l) ? n(l) : t(l);
  }
}
function zh(e) {
  return e === null || e === 40 || e === 42 || e === 95 || e === 91 || e === 93 || e === 126 || J(e);
}
function Lh(e) {
  return !be(e);
}
function bh(e) {
  return !(e === 47 || Ou(e));
}
function Ou(e) {
  return e === 43 || e === 45 || e === 46 || e === 95 || Ie(e);
}
function Zs(e) {
  let t = e.length, n = !1;
  for (; t--; ) {
    const r = e[t][1];
    if ((r.type === "labelLink" || r.type === "labelImage") && !r._balanced) {
      n = !0;
      break;
    }
    if (r._gfmAutolinkLiteralWalkedInto) {
      n = !1;
      break;
    }
  }
  return e.length > 0 && !n && (e[e.length - 1][1]._gfmAutolinkLiteralWalkedInto = !0), n;
}
const Ow = {
  tokenize: Ww,
  partial: !0
};
function Mw() {
  return {
    document: {
      91: {
        name: "gfmFootnoteDefinition",
        tokenize: $w,
        continuation: {
          tokenize: Hw
        },
        exit: Vw
      }
    },
    text: {
      91: {
        name: "gfmFootnoteCall",
        tokenize: Uw
      },
      93: {
        name: "gfmPotentialFootnoteCall",
        add: "after",
        tokenize: jw,
        resolveTo: Bw
      }
    }
  };
}
function jw(e, t, n) {
  const r = this;
  let i = r.events.length;
  const l = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let o;
  for (; i--; ) {
    const s = r.events[i][1];
    if (s.type === "labelImage") {
      o = s;
      break;
    }
    if (s.type === "gfmFootnoteCall" || s.type === "labelLink" || s.type === "label" || s.type === "image" || s.type === "link")
      break;
  }
  return u;
  function u(s) {
    if (!o || !o._balanced)
      return n(s);
    const a = dt(r.sliceSerialize({
      start: o.end,
      end: r.now()
    }));
    return a.codePointAt(0) !== 94 || !l.includes(a.slice(1)) ? n(s) : (e.enter("gfmFootnoteCallLabelMarker"), e.consume(s), e.exit("gfmFootnoteCallLabelMarker"), t(s));
  }
}
function Bw(e, t) {
  let n = e.length;
  for (; n--; )
    if (e[n][1].type === "labelImage" && e[n][0] === "enter") {
      e[n][1];
      break;
    }
  e[n + 1][1].type = "data", e[n + 3][1].type = "gfmFootnoteCallLabelMarker";
  const r = {
    type: "gfmFootnoteCall",
    start: Object.assign({}, e[n + 3][1].start),
    end: Object.assign({}, e[e.length - 1][1].end)
  }, i = {
    type: "gfmFootnoteCallMarker",
    start: Object.assign({}, e[n + 3][1].end),
    end: Object.assign({}, e[n + 3][1].end)
  };
  i.end.column++, i.end.offset++, i.end._bufferIndex++;
  const l = {
    type: "gfmFootnoteCallString",
    start: Object.assign({}, i.end),
    end: Object.assign({}, e[e.length - 1][1].start)
  }, o = {
    type: "chunkString",
    contentType: "string",
    start: Object.assign({}, l.start),
    end: Object.assign({}, l.end)
  }, u = [
    // Take the `labelImageMarker` (now `data`, the `!`)
    e[n + 1],
    e[n + 2],
    ["enter", r, t],
    // The `[`
    e[n + 3],
    e[n + 4],
    // The `^`.
    ["enter", i, t],
    ["exit", i, t],
    // Everything in between.
    ["enter", l, t],
    ["enter", o, t],
    ["exit", o, t],
    ["exit", l, t],
    // The ending (`]`, properly parsed and labelled).
    e[e.length - 2],
    e[e.length - 1],
    ["exit", r, t]
  ];
  return e.splice(n, e.length - n + 1, ...u), e;
}
function Uw(e, t, n) {
  const r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let l = 0, o;
  return u;
  function u(c) {
    return e.enter("gfmFootnoteCall"), e.enter("gfmFootnoteCallLabelMarker"), e.consume(c), e.exit("gfmFootnoteCallLabelMarker"), s;
  }
  function s(c) {
    return c !== 94 ? n(c) : (e.enter("gfmFootnoteCallMarker"), e.consume(c), e.exit("gfmFootnoteCallMarker"), e.enter("gfmFootnoteCallString"), e.enter("chunkString").contentType = "string", a);
  }
  function a(c) {
    if (
      // Too long.
      l > 999 || // Closing brace with nothing.
      c === 93 && !o || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      c === null || c === 91 || J(c)
    )
      return n(c);
    if (c === 93) {
      e.exit("chunkString");
      const p = e.exit("gfmFootnoteCallString");
      return i.includes(dt(r.sliceSerialize(p))) ? (e.enter("gfmFootnoteCallLabelMarker"), e.consume(c), e.exit("gfmFootnoteCallLabelMarker"), e.exit("gfmFootnoteCall"), t) : n(c);
    }
    return J(c) || (o = !0), l++, e.consume(c), c === 92 ? f : a;
  }
  function f(c) {
    return c === 91 || c === 92 || c === 93 ? (e.consume(c), l++, a) : a(c);
  }
}
function $w(e, t, n) {
  const r = this, i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []);
  let l, o = 0, u;
  return s;
  function s(g) {
    return e.enter("gfmFootnoteDefinition")._container = !0, e.enter("gfmFootnoteDefinitionLabel"), e.enter("gfmFootnoteDefinitionLabelMarker"), e.consume(g), e.exit("gfmFootnoteDefinitionLabelMarker"), a;
  }
  function a(g) {
    return g === 94 ? (e.enter("gfmFootnoteDefinitionMarker"), e.consume(g), e.exit("gfmFootnoteDefinitionMarker"), e.enter("gfmFootnoteDefinitionLabelString"), e.enter("chunkString").contentType = "string", f) : n(g);
  }
  function f(g) {
    if (
      // Too long.
      o > 999 || // Closing brace with nothing.
      g === 93 && !u || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      g === null || g === 91 || J(g)
    )
      return n(g);
    if (g === 93) {
      e.exit("chunkString");
      const x = e.exit("gfmFootnoteDefinitionLabelString");
      return l = dt(r.sliceSerialize(x)), e.enter("gfmFootnoteDefinitionLabelMarker"), e.consume(g), e.exit("gfmFootnoteDefinitionLabelMarker"), e.exit("gfmFootnoteDefinitionLabel"), p;
    }
    return J(g) || (u = !0), o++, e.consume(g), g === 92 ? c : f;
  }
  function c(g) {
    return g === 91 || g === 92 || g === 93 ? (e.consume(g), o++, f) : f(g);
  }
  function p(g) {
    return g === 58 ? (e.enter("definitionMarker"), e.consume(g), e.exit("definitionMarker"), i.includes(l) || i.push(l), Q(e, d, "gfmFootnoteDefinitionWhitespace")) : n(g);
  }
  function d(g) {
    return t(g);
  }
}
function Hw(e, t, n) {
  return e.check(ci, t, e.attempt(Ow, t, n));
}
function Vw(e) {
  e.exit("gfmFootnoteDefinition");
}
function Ww(e, t, n) {
  const r = this;
  return Q(e, i, "gfmFootnoteDefinitionIndent", 5);
  function i(l) {
    const o = r.events[r.events.length - 1];
    return o && o[1].type === "gfmFootnoteDefinitionIndent" && o[2].sliceSerialize(o[1], !0).length === 4 ? t(l) : n(l);
  }
}
function Qw(e) {
  let n = (e || {}).singleTilde;
  const r = {
    name: "strikethrough",
    tokenize: l,
    resolveAll: i
  };
  return n == null && (n = !0), {
    text: {
      126: r
    },
    insideSpan: {
      null: [r]
    },
    attentionMarkers: {
      null: [126]
    }
  };
  function i(o, u) {
    let s = -1;
    for (; ++s < o.length; )
      if (o[s][0] === "enter" && o[s][1].type === "strikethroughSequenceTemporary" && o[s][1]._close) {
        let a = s;
        for (; a--; )
          if (o[a][0] === "exit" && o[a][1].type === "strikethroughSequenceTemporary" && o[a][1]._open && // If the sizes are the same:
          o[s][1].end.offset - o[s][1].start.offset === o[a][1].end.offset - o[a][1].start.offset) {
            o[s][1].type = "strikethroughSequence", o[a][1].type = "strikethroughSequence";
            const f = {
              type: "strikethrough",
              start: Object.assign({}, o[a][1].start),
              end: Object.assign({}, o[s][1].end)
            }, c = {
              type: "strikethroughText",
              start: Object.assign({}, o[a][1].end),
              end: Object.assign({}, o[s][1].start)
            }, p = [["enter", f, u], ["enter", o[a][1], u], ["exit", o[a][1], u], ["enter", c, u]], d = u.parser.constructs.insideSpan.null;
            d && qe(p, p.length, 0, Ul(d, o.slice(a + 1, s), u)), qe(p, p.length, 0, [["exit", c, u], ["enter", o[s][1], u], ["exit", o[s][1], u], ["exit", f, u]]), qe(o, a - 1, s - a + 3, p), s = a + p.length - 2;
            break;
          }
      }
    for (s = -1; ++s < o.length; )
      o[s][1].type === "strikethroughSequenceTemporary" && (o[s][1].type = "data");
    return o;
  }
  function l(o, u, s) {
    const a = this.previous, f = this.events;
    let c = 0;
    return p;
    function p(g) {
      return a === 126 && f[f.length - 1][1].type !== "characterEscape" ? s(g) : (o.enter("strikethroughSequenceTemporary"), d(g));
    }
    function d(g) {
      const x = ir(a);
      if (g === 126)
        return c > 1 ? s(g) : (o.consume(g), c++, d);
      if (c < 2 && !n) return s(g);
      const T = o.exit("strikethroughSequenceTemporary"), h = ir(g);
      return T._open = !h || h === 2 && !!x, T._close = !x || x === 2 && !!h, u(g);
    }
  }
}
class Kw {
  /**
   * Create a new edit map.
   */
  constructor() {
    this.map = [], this.index = /* @__PURE__ */ new Map();
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  add(t, n, r) {
    qw(this, t, n, r);
  }
  // To do: add this when moving to `micromark`.
  // /**
  //  * Create an edit: but insert `add` before existing additions.
  //  *
  //  * @param {number} index
  //  * @param {number} remove
  //  * @param {Array<Event>} add
  //  * @returns {undefined}
  //  */
  // addBefore(index, remove, add) {
  //   addImplementation(this, index, remove, add, true)
  // }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   *   List of events to apply the edits to.
   * @returns {undefined}
   *   Nothing.
   */
  consume(t) {
    if (this.map.sort(function(l, o) {
      return l[0] - o[0];
    }), this.map.length === 0)
      return;
    let n = this.map.length;
    const r = [];
    for (; n > 0; )
      n -= 1, r.push(t.slice(this.map[n][0] + this.map[n][1]), this.map[n][2]), t.length = this.map[n][0];
    r.push(t.slice()), t.length = 0;
    let i = r.pop();
    for (; i; ) {
      for (const l of i)
        t.push(l);
      i = r.pop();
    }
    this.map.length = 0, this.index.clear();
  }
}
function qw(e, t, n, r) {
  if (n === 0 && r.length === 0)
    return;
  const i = e.index.get(t);
  if (i) {
    i[1] += n, i[2].push(...r);
    return;
  }
  const l = [t, n, r];
  e.map.push(l), e.index.set(t, l);
}
function Yw(e, t) {
  let n = !1;
  const r = [];
  for (; t < e.length; ) {
    const i = e[t];
    if (n) {
      if (i[0] === "enter")
        i[1].type === "tableContent" && r.push(e[t + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
      else if (i[1].type === "tableContent") {
        if (e[t - 1][1].type === "tableDelimiterMarker") {
          const l = r.length - 1;
          r[l] = r[l] === "left" ? "center" : "right";
        }
      } else if (i[1].type === "tableDelimiterRow")
        break;
    } else i[0] === "enter" && i[1].type === "tableDelimiterRow" && (n = !0);
    t += 1;
  }
  return r;
}
function Xw() {
  return {
    flow: {
      null: {
        name: "table",
        tokenize: Gw,
        resolveAll: Zw
      }
    }
  };
}
function Gw(e, t, n) {
  const r = this;
  let i = 0, l = 0, o;
  return u;
  function u(S) {
    let A = r.events.length - 1;
    for (; A > -1; ) {
      const {
        type: ee
      } = r.events[A][1];
      if (ee === "lineEnding" || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
      ee === "linePrefix")
        A--;
      else
        break;
    }
    const R = A > -1 ? r.events[A][1].type : null, K = R === "tableHead" || R === "tableRow" ? w : s;
    return K === w && r.parser.lazy[r.now().line] ? n(S) : K(S);
  }
  function s(S) {
    return e.enter("tableHead"), e.enter("tableRow"), a(S);
  }
  function a(S) {
    return S === 124 || (o = !0, l += 1), f(S);
  }
  function f(S) {
    return S === null ? n(S) : O(S) ? l > 1 ? (l = 0, r.interrupt = !0, e.exit("tableRow"), e.enter("lineEnding"), e.consume(S), e.exit("lineEnding"), d) : n(S) : $(S) ? Q(e, f, "whitespace")(S) : (l += 1, o && (o = !1, i += 1), S === 124 ? (e.enter("tableCellDivider"), e.consume(S), e.exit("tableCellDivider"), o = !0, f) : (e.enter("data"), c(S)));
  }
  function c(S) {
    return S === null || S === 124 || J(S) ? (e.exit("data"), f(S)) : (e.consume(S), S === 92 ? p : c);
  }
  function p(S) {
    return S === 92 || S === 124 ? (e.consume(S), c) : c(S);
  }
  function d(S) {
    return r.interrupt = !1, r.parser.lazy[r.now().line] ? n(S) : (e.enter("tableDelimiterRow"), o = !1, $(S) ? Q(e, g, "linePrefix", r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(S) : g(S));
  }
  function g(S) {
    return S === 45 || S === 58 ? T(S) : S === 124 ? (o = !0, e.enter("tableCellDivider"), e.consume(S), e.exit("tableCellDivider"), x) : _(S);
  }
  function x(S) {
    return $(S) ? Q(e, T, "whitespace")(S) : T(S);
  }
  function T(S) {
    return S === 58 ? (l += 1, o = !0, e.enter("tableDelimiterMarker"), e.consume(S), e.exit("tableDelimiterMarker"), h) : S === 45 ? (l += 1, h(S)) : S === null || O(S) ? C(S) : _(S);
  }
  function h(S) {
    return S === 45 ? (e.enter("tableDelimiterFiller"), m(S)) : _(S);
  }
  function m(S) {
    return S === 45 ? (e.consume(S), m) : S === 58 ? (o = !0, e.exit("tableDelimiterFiller"), e.enter("tableDelimiterMarker"), e.consume(S), e.exit("tableDelimiterMarker"), y) : (e.exit("tableDelimiterFiller"), y(S));
  }
  function y(S) {
    return $(S) ? Q(e, C, "whitespace")(S) : C(S);
  }
  function C(S) {
    return S === 124 ? g(S) : S === null || O(S) ? !o || i !== l ? _(S) : (e.exit("tableDelimiterRow"), e.exit("tableHead"), t(S)) : _(S);
  }
  function _(S) {
    return n(S);
  }
  function w(S) {
    return e.enter("tableRow"), P(S);
  }
  function P(S) {
    return S === 124 ? (e.enter("tableCellDivider"), e.consume(S), e.exit("tableCellDivider"), P) : S === null || O(S) ? (e.exit("tableRow"), t(S)) : $(S) ? Q(e, P, "whitespace")(S) : (e.enter("data"), L(S));
  }
  function L(S) {
    return S === null || S === 124 || J(S) ? (e.exit("data"), P(S)) : (e.consume(S), S === 92 ? M : L);
  }
  function M(S) {
    return S === 92 || S === 124 ? (e.consume(S), L) : L(S);
  }
}
function Zw(e, t) {
  let n = -1, r = !0, i = 0, l = [0, 0, 0, 0], o = [0, 0, 0, 0], u = !1, s = 0, a, f, c;
  const p = new Kw();
  for (; ++n < e.length; ) {
    const d = e[n], g = d[1];
    d[0] === "enter" ? g.type === "tableHead" ? (u = !1, s !== 0 && (sf(p, t, s, a, f), f = void 0, s = 0), a = {
      type: "table",
      start: Object.assign({}, g.start),
      // Note: correct end is set later.
      end: Object.assign({}, g.end)
    }, p.add(n, 0, [["enter", a, t]])) : g.type === "tableRow" || g.type === "tableDelimiterRow" ? (r = !0, c = void 0, l = [0, 0, 0, 0], o = [0, n + 1, 0, 0], u && (u = !1, f = {
      type: "tableBody",
      start: Object.assign({}, g.start),
      // Note: correct end is set later.
      end: Object.assign({}, g.end)
    }, p.add(n, 0, [["enter", f, t]])), i = g.type === "tableDelimiterRow" ? 2 : f ? 3 : 1) : i && (g.type === "data" || g.type === "tableDelimiterMarker" || g.type === "tableDelimiterFiller") ? (r = !1, o[2] === 0 && (l[1] !== 0 && (o[0] = o[1], c = Ai(p, t, l, i, void 0, c), l = [0, 0, 0, 0]), o[2] = n)) : g.type === "tableCellDivider" && (r ? r = !1 : (l[1] !== 0 && (o[0] = o[1], c = Ai(p, t, l, i, void 0, c)), l = o, o = [l[1], n, 0, 0])) : g.type === "tableHead" ? (u = !0, s = n) : g.type === "tableRow" || g.type === "tableDelimiterRow" ? (s = n, l[1] !== 0 ? (o[0] = o[1], c = Ai(p, t, l, i, n, c)) : o[1] !== 0 && (c = Ai(p, t, o, i, n, c)), i = 0) : i && (g.type === "data" || g.type === "tableDelimiterMarker" || g.type === "tableDelimiterFiller") && (o[3] = n);
  }
  for (s !== 0 && sf(p, t, s, a, f), p.consume(t.events), n = -1; ++n < t.events.length; ) {
    const d = t.events[n];
    d[0] === "enter" && d[1].type === "table" && (d[1]._align = Yw(t.events, n));
  }
  return e;
}
function Ai(e, t, n, r, i, l) {
  const o = r === 1 ? "tableHeader" : r === 2 ? "tableDelimiter" : "tableData", u = "tableContent";
  n[0] !== 0 && (l.end = Object.assign({}, bn(t.events, n[0])), e.add(n[0], 0, [["exit", l, t]]));
  const s = bn(t.events, n[1]);
  if (l = {
    type: o,
    start: Object.assign({}, s),
    // Note: correct end is set later.
    end: Object.assign({}, s)
  }, e.add(n[1], 0, [["enter", l, t]]), n[2] !== 0) {
    const a = bn(t.events, n[2]), f = bn(t.events, n[3]), c = {
      type: u,
      start: Object.assign({}, a),
      end: Object.assign({}, f)
    };
    if (e.add(n[2], 0, [["enter", c, t]]), r !== 2) {
      const p = t.events[n[2]], d = t.events[n[3]];
      if (p[1].end = Object.assign({}, d[1].end), p[1].type = "chunkText", p[1].contentType = "text", n[3] > n[2] + 1) {
        const g = n[2] + 1, x = n[3] - n[2] - 1;
        e.add(g, x, []);
      }
    }
    e.add(n[3] + 1, 0, [["exit", c, t]]);
  }
  return i !== void 0 && (l.end = Object.assign({}, bn(t.events, i)), e.add(i, 0, [["exit", l, t]]), l = void 0), l;
}
function sf(e, t, n, r, i) {
  const l = [], o = bn(t.events, n);
  i && (i.end = Object.assign({}, o), l.push(["exit", i, t])), r.end = Object.assign({}, o), l.push(["exit", r, t]), e.add(n + 1, 0, l);
}
function bn(e, t) {
  const n = e[t], r = n[0] === "enter" ? "start" : "end";
  return n[1][r];
}
const Jw = {
  name: "tasklistCheck",
  tokenize: tS
};
function eS() {
  return {
    text: {
      91: Jw
    }
  };
}
function tS(e, t, n) {
  const r = this;
  return i;
  function i(s) {
    return (
      // Exit if there’s stuff before.
      r.previous !== null || // Exit if not in the first content that is the first child of a list
      // item.
      !r._gfmTasklistFirstContentOfListItem ? n(s) : (e.enter("taskListCheck"), e.enter("taskListCheckMarker"), e.consume(s), e.exit("taskListCheckMarker"), l)
    );
  }
  function l(s) {
    return J(s) ? (e.enter("taskListCheckValueUnchecked"), e.consume(s), e.exit("taskListCheckValueUnchecked"), o) : s === 88 || s === 120 ? (e.enter("taskListCheckValueChecked"), e.consume(s), e.exit("taskListCheckValueChecked"), o) : n(s);
  }
  function o(s) {
    return s === 93 ? (e.enter("taskListCheckMarker"), e.consume(s), e.exit("taskListCheckMarker"), e.exit("taskListCheck"), u) : n(s);
  }
  function u(s) {
    return O(s) ? t(s) : $(s) ? e.check({
      tokenize: nS
    }, t, n)(s) : n(s);
  }
}
function nS(e, t, n) {
  return Q(e, r, "whitespace");
  function r(i) {
    return i === null ? n(i) : t(i);
  }
}
function rS(e) {
  return Ud([
    Pw(),
    Mw(),
    Qw(e),
    Xw(),
    eS()
  ]);
}
const iS = {};
function lS(e) {
  const t = (
    /** @type {Processor<Root>} */
    this
  ), n = e || iS, r = t.data(), i = r.micromarkExtensions || (r.micromarkExtensions = []), l = r.fromMarkdownExtensions || (r.fromMarkdownExtensions = []), o = r.toMarkdownExtensions || (r.toMarkdownExtensions = []);
  i.push(rS(n)), l.push(Ew()), o.push(Tw(n));
}
const oS = /^<br\s*\/?>$/i;
function Nh(e) {
  if (e.children) {
    e.children = e.children.map((t) => t.type === "html" && typeof t.value == "string" && oS.test(t.value.trim()) ? { type: "break" } : t);
    for (const t of e.children) Nh(t);
  }
}
function uS() {
  return (e) => Nh(e);
}
function sS({ items: e }) {
  if (!e.length) return null;
  const t = /* @__PURE__ */ new Set(), n = e.filter((r) => {
    const i = `${r.manual}§${r.section}`;
    return t.has(i) ? !1 : (t.add(i), !0);
  });
  return /* @__PURE__ */ F.jsxs("div", { className: "sa-cite", children: [
    /* @__PURE__ */ F.jsx("span", { className: "sa-cite-label", children: "Sources" }),
    /* @__PURE__ */ F.jsx("ul", { children: n.map((r) => /* @__PURE__ */ F.jsxs("li", { children: [
      /* @__PURE__ */ F.jsx("span", { className: "sa-cite-manual", children: r.manual }),
      r.section ? /* @__PURE__ */ F.jsxs("span", { className: "sa-cite-section", children: [
        " — ",
        r.section
      ] }) : null
    ] }, `${r.manual}§${r.section}`)) })
  ] });
}
function aS({ m: e }) {
  return e.role === "user" ? /* @__PURE__ */ F.jsx("div", { className: "sa-msg sa-user", children: /* @__PURE__ */ F.jsx("div", { className: "sa-bubble", children: e.content }) }) : /* @__PURE__ */ F.jsx("div", { className: `sa-msg sa-bot${e.error ? " sa-err" : ""}`, children: /* @__PURE__ */ F.jsxs("div", { className: "sa-bubble", children: [
    e.error ? /* @__PURE__ */ F.jsx("p", { children: e.content }) : /* @__PURE__ */ F.jsx("div", { className: "sa-md", children: /* @__PURE__ */ F.jsx(
      Qx,
      {
        remarkPlugins: [lS, uS],
        components: {
          table: ({ node: t, ...n }) => /* @__PURE__ */ F.jsx("div", { className: "sa-table-wrap", tabIndex: 0, children: /* @__PURE__ */ F.jsx("table", { ...n }) }),
          a: ({ node: t, ...n }) => /* @__PURE__ */ F.jsx("a", { ...n, target: "_blank", rel: "noopener noreferrer" })
        },
        children: e.content
      }
    ) }),
    e.citations && e.citations.length > 0 ? /* @__PURE__ */ F.jsx(sS, { items: e.citations }) : null
  ] }) });
}
function cS({ session: e, labels: t, uid: n }) {
  var x, T, h;
  const r = Ve.useSyncExternalStore((m) => e.subscribe(m), () => e.getState()), [i, l] = Ve.useState(""), o = Ve.useRef(null), u = Ve.useRef(null), s = Ve.useRef(null), a = Ve.useRef(!1);
  Ve.useEffect(() => {
    var m, y;
    r.open && !a.current && ((m = u.current) == null || m.focus()), !r.open && a.current && ((y = o.current) == null || y.focus()), a.current = r.open;
  }, [r.open]), Ve.useLayoutEffect(() => {
    const m = s.current;
    m && (m.scrollTop = m.scrollHeight);
  }, [r.messages.length, r.pending]);
  const f = `${r.context.module}|${(x = r.context.vesselId) != null ? x : ""}|${(T = r.context.userKey) != null ? T : ""}|${(h = r.context.tenantKey) != null ? h : ""}`;
  Ve.useEffect(() => l(""), [f]);
  const c = Ve.useCallback((m) => {
    !m.trim() || r.pending || (e.send(m), l(""));
  }, [e, r.pending]);
  if (!r.signedIn) return null;
  const p = `${n}-panel`, d = `${n}-title`, g = r.messages.length === 0 && !!r.suggestions && r.suggestions.length > 0;
  return /* @__PURE__ */ F.jsxs("div", { className: "sa-root", onKeyDown: (m) => {
    m.key === "Escape" && r.open && (m.stopPropagation(), e.setOpen(!1));
  }, children: [
    r.open ? /* @__PURE__ */ F.jsxs("section", { id: p, className: "sa-panel", role: "dialog", "aria-modal": "false", "aria-labelledby": d, children: [
      /* @__PURE__ */ F.jsxs("header", { className: "sa-head", children: [
        /* @__PURE__ */ F.jsxs("div", { className: "sa-head-text", children: [
          /* @__PURE__ */ F.jsx("h2", { id: d, className: "sa-title", children: t.title }),
          t.subtitle || r.context.vesselName ? /* @__PURE__ */ F.jsx("p", { className: "sa-sub", children: [t.subtitle, r.context.vesselName].filter(Boolean).join(" · ") }) : null
        ] }),
        /* @__PURE__ */ F.jsx(
          "button",
          {
            type: "button",
            className: "sa-icon-btn",
            onClick: () => e.newChat(),
            "aria-label": "Start a new chat",
            title: "New chat",
            disabled: r.messages.length === 0 && !r.pending,
            children: /* @__PURE__ */ F.jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ F.jsx("path", { d: "M12 5v14M5 12h14" }) })
          }
        ),
        /* @__PURE__ */ F.jsx("button", { type: "button", className: "sa-icon-btn", onClick: () => e.setOpen(!1), "aria-label": "Close assistant", title: "Close", children: /* @__PURE__ */ F.jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ F.jsx("path", { d: "M6 6l12 12M18 6L6 18" }) }) })
      ] }),
      /* @__PURE__ */ F.jsxs("div", { className: "sa-list", ref: s, role: "log", "aria-live": "polite", "aria-relevant": "additions", "aria-busy": r.pending, children: [
        r.messages.length === 0 ? /* @__PURE__ */ F.jsxs("div", { className: "sa-empty", children: [
          /* @__PURE__ */ F.jsx("p", { children: t.intro }),
          r.suggestionsLoading ? /* @__PURE__ */ F.jsx("p", { className: "sa-muted", "aria-live": "polite", children: "Loading suggestions…" }) : null,
          g ? /* @__PURE__ */ F.jsx("div", { className: "sa-sugg", role: "group", "aria-label": "Suggested questions", children: r.suggestions.map((m) => /* @__PURE__ */ F.jsx("button", { type: "button", className: "sa-chip", onClick: () => c(m), disabled: r.pending, children: m }, m)) }) : null
        ] }) : r.messages.map((m) => /* @__PURE__ */ F.jsx(aS, { m }, m.id)),
        r.pending ? /* @__PURE__ */ F.jsx("div", { className: "sa-msg sa-bot", "aria-label": "The assistant is answering", children: /* @__PURE__ */ F.jsxs("div", { className: "sa-bubble sa-typing", children: [
          /* @__PURE__ */ F.jsx("span", {}),
          /* @__PURE__ */ F.jsx("span", {}),
          /* @__PURE__ */ F.jsx("span", {}),
          /* @__PURE__ */ F.jsx("span", { className: "sa-vh", children: "The assistant is answering…" })
        ] }) }) : null,
        r.retryable && !r.pending ? /* @__PURE__ */ F.jsx("div", { className: "sa-retry", children: /* @__PURE__ */ F.jsx("button", { type: "button", className: "sa-link", onClick: () => e.retry(), children: "Try again" }) }) : null
      ] }),
      /* @__PURE__ */ F.jsxs("form", { className: "sa-form", onSubmit: (m) => {
        m.preventDefault(), c(i);
      }, children: [
        /* @__PURE__ */ F.jsx("label", { htmlFor: `${n}-input`, className: "sa-vh", children: "Your question" }),
        /* @__PURE__ */ F.jsx(
          "textarea",
          {
            id: `${n}-input`,
            ref: u,
            className: "sa-input",
            rows: 1,
            maxLength: 2e3,
            value: i,
            placeholder: t.placeholder,
            onChange: (m) => l(m.target.value),
            onKeyDown: (m) => {
              m.key === "Enter" && !m.shiftKey && !m.nativeEvent.isComposing && (m.preventDefault(), c(i));
            }
          }
        ),
        /* @__PURE__ */ F.jsx("button", { type: "submit", className: "sa-send", disabled: !i.trim() || r.pending, "aria-label": "Send question", children: /* @__PURE__ */ F.jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ F.jsx("path", { d: "M4 12l16-8-6 16-2-7-8-1z" }) }) })
      ] })
    ] }) : null,
    /* @__PURE__ */ F.jsx(
      "button",
      {
        ref: o,
        type: "button",
        className: "sa-launcher",
        "aria-label": r.open ? "Close assistant" : t.launcher,
        "aria-expanded": r.open,
        "aria-controls": r.open ? p : void 0,
        onClick: () => e.setOpen(!r.open),
        children: r.open ? /* @__PURE__ */ F.jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ F.jsx("path", { d: "M6 6l12 12M18 6L6 18" }) }) : /* @__PURE__ */ F.jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ F.jsx("path", { d: "M4 5h16v11H8l-4 4z" }) })
      }
    )
  ] });
}
class Mu extends Error {
  constructor(t) {
    super(t), this.name = "TokenUnavailableError";
  }
}
class ju extends Error {
  constructor(t) {
    super(t), this.name = "IdentityRejectedError";
  }
}
class Ao extends Error {
  constructor(t) {
    super(t), this.name = "AssistantUnavailableError";
  }
}
const fS = 45e3, pS = 1e4, dS = 15e3, hS = 20;
function mS(e) {
  return !!e && typeof e == "object" && e.name === "AbortError";
}
function gS(e) {
  const t = e.lastIndexOf(".");
  if (t <= 0) return null;
  try {
    const n = e.slice(0, t).replace(/-/g, "+").replace(/_/g, "/"), r = JSON.parse(atob(n + "=".repeat((4 - n.length % 4) % 4)));
    return typeof (r == null ? void 0 : r.exp) == "number" ? r.exp : null;
  } catch {
    return null;
  }
}
function af(e, t) {
  const n = new AbortController(), r = () => n.abort();
  e.aborted ? n.abort() : e.addEventListener("abort", r, { once: !0 });
  const i = setTimeout(() => n.abort(), t);
  return {
    signal: n.signal,
    done: () => {
      clearTimeout(i), e.removeEventListener("abort", r);
    }
  };
}
class yS {
  constructor(t, n, r = (...i) => fetch(...i)) {
    this.baseUrl = t, this.getToken = n, this.fetchImpl = r, this.cached = null;
  }
  /** Forget the cached token (identity, tenant or module changed; logout). */
  forgetToken() {
    this.cached = null;
  }
  async token(t, n, r) {
    const i = Date.now() / 1e3;
    if (!n && this.cached && this.cached.exp !== null && this.cached.exp - i > hS)
      return this.cached.token;
    this.cached = null;
    const l = af(r, dS);
    let o;
    try {
      o = await this.getToken({ reason: t, forceRefresh: n, signal: l.signal });
    } catch (u) {
      throw r.aborted ? u : new Mu(u instanceof Error ? u.message : "token request failed");
    } finally {
      l.done();
    }
    if (r.aborted) throw new DOMException("aborted", "AbortError");
    if (typeof o != "string" || !o.includes(".")) throw new Mu("token provider returned no token");
    return this.cached = { token: o, exp: gS(o) }, o;
  }
  /** One authenticated request with the bounded refresh: 401 → one forced new token → one retry → IdentityRejectedError. */
  async authed(t, n, r, i, l) {
    for (let o = 0; o < 2; o++) {
      const u = await this.token(t, o > 0, r), s = af(r, n);
      let a;
      try {
        a = await i(u, s.signal);
      } catch (f) {
        throw r.aborted ? f : new Ao(mS(f) ? "the assistant did not answer in time" : "the assistant could not be reached");
      } finally {
        s.done();
      }
      if (a.status === 401) {
        if (this.cached = null, o === 0) continue;
        throw new ju("your session could not be verified");
      }
      if (!a.ok) throw new Ao(`assistant HTTP ${a.status}`);
      return l(a);
    }
    throw new ju("your session could not be verified");
  }
  chat(t, n) {
    return this.authed(
      "chat",
      fS,
      n,
      (r, i) => this.fetchImpl(`${this.baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-assistant-identity": r },
        body: JSON.stringify(t),
        signal: i
      }),
      async (r) => {
        const i = await r.json().catch(() => null);
        if (!i || typeof i.response != "string") throw new Ao("the assistant returned no answer");
        return i;
      }
    );
  }
  suggestions(t, n) {
    return this.authed(
      "suggestions",
      pS,
      n,
      (r, i) => this.fetchImpl(`${this.baseUrl}/suggestions?module=${encodeURIComponent(t)}`, {
        headers: { "x-assistant-identity": r },
        signal: i
      }),
      async (r) => {
        const i = await r.json().catch(() => null);
        return !i || i.module !== t || !Array.isArray(i.questions) ? [] : i.questions.filter((l) => typeof l == "string" && l.trim().length > 0).slice(0, 6);
      }
    );
  }
}
const Ah = { suggestions: !0, maxMessages: 40, historyMessages: 8, maxMessageChars: 2e3 }, kS = "The assistant is temporarily unavailable. Please try again in a moment.", vS = "Your session could not be verified. Please sign in again, then reopen the assistant.", xS = "The assistant is not available for your account here.";
let wS = 0;
const Sr = () => `m${Date.now().toString(36)}${(wS++).toString(36)}`;
function cf() {
  const e = globalThis.crypto;
  return e && typeof e.randomUUID == "function" ? e.randomUUID() : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function SS(e, t) {
  var n, r, i, l, o, u;
  return e.module === t.module && ((n = e.vesselId) != null ? n : null) === ((r = t.vesselId) != null ? r : null) && ((i = e.userKey) != null ? i : null) === ((l = t.userKey) != null ? l : null) && ((o = e.tenantKey) != null ? o : null) === ((u = t.tenantKey) != null ? u : null);
}
class CS {
  constructor(t, n, r = Ah) {
    this.transport = t, this.opts = r, this.listeners = /* @__PURE__ */ new Set(), this.epoch = 0, this.convId = cf(), this.chatCtl = null, this.sugCtl = null, this.destroyed = !1, this.state = {
      open: !1,
      signedIn: n.userKey !== null,
      messages: [],
      pending: !1,
      suggestions: r.suggestions ? null : [],
      suggestionsLoading: !1,
      context: { ...n },
      retryable: null
    };
  }
  getState() {
    return this.state;
  }
  subscribe(t) {
    return this.listeners.add(t), () => this.listeners.delete(t);
  }
  set(t) {
    if (!this.destroyed) {
      this.state = { ...this.state, ...t };
      for (const n of [...this.listeners]) n(this.state);
    }
  }
  /** Abort everything in flight and forget the conversation. Late responses of the old epoch are dropped. */
  reset(t) {
    var r, i;
    this.epoch++, (r = this.chatCtl) == null || r.abort(), (i = this.sugCtl) == null || i.abort(), this.chatCtl = this.sugCtl = null, this.transport.forgetToken(), this.convId = cf();
    const n = t.userKey !== null;
    this.set({
      messages: [],
      pending: !1,
      retryable: null,
      context: { ...t },
      signedIn: n,
      suggestions: this.opts.suggestions ? null : [],
      suggestionsLoading: !1,
      open: n ? this.state.open : !1
    }), n && this.state.open && this.loadSuggestions();
  }
  updateContext(t) {
    if (this.destroyed) return;
    const n = { ...this.state.context, ...t };
    n.module || (n.module = this.state.context.module), SS(this.state.context, n) ? this.set({ context: n }) : this.reset(n);
  }
  setOpen(t) {
    this.destroyed || t && !this.state.signedIn || (this.set({ open: t }), t && this.state.suggestions === null && this.loadSuggestions());
  }
  /** Clear the conversation but keep who/where the user is (the "New chat" button). */
  newChat() {
    this.reset(this.state.context);
  }
  loadSuggestions() {
    if (!this.opts.suggestions || this.state.suggestionsLoading || !this.state.signedIn) return;
    const t = this.epoch, n = this.state.context.module, r = new AbortController();
    this.sugCtl = r, this.set({ suggestionsLoading: !0 }), this.transport.suggestions(n, r.signal).then(
      (i) => {
        t !== this.epoch || n !== this.state.context.module || this.set({ suggestions: i, suggestionsLoading: !1 });
      },
      () => {
        t === this.epoch && this.set({ suggestions: [], suggestionsLoading: !1 });
      }
    );
  }
  history() {
    return this.state.messages.filter((t) => !t.error && t.content.trim()).slice(-this.opts.historyMessages).map((t) => ({ role: t.role, content: t.content.slice(0, 4e3) }));
  }
  payloadContext() {
    const t = this.state.context, n = { module: t.module };
    return t.vesselId && (n.vesselId = String(t.vesselId)), t.vesselName && (n.vesselName = String(t.vesselName)), t.currentPage && (n.currentPage = String(t.currentPage).slice(0, 200)), n;
  }
  /** Send a question. Ignored while another answer is pending, when signed out, or for empty text. */
  async send(t) {
    const n = t.trim().slice(0, this.opts.maxMessageChars);
    if (this.destroyed || !n || this.state.pending || !this.state.signedIn) return;
    const r = this.epoch, i = this.history(), l = { id: Sr(), role: "user", content: n }, o = this.opts.maxMessages - 1;
    this.set({ messages: [...this.state.messages, l].slice(-o), pending: !0, retryable: null });
    const u = new AbortController();
    this.chatCtl = u;
    let s;
    try {
      const a = await this.transport.chat(
        { message: n, conversationHistory: i, context: this.payloadContext(), conversationId: this.convId },
        u.signal
      );
      s = { id: Sr(), role: "assistant", content: a.response, citations: Array.isArray(a.citations) ? a.citations : [], gate: a.gate };
    } catch (a) {
      if (r !== this.epoch || u.signal.aborted) return;
      a instanceof ju ? s = { id: Sr(), role: "assistant", content: vS, error: "session" } : a instanceof Mu ? s = { id: Sr(), role: "assistant", content: xS, error: "not-allowed" } : s = { id: Sr(), role: "assistant", content: kS, error: "unavailable" }, this.set({
        messages: [...this.state.messages, s].slice(-this.opts.maxMessages),
        pending: !1,
        retryable: s.error === "unavailable" ? n : null
      });
      return;
    } finally {
      this.chatCtl === u && (this.chatCtl = null);
    }
    r === this.epoch && this.set({ messages: [...this.state.messages, s].slice(-this.opts.maxMessages), pending: !1 });
  }
  /** Re-ask the last failed question (drops its error bubble and the failed question first). */
  retry() {
    const t = this.state.retryable;
    if (!t || this.state.pending) return;
    const n = [...this.state.messages];
    n.length && n[n.length - 1].error && n.pop(), n.length && n[n.length - 1].role === "user" && n[n.length - 1].content === t && n.pop(), this.set({ messages: n, retryable: null }), this.send(t);
  }
  destroy() {
    var t, n;
    this.destroyed || (this.epoch++, (t = this.chatCtl) == null || t.abort(), (n = this.sugCtl) == null || n.abort(), this.transport.forgetToken(), this.listeners.clear(), this.destroyed = !0);
  }
  get isDestroyed() {
    return this.destroyed;
  }
}
const ES = ':host{all:initial;--sa-accent: #1f4e79;--sa-accent-ink: #ffffff;--sa-bg: #ffffff;--sa-ink: #1b1f24;--sa-muted: #5b6573;--sa-line: #dfe3e8;--sa-soft: #f3f5f8;--sa-err: #9a2a1d;--sa-err-bg: #fdf1ef;--sa-focus: #2b7de9;--sa-z: 2147483000;--sa-offset: 20px}@media (prefers-color-scheme: dark){:host(:not([data-theme="light"])){--sa-bg: #1b1f24;--sa-ink: #e8ebef;--sa-muted: #a3acb8;--sa-line: #333a43;--sa-soft: #252b33;--sa-err: #ffb4a8;--sa-err-bg: #3a2320;--sa-accent: #4a8fd1}}:host([data-theme="dark"]){--sa-bg: #1b1f24;--sa-ink: #e8ebef;--sa-muted: #a3acb8;--sa-line: #333a43;--sa-soft: #252b33;--sa-err: #ffb4a8;--sa-err-bg: #3a2320;--sa-accent: #4a8fd1}*,*:before,*:after{box-sizing:border-box}.sa-root{position:fixed;z-index:var(--sa-z);right:var(--sa-offset);bottom:var(--sa-offset);display:flex;flex-direction:column;align-items:flex-end;gap:12px;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;color:var(--sa-ink);-webkit-font-smoothing:antialiased;text-align:left}:host([data-position="bottom-left"]) .sa-root{right:auto;left:var(--sa-offset);align-items:flex-start}button{font:inherit;color:inherit;cursor:pointer}button:disabled{cursor:default;opacity:.5}:focus-visible{outline:2px solid var(--sa-focus);outline-offset:2px}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.sa-launcher{width:56px;height:56px;border-radius:50%;border:0;display:grid;place-items:center;background:var(--sa-accent);color:var(--sa-accent-ink);box-shadow:0 6px 20px #00000038}.sa-launcher svg{width:24px;height:24px}.sa-launcher:hover{filter:brightness(1.08)}.sa-panel{width:380px;height:min(620px,calc(100vh - 110px));display:flex;flex-direction:column;background:var(--sa-bg);border:1px solid var(--sa-line);border-radius:14px;overflow:hidden;box-shadow:0 12px 40px #00000040}.sa-head{display:flex;align-items:center;gap:6px;padding:12px 10px 12px 16px;background:var(--sa-accent);color:var(--sa-accent-ink)}.sa-head-text{flex:1;min-width:0}.sa-title{margin:0;font-size:15px;font-weight:600;line-height:1.3}.sa-sub{margin:2px 0 0;font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sa-icon-btn{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:inherit;display:grid;place-items:center}.sa-icon-btn:hover:not(:disabled){background:#ffffff29}.sa-icon-btn svg{width:18px;height:18px}.sa-list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--sa-bg)}.sa-empty p{margin:0 0 10px;color:var(--sa-muted)}.sa-muted{color:var(--sa-muted);font-size:12px}.sa-sugg{display:flex;flex-direction:column;gap:6px}.sa-chip{text-align:left;padding:8px 12px;border-radius:10px;border:1px solid var(--sa-line);background:var(--sa-soft);color:var(--sa-ink);line-height:1.35}.sa-chip:hover:not(:disabled){border-color:var(--sa-accent)}.sa-msg{display:flex}.sa-user{justify-content:flex-end}.sa-bubble{max-width:88%;padding:9px 12px;border-radius:12px;overflow-wrap:anywhere}.sa-user .sa-bubble{background:var(--sa-accent);color:var(--sa-accent-ink);white-space:pre-wrap;border-bottom-right-radius:4px}.sa-bot .sa-bubble{background:var(--sa-soft);border-bottom-left-radius:4px}.sa-err .sa-bubble{background:var(--sa-err-bg);color:var(--sa-err)}.sa-bubble p{margin:0 0 8px}.sa-bubble>:last-child,.sa-md>:last-child{margin-bottom:0}.sa-md ul,.sa-md ol{margin:0 0 8px;padding-left:20px}.sa-md li{margin:2px 0}.sa-md h1,.sa-md h2,.sa-md h3,.sa-md h4{font-size:14px;margin:8px 0 6px}.sa-md code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;background:#7f7f7f26;padding:1px 4px;border-radius:4px}.sa-md pre{overflow-x:auto;padding:8px;background:#7f7f7f1f;border-radius:6px}.sa-md a{color:var(--sa-focus)}.sa-table-wrap{overflow-x:auto;margin:6px 0 8px;border:1px solid var(--sa-line);border-radius:6px}.sa-md table{border-collapse:collapse;width:max-content;min-width:100%;font-size:12.5px}.sa-md th,.sa-md td{border-bottom:1px solid var(--sa-line);padding:5px 8px;text-align:left;vertical-align:top;overflow-wrap:normal;word-break:normal;max-width:220px}.sa-md th{background:#7f7f7f1a;font-weight:600}.sa-md tr:last-child td{border-bottom:0}.sa-cite{margin-top:8px;padding-top:6px;border-top:1px solid var(--sa-line);font-size:12px;color:var(--sa-muted)}.sa-cite-label{font-weight:600}.sa-cite ul{margin:2px 0 0;padding-left:16px}.sa-cite-manual{color:var(--sa-ink)}.sa-typing{display:flex;gap:4px;align-items:center;min-height:34px}.sa-typing span:not(.sa-vh){width:6px;height:6px;border-radius:50%;background:var(--sa-muted);animation:sa-dot 1.2s infinite ease-in-out}.sa-typing span:nth-child(2){animation-delay:.15s}.sa-typing span:nth-child(3){animation-delay:.3s}@keyframes sa-dot{0%,80%,to{opacity:.25}40%{opacity:1}}.sa-retry{display:flex}.sa-link{border:0;background:none;padding:2px 0;color:var(--sa-focus);text-decoration:underline}.sa-form{display:flex;gap:8px;align-items:flex-end;padding:10px;border-top:1px solid var(--sa-line);background:var(--sa-bg)}.sa-input{flex:1;resize:none;min-height:40px;max-height:120px;padding:9px 11px;border:1px solid var(--sa-line);border-radius:10px;font:inherit;color:var(--sa-ink);background:var(--sa-bg)}.sa-input::placeholder{color:var(--sa-muted)}.sa-send{width:40px;height:40px;flex:none;border:0;border-radius:10px;background:var(--sa-accent);color:var(--sa-accent-ink);display:grid;place-items:center}.sa-vh{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}@media (max-width: 520px){.sa-root{right:12px;bottom:12px;left:auto}:host([data-position="bottom-left"]) .sa-root{left:12px}.sa-panel{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;border-radius:0;border:0}}@media (prefers-reduced-motion: reduce){.sa-typing span{animation:none!important}}', ff = "1.0.1", TS = /^[a-z][a-z0-9_-]{1,39}$/;
let sn = null, _S = 0;
function IS(e) {
  if (typeof e != "string" || !e) throw new Error("SailAssistant: assistantUrl is required");
  let t;
  try {
    t = new URL(e, typeof location != "undefined" ? location.href : void 0);
  } catch {
    throw new Error("SailAssistant: assistantUrl is not a valid URL");
  }
  const n = ["localhost", "127.0.0.1", "[::1]"].includes(t.hostname), r = typeof location != "undefined" && t.origin === location.origin;
  if (t.protocol !== "https:" && !n && !r) throw new Error("SailAssistant: assistantUrl must use https");
  return t.href.replace(/\/+$/, "");
}
function pf(e) {
  const t = typeof e == "string" ? e.trim().toLowerCase() : "";
  if (!TS.test(t)) throw new Error('SailAssistant: module must be the assistant module id (e.g. "crewing")');
  return t;
}
function PS(e) {
  var g, x, T, h, m, y;
  if (!e || typeof e != "object") throw new Error("SailAssistant: config is required");
  const t = IS(e.assistantUrl), n = pf(e.module);
  if (typeof e.getToken != "function") throw new Error("SailAssistant: getToken(…) is required");
  if (typeof document == "undefined") throw new Error("SailAssistant: needs a browser document");
  sn && (console.warn("[SailAssistant] init() called while a widget is mounted — replacing it."), sn.handle.destroy());
  const r = document.createElement("div");
  r.setAttribute("data-sail-assistant", ff), r.setAttribute("data-position", e.position === "bottom-left" ? "bottom-left" : "bottom-right"), (e.theme === "light" || e.theme === "dark") && r.setAttribute("data-theme", e.theme);
  const i = r.attachShadow({ mode: "open" }), l = document.createElement("style"), o = [];
  typeof e.zIndex == "number" && Number.isFinite(e.zIndex) && o.push(`--sa-z:${Math.trunc(e.zIndex)}`), typeof e.offset == "number" && Number.isFinite(e.offset) && o.push(`--sa-offset:${Math.max(0, Math.trunc(e.offset))}px`), typeof e.accentColor == "string" && /^#[0-9a-f]{3,8}$|^rgb/i.test(e.accentColor) && o.push(`--sa-accent:${e.accentColor}`), l.textContent = ES + (o.length ? `
:host{${o.join(";")}}` : "");
  const u = document.createElement("div");
  i.append(l, u), ((g = e.container) != null ? g : document.body).appendChild(r);
  const s = new yS(t, e.getToken), a = (x = e.context) != null ? x : {}, f = new CS(
    s,
    { ...a, module: n },
    { ...Ah, suggestions: e.suggestions !== !1 }
  ), c = {
    title: (T = e.title) != null ? T : "SAIL Assistant",
    subtitle: e.subtitle,
    launcher: (h = e.launcherLabel) != null ? h : "Open assistant",
    placeholder: (m = e.placeholder) != null ? m : "Ask a question…",
    intro: (y = e.intro) != null ? y : "Ask how to do something in this module. Answers come from the user manuals and show their sources."
  };
  let p = Ed(u);
  p.render(Ve.createElement(cS, { session: f, labels: c, uid: `sa${++_S}` }));
  const d = {
    version: ff,
    updateContext(C) {
      if (!p) return;
      const _ = { ...C };
      _.module !== void 0 && (_.module = pf(_.module)), f.updateContext(_);
    },
    open() {
      p && f.setOpen(!0);
    },
    close() {
      p && f.setOpen(!1);
    },
    destroy() {
      p && (f.destroy(), p.unmount(), p = null, r.remove(), (sn == null ? void 0 : sn.handle) === d && (sn = null));
    }
  };
  return sn = { handle: d, host: r }, d;
}
export {
  ff as VERSION,
  PS as init
};
//# sourceMappingURL=sail-assistant-widget.1.0.1.mjs.map
