(function (d) {

  'use strict';

  var CssPath = module.exports = function CssPath (element) {
    this.element = element;
    this.path = this.full();
  };

  CssPath.shortest = function(element) {
    return new CssPath(element).shortest();
  };

  /**
   * No spaces
   */
  CssPath.prototype.shortest = function () {
    return this.compact().replace(/\s+/g, '');
  };

  /**
   * Removes unecessary nesting and tag names.
   * Checks validity of new path using querySelector
   */
  CssPath.prototype.compact = function () {
    var selectorRegex = /(^|[\.#\s:])([\w_-\d]|\(\d+\))+\s?>?/;
    var compact, _path = this.path;
    do {
      compact = _path;
      _path = _path.replace(selectorRegex, '');
    } while (
      selectorRegex.test(compact) &&
      _path.trim() &&
      d.querySelector(_path) === this.element
    );
    return compact;
  };

  /**
   * Returns the CSS path to the element
   *
   * All the following code was taken from
   * https://gist.github.com/asfaltboy/8aea7435b888164e8563
   * which is ported from the original code found in Chromiumn as can be seen here:
   * https://chromium.googlesource.com/chromium/blink/+/master/Source/devtools/front_end/components/DOMPresentationUtils.js
   *
   */
  CssPath.prototype.full = function (optimized) {
    if (this.element.nodeType !== Node.ELEMENT_NODE)
      return "";
    var steps = [];
    var contextNode = this.element;
    while (contextNode) {
      var step = _cssPathStep(contextNode, !!optimized, contextNode === this.element);
      if (!step)
        break; // Error - bail out early.
      steps.push(step);
      if (step.optimized)
        break;
      contextNode = contextNode.parentNode;
    }
    steps.reverse();
    return steps.join(" > ");
  };

  function _cssPathStep (node, optimized, isTargetNode) {
    if (node.nodeType !== Node.ELEMENT_NODE)
      return null;

    var id = node.getAttribute("id");
    if (optimized) {
      if (id)
        return new DOMNodePathStep(idSelector(id), true);
      var nodeNameLower = node.nodeName.toLowerCase();
      if (nodeNameLower === "body" || nodeNameLower === "head" || nodeNameLower === "html")
        return new DOMNodePathStep(node.nodeName.toLowerCase(), true);
    }
    var nodeName = node.nodeName.toLowerCase();

    if (id)
      return new DOMNodePathStep(nodeName.toLowerCase() + idSelector(id), true);
    var parent = node.parentNode;
    if (!parent || parent.nodeType === Node.DOCUMENT_NODE)
      return new DOMNodePathStep(nodeName.toLowerCase(), true);

    /**
     * @param {DOMNode} node
     * @return {Array.<string>}
     */
    function prefixedElementClassNames(node) {
      var classAttribute = node.getAttribute("class");
      if (!classAttribute)
        return [];

      return classAttribute.split(/\s+/g).filter(Boolean).map(function(name) {
        // The prefix is required to store "__proto__" in a object-based map.
        return "$" + name;
      });
     }

    /**
     * @param {string} id
     * @return {string}
     */
    function idSelector(id) {
      return "#" + escapeIdentifierIfNeeded(id);
    }

    /**
     * @param {string} ident
     * @return {string}
     */
    function escapeIdentifierIfNeeded(ident) {
      if (isCSSIdentifier(ident))
        return ident;
      var shouldEscapeFirst = /^(?:[0-9]|-[0-9-]?)/.test(ident);
      var lastIndex = ident.length - 1;
      return ident.replace(/./g, function(c, i) {
        return ((shouldEscapeFirst && i === 0) || !isCSSIdentChar(c)) ? escapeAsciiChar(c, i === lastIndex) : c;
      });
    }

    /**
     * @param {string} c
     * @param {boolean} isLast
     * @return {string}
     */
    function escapeAsciiChar(c, isLast) {
      return "\\" + toHexByte(c) + (isLast ? "" : " ");
    }

    /**
     * @param {string} c
     */
    function toHexByte(c) {
      var hexByte = c.charCodeAt(0).toString(16);
      if (hexByte.length === 1)
        hexByte = "0" + hexByte;
      return hexByte;
    }

    /**
     * @param {string} c
     * @return {boolean}
     */
    function isCSSIdentChar(c) {
      if (/[a-zA-Z0-9_-]/.test(c))
        return true;
      return c.charCodeAt(0) >= 0xA0;
    }

    /**
     * @param {string} value
     * @return {boolean}
     */
    function isCSSIdentifier(value) {
      return /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/.test(value);
    }

    var prefixedOwnClassNamesArray = prefixedElementClassNames(node);
    var needsClassNames = false;
    var needsNthChild = false;
    var ownIndex = -1;
    var siblings = parent.children;
    for (var i = 0; (ownIndex === -1 || !needsNthChild) && i < siblings.length; ++i) {
      var sibling = siblings[i];
      if (sibling === node) {
        ownIndex = i;
        continue;
      }
      if (needsNthChild)
        continue;
      if (sibling.nodeName.toLowerCase() !== nodeName.toLowerCase())
        continue;

      needsClassNames = true;
      var ownClassNames = prefixedOwnClassNamesArray;
      var ownClassNameCount = 0;
      for (var name in ownClassNames)
        ++ownClassNameCount;
      if (ownClassNameCount === 0) {
        needsNthChild = true;
        continue;
      }
      var siblingClassNamesArray = prefixedElementClassNames(sibling);
      for (var j = 0; j < siblingClassNamesArray.length; ++j) {
        var siblingClass = siblingClassNamesArray[j];
        if (ownClassNames.indexOf(siblingClass))
          continue;
        delete ownClassNames[siblingClass];
        if (!--ownClassNameCount) {
          needsNthChild = true;
          break;
        }
      }
    }

    var result = nodeName.toLowerCase();
    if (isTargetNode && nodeName.toLowerCase() === "input" && node.getAttribute("type") && !node.getAttribute("id") && !node.getAttribute("class"))
      result += "[type=\"" + node.getAttribute("type") + "\"]";
    if (needsNthChild) {
      result += ":nth-child(" + (ownIndex + 1) + ")";
    } else if (needsClassNames) {
      for (var prefixedName in prefixedOwnClassNamesArray)
      // for (var prefixedName in prefixedOwnClassNamesArray.keySet())
        result += "." + escapeIdentifierIfNeeded(prefixedOwnClassNamesArray[prefixedName].substr(1));
    }

    return new DOMNodePathStep(result, false);
  }

  /**
   * @constructor
   * @param {string} value
   * @param {boolean} optimized
   */
  var DOMNodePathStep = function(value, optimized) {
    this.value = value;
    this.optimized = optimized || false;
  };

  DOMNodePathStep.prototype = {
    /**
     * @return {string}
     */
    toString: function() {
      return this.value;
    }
  };
})(document);
