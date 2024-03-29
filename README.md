Beard is a template setting and widget aware templating engine.

Still working on some documentation, but see the tests for some usage examples
in the meantime. It was built for Ammo, so you might get a better sense of the
bigger picture by reading the templating documentation there:
<http://get.someammo.com/themes/documentation>


What? Why?
==========

The basic goal of the templating engine is to enable simple one-file themes.
In that sense it goes some way towards being a theme engine, but it requires
support in a content management system for all of that to work seamlessly.


Snippets and Widgets
--------------------

In order to cut down on the amount of template code required a system can
specify widgets that have default system-wide snippets. These snippets can
optionally be overridden in the template. The snippets can work as the "inner"
parts of a template - sortof the reverse from Django/Jinja's blocks system - or
they can be rendered in response to [[Widget]] placeholders in a second pass.
That has the intended side-effect of making all "views" double as "widgets"
that can be placed anywhere.


Template settings
-----------------

Template settings get specified inside the template - probably at the top of
the file. Current supported setting types are:

* Boolean
* Colour
* Font (deprecated in favour of Style)
* Style - a curated set of CSS attributes
    - Style tags can specify CSS attribute subsets - background and foreground
      only for now.
    - Style tags can also have Variant tags. Variants can be anything like
      "Normal", "Hover", "Visited", "Selected", "Disabled", etc.
* HTML - arbitrary once-off content manageable HTML
* Image or Logo - they work the same. The distinction is just so that a
    content management system's interface can present them separately.

These settings can then be extracted by a content management system and used to
build theme customisation forms. Settings have default values and with some
hand-holding by the content management system they become variables that can be
used in the template.


JS and CSS dependencies
-----------------------

External dependencies like CSS and JS files are handled as if they are special
settings. This helps to abstract the URLs to these assets so that things work
in a local theme builder tool as well as on a live server where .js and .css
files might end up in a web root directory, on a CDN, etc. Themes could even
be treated as data (and less like code) and end up in a database along with
the accompanying "static" files.


Thumbnails and previews
-----------------------

Apart from that a theme can also specify the desired thumbnail/preview sizes.
Themes are often designed around specific grid/column dimensions, so this
allows a theme designer to specify the thumbnail sizes as metadata inside the
template and then the content management system can use that to make sure the
correct thumbnails are created.
