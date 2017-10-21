// Copyright (C) 2016-2017 Igor Afanasyev, https://github.com/iafan/LinkToSelection
// Version: 0.3

(function() {
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

	var canRemoveFauxSelection = false;
	var fauxSelectionDivs = [];

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

		var sameContainer = r.startContainer === r.endContainer;

		if (sameContainer && r.startOffset === r.endOffset) {
			return; // nothing was selected
		}

		var startPath = pathToContainer(r.startContainer);
		var endPath = sameContainer ? SELECTOR_SAME : pathToContainer(r.endContainer);
		var path = encodePart(startPath, r.startOffset) + RANGE_SEPARATOR + encodePart(endPath, r.endOffset);
		var encodedPath = HASH_PREFIX + btoa(path).replace(/=/g, '');

		// don't blindly update the hash, as IE will reset selection in address bar
		// every time the hash is updated
		if (document.location.hash != '#' + encodedPath) {
			document.location.hash = encodedPath;
		}
	}

	function findNode(contextNode, path) {
		if (!path) return contextNode;

		var parts = splitPathOnce(path);

		var a = parts[0].split(INDEX_SEPARATOR);
		var nodeName = a[0];
		var nodeIndex = a[1] || 0;

		if (nodeName.startsWith(ID_SELECTOR_PREFIX)) {
			var id = nodeName.substr(ID_SELECTOR_PREFIX.length).replace(ID_HYPHEN_RESTORE_REGEX, '-');
			var node = document.getElementById(id);
			if (!node) throw new Error("Can't find node with id '" + id + "'");
			return findNode(node, parts[1]);
		}

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
		throw new Error("Can't find node <" + nodeName + '> with index ' + nodeIndex + ' in ' + contextNode);
	}

	function recreateSelection(s) {
		var parts = s.split(RANGE_SEPARATOR);
		var start = parts[0].split(POS_SEPARATOR);
		var end = parts[1].split(POS_SEPARATOR);

		var startContainer = findNode(document.body, start[0]);
		var endContainer = end[0] == SELECTOR_SAME ? startContainer : findNode(document.body, end[0]);
		var startOffset = start[1] || 0;
		var endOffset = end[1] || 0;

		var range = document.createRange();
		range.setStart(startContainer, startOffset);
		range.setEnd(endContainer, endOffset);

		var sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);

		// Webkit on iOS does not highlight the selection unless
		// the element is contentEditable and is being edited at the moment;
		// so the highlighting needs to be imitated using semi-transparent divs
		var isIOSWebKit =
			/\bAppleWebKit\b/.test(navigator.userAgent) && /\biPad|iPhone|iPod\b/.test(navigator.userAgent);

		if (isIOSWebKit) {
			var r = range.getClientRects();
			for (var i = 0; i < r.length; i++) {
				var div = document.createElement('div');
				div.style.zIndex = '16777271'; // safe largest value for Safari 3
				div.style.backgroundColor = 'Highlight';
				div.style.opacity = '0.5';
				div.style.position = 'absolute';
				div.style.left = r[i].left + 'px';
				div.style.top = r[i].top + 'px';
				div.style.width = r[i].width + 'px';
				div.style.height = r[i].height + 'px';
				document.body.appendChild(div);

				// `pointer-events: none` doesn't work properly on mobile Webkit
				// (it prevents touch events on the div, but messes with the selection
				// change events), so just remove the faux selection on touching it
				div.ontouchstart = onSelectionChange;

				fauxSelectionDivs.push(div);
			}
			canRemoveFauxSelection = true;
		}

		setTimeout(function() {
			var rect = range.getBoundingClientRect();
			var sx = window.scrollX || document.documentElement.scrollLeft;
			var sy = window.scrollY || document.documentElement.scrollTop;
			var x = Math.round(rect.left + sx - SCROLLX_PADDING);
			var y = Math.round(rect.top + sy - SCROLLY_PADDING);
			window.scrollTo(x, y); // scroll immediately
			// scroll again after a small timeout (for compatibility purposes)
			setTimeout(function() {
				window.scrollTo(x, y);
			}, SCROLL_AGAIN_TIMEOUT);
		}, 0);
	}

	function onSelectionChange(e) {
		console.log('onSelectionChange()');
		clearTimeout(selectionTimer);
		selectionTimer = setTimeout(calculateSelection, SELECTION_TIMEOUT);

		if (canRemoveFauxSelection && fauxSelectionDivs.length > 0) {
			for (var i = 0; i < fauxSelectionDivs.length; i++) {
				document.body.removeChild(fauxSelectionDivs[i]);
			}
			fauxSelectionDivs = [];
		}
	}

	function domContentLoaded() {
		var hash = document.location.hash.substr(1);
		if (hash.startsWith(HASH_PREFIX)) {
			hash = hash.substr(HASH_PREFIX.length);
			try {
				recreateSelection(atob(hash));
			} catch (e) {
				console.warn('Failed to recreate selection: ', e);
			}
		}

		setTimeout(function() {
			if (typeof document.onselectionchange !== 'undefined') {
				document.addEventListener('selectionchange', onSelectionChange);
			} else {
				setInterval(calculateSelection, SELECTION_TIMEOUT);
			}
		}, 0);
	}

	if (!String.prototype.startsWith) {
		String.prototype.startsWith = function(s) {
			return this.indexOf(s) == 0;
		};
	}

	if (window.getSelection) {
		window.addEventListener('DOMContentLoaded', domContentLoaded);
	} else {
		console.warn('window.getSelection is not supported in this browser');
	}
})();
