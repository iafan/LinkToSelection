// Copyright (C) 2016 Igor Afanasyev, https://github.com/iafan/LinkToSelection
// Version: 0.2

(function(){
  var HASH_PREFIX = 'sel:';
  var SELECTOR_SAME = '*';
  var SELECTOR_TEXT = '@';
  var ID_SELECTOR_PREFIX = '#';
  var PATH_SEPARATOR = '/';
  var INDEX_SEPARATOR = '.';
  var POS_SEPARATOR = ':';
  var RANGE_SEPARATOR = '-';
  var ID_HYPHEN_SUBSTITUTE = '~';
  var ID_HYPHEN_RESTORE_REGEX = new RegExp(ID_HYPHEN_SUBSTITUTE, 'g');

  var SCROLLY_PADDING = 100;
  var SCROLLX_PADDING = 50;

  var SELECTION_TIMEOUT = 500;
  var SCROLL_AGAIN_TIMEOUT = 500;

  var selectionTimer;

  function getSelectionRange() {
    var sel;
    if (window.getSelection) {
      sel = window.getSelection();
      if (sel.rangeCount) {
        return sel.getRangeAt(0);
      }
    }
    return undefined;
  }

  function getNodeName(elem) {
    if (elem.nodeType === Node.TEXT_NODE) {
      return SELECTOR_TEXT;
    } else {
      return elem.nodeName.toLowerCase();
    }
  }

  function pathToContainer(elem) {
    var nodeName = getNodeName(elem);
    if (nodeName === 'body') return '';
    if (elem.id) return ID_SELECTOR_PREFIX + elem.id.replace(/\-/g, ID_HYPHEN_SUBSTITUTE);

    var parentPath;
    var index = -1;
    if (elem.parentNode) {
      var siblingNodes = elem.parentNode.childNodes;
      for (var i = 0; i < siblingNodes.length; i++) {
        if (getNodeName(siblingNodes[i]) === nodeName) {
          index++;
          if (siblingNodes[i] === elem) break;
        }
      }
      parentPath = pathToContainer(elem.parentNode);
    }
    var pathItem = index > 0 ? nodeName + INDEX_SEPARATOR + index : nodeName;
    return parentPath ? parentPath + PATH_SEPARATOR + pathItem : pathItem;
  }

  function encodePart(a, b) {
    return b == 0 ? a : a + POS_SEPARATOR + b;
  }

  function splitPathOnce(s) {
    var i = s.indexOf(PATH_SEPARATOR);
    return i == -1 ? [s, undefined] : [s.substr(0, i), s.substr(i + PATH_SEPARATOR.length)];
  }

  function calculateSelection() {
    var r = getSelectionRange();
    if (!r) return;
    //console.log('selection:', r);

    var sameContainer = r.startContainer === r.endContainer;

    if (sameContainer && (r.startOffset === r.endOffset)) {
      return; // nothing was selected
    }

    var startPath = pathToContainer(r.startContainer);
    var endPath = sameContainer ? SELECTOR_SAME : pathToContainer(r.endContainer);
    var path = encodePart(startPath, r.startOffset) + RANGE_SEPARATOR + encodePart(endPath, r.endOffset);
    //console.log('path:', path);
    var encodedPath = HASH_PREFIX + btoa(path).replace(/=/g, '');

    // don't blindly update the hash, as IE will reset selection in address bar
    // every time the hash is updated
    if (document.location.hash != '#'+encodedPath) {
      document.location.hash = encodedPath;
    }
  }

  function findNode(contextNode, path) {
    if (!path) return contextNode;
    //if (path == SELECTOR_TEXT) return contextNode.firstChild;

    var parts = splitPathOnce(path);

    var a = parts[0].split(INDEX_SEPARATOR);
    var nodeName = a[0];
    var nodeIndex = a[1] || 0;

    if (nodeName.startsWith(ID_SELECTOR_PREFIX)) {
      var id = nodeName.substr(ID_SELECTOR_PREFIX.length).replace(ID_HYPHEN_RESTORE_REGEX, '-');
      var node = document.getElementById(id);
      if (!node) throw new Error("Can't find node with id '"+id+"'");
      return findNode(node, parts[1]);
    }

    //console.log(contextNode, nodeName, nodeIndex);

    var children = contextNode.childNodes;
    var index = -1;
    for (var i = 0; i < children.length; i++) {
      if (getNodeName(children[i]) === nodeName) {
        index++;
        if (index == nodeIndex) {
          return findNode(children[i], parts[1]);
        }
      }
    }
    throw new Error("Can't find node <"+nodeName+"> with index "+nodeIndex+" in "+contextNode);
  }

  function recreateSelection(s) {
    //console.log('recreateSelection()', s);
    var parts = s.split(RANGE_SEPARATOR);
    var start = parts[0].split(POS_SEPARATOR);
    var end = parts[1].split(POS_SEPARATOR);

    var startContainer = findNode(document.body, start[0]);
    var endContainer = end[0] == SELECTOR_SAME ? startContainer : findNode(document.body, end[0]);
    var startOffset = start[1] || 0;
    var endOffset = end[1] || 0;

    /** /
    console.log(
      'startContainer:', startContainer, ', startOffset:', startOffset,
      ', endContainer:', endContainer, ', endOffset:', endOffset
    );
    /**/

    var range = document.createRange();
    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);

    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    setTimeout(function() {
      var rect = range.getBoundingClientRect();
      var sx = window.scrollX || document.documentElement.scrollLeft;
      var sy = window.scrollY || document.documentElement.scrollTop;
      var x = Math.round(rect.left + sx - SCROLLX_PADDING);
      var y = Math.round(rect.top + sy - SCROLLY_PADDING);
      //console.log('window.scrollTo('+x+', '+y+')');
      window.scrollTo(x, y); // scroll immediately
      // scroll aagin after a small timeout (for compatibility purposes)
      setTimeout(function() {
        window.scrollTo(x, y);
      }, SCROLL_AGAIN_TIMEOUT);
    }, 0);
  }

  function onSelectionChange(e) {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(calculateSelection, SELECTION_TIMEOUT);
  }

  function updateFromHash() {
    var hash = document.location.hash.substr(1);
    if (hash.startsWith(HASH_PREFIX)) {
      hash = hash.substr(HASH_PREFIX.length);
      try {
        recreateSelection(atob(hash));
      } catch (e) {
        console.warn('Failed to recreate selection: ', e);
      }
    }
  }

  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(s) {
      return this.indexOf(s) == 0;
    };
  }

  if (window.getSelection) {
    if (typeof document.onselectionchange !== 'undefined') {
      document.addEventListener('selectionchange', onSelectionChange);
    } else {
      setInterval(calculateSelection, SELECTION_TIMEOUT);
    }

    window.addEventListener('DOMContentLoaded', updateFromHash);
  } else {
    console.warn('window.getSelection is not supported in this browser');
  }
})();
