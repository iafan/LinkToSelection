### About LinkToSelection


Sometimes you want to share a link that points to a specific text on a page, or an image.
This script, when plugged into a page, will do just that.

Upon selecting something on a page, you will see <code>#sel:xxxxxxxxxxxx</code> hash
added to the page URL. Send the resulting link to someone else, and they will open the
page with the same selection restored and scrolled into view.

### Best Use Cases

__Documentation__: enabling selection sharing this on your documentation website will allow you to point others to specific phrases or words.

__Reporting errors__: your users can send you links to typos or other kinds of errors that they find on your website pages.

### Demo

Try any of these links that point to a specific selected content on [serge.io](https://serge.io/) website:

  * [Link to a phrase](https://serge.io/#sel:ZGl2L2Rpdi4yL2Rpdi4zL2Rpdi9wLjEvQDoxMDctKjoxNjQ)
  * [Link to a section](https://serge.io/docs/dev/callbacks/#sel:I2JlZm9yZV91cGRhdGVfZGF0YWJhc2VfZnJvbV9zb3VyY2VfZmlsZXMvYS1kaXYvZGl2LjIvZGl2L2Rpdi4xL3AuNy9ALjE6MTIw)
  * [Link to an image](https://serge.io/docs/localization-cycle/#sel:ZGl2L2Rpdi4yL2Rpdi9kaXYuMS9wLjItKjox)

### Usage

Just put the `LinkToSelection.min.js` file to an appropriate folder of your website, e.g. `/static/js/vendor/` and add the following script to the bottom of your web pages (before the closing `</body>` tag):

```html
<script src="/static/js/vendor/LinkToSelection.min.js"></script>
```

### Browser compatibility

LinkToSelection was tested in:

  * Desktop:
    * Chrome 48+
    * Firefox 44+
    * Edge 25+
    * Internet Explorer 11
  * iOS:
    * Safari
    * Chrome
  * Android:
    * Chrome
    * Firefox

### Caveats

By their nature, links with encoded selection may not work if the other person who opens such a link sees a page with the different structure. This means that this script will work best on mostly static pages which are not password-protected and are not built on the fly from XHR requests.

The script *may* conflict with other scripts that use `document.onselectionchange` event handler or URL hash for their own purposes.