var Beard = function() {
    "use strict";

    // some constants
    var META_START = ['{{', '__'],
        META_END = ['}}', '__'],
        BLOCKTAGS = ['Loop', 'If', 'Override',
                     'Size', 'Image', 'Logo', 'CSS', 'JS', 'Style', 'Variant',
                     'HTML', 'Colour', 'Boolean', 'Font', 'Choice'],
        TEXTONLYTAGS = ['Size', 'Image', 'Logo', 'CSS', 'JS',
                        'HTML', 'Colour', 'Boolean', 'Font', 'Choice'],
        SETTINGSTAGS = TEXTONLYTAGS.concat(['Style']),
        TEXTREQUIREDTAGS = ['Size', 'CSS', 'JS', 'Colour', 'Boolean', 'Font',
                            'Choice'],
        FILETYPETAGS = ['Image', 'Logo', 'CSS', 'JS'],
        CLOSETAGS = [], // see below
        TAGS = []; // see below

    for (var i in BLOCKTAGS) {
        CLOSETAGS.push('End'+BLOCKTAGS[i]);
    }
    TAGS = BLOCKTAGS.concat(CLOSETAGS).concat(['Else']);

    var stripmeta = function(s) {
        var from = META_START[0].length,
            length = s.length-(META_START[0].length+META_END[0].length);
        return s.substr(from, length).trim();
    };

    var labelToVariableName = function(label) {
        var first = label[0].toLowerCase(),
            rest = label.slice(1);

        rest = rest.replace(/\s+\w/g, function(str) {
            return str.replace(/\s+/, '').toUpperCase();
        });
        return first+rest;
    };

    var getText = function(token) {
        var text = '';
        for (var i in token.children) {
            var child = token.children[i];
            if (child.ttype === 'Text') {
                text += child.tvalue;
            }
        }
        return text.trim();
    };

    var splitSettingsToken = function(stripped) {
        var index = stripped.indexOf(' '),
            tagAndSubsets = stripped.slice(0, index),
            labelAndHelp = stripped.slice(index+1),
            subsets = [],
            tagSplit = tagAndSubsets.split(':'),
            tag = tagSplit[0],
            labelIndex = labelAndHelp.indexOf('|'),
            label = null,
            help = '';

        if (tagSplit.length > 1) {
            subsets = tagSplit[1].split('');
        }

        if (labelIndex !== -1) {
            label = labelAndHelp.slice(0, labelIndex).trim();
            help = labelAndHelp.slice(labelIndex+1).trim();
        } else {
            label = labelAndHelp;
        }

        return {
            tag: tag, // 'style', 'colour', etc.
            subsets: subsets, // ['b', 'f'], [], etc.
            label: label, // 'Background', 'Logo', etc.
            help: help // '320px wide recommended.' or whatever.
        };
    };

    // Token is a tag or some text plus metadata
    function Token(ttype, tvalue, offset, linenum, colnum) {
        // Text, Var, If, Loop, EndIf, EndLoop
        this.ttype = ttype;

        // values include the meta chars
        this.tvalue = tvalue;

        // lots of stuff so that it is easy to do error reporting later on
        this.offset = offset;
        this.linenum = linenum;
        this.colnum = colnum;

        // children only get filled in once we parse
        this.children = [];
        this.trueTokens = [];
        this.falseTokens = [];

        // these things only get filled in for relevant tokens once we parse

        // Everything that's not a Comment or Text:
        //stripped

        // Override:
        //snippetName

        // If, Var, Loop, Settings, Variant:
        //variableName

        // If:
        //not

        // Loop:
        //itemName

        // Var:
        //formatterName
        //formatter
        //parameters

        // Settings, Variant:
        //label
        //help

        // Style:
        //subsets
    }
    // split the bits between the meta characters
    Token.prototype.parseValue = function(getFormatter) {
        var ttype = this.ttype;
        if (['Comment', 'Text'].indexOf(ttype) !== -1) {
            // these tokens' values don't need parsing
            return;
        }

        var tvalue = this.tvalue,
            stripped = this.stripped = stripmeta(tvalue);

        if (SETTINGSTAGS.indexOf(ttype) !== -1) {
            // for setings, parse subsets (if style), label and help
            var parts = splitSettingsToken(stripped),
                subsets = parts.subsets,
                label = parts.label,
                help = parts.help;

            if (ttype === 'Style') {
                for (var i in subsets) {
                    if (['b', 'f'].indexOf(subsets[i]) === -1) {
                        throw {
                            name: 'InvalidSubsets',
                            message: "Only b(ackground) and f(oreground) "+
                                "style subsets are allowed.",
                            token: this
                        };
                    }
                }
                if (subsets.length === 0) {
                    subsets = ['b', 'f'];
                }

            } else {
                if (subsets.length) {
                    throw {
                        name: 'InvalidSubsets',
                        message: "Subsets are only for style settings.",
                        token: this
                    };
                }
            }

            this.subsets = subsets; // ['b', 'f'], [], etc.
            this.label = label; // 'Background', 'Logo', etc.
            this.help = help; // '320px wide recommended.' or whatever.
            this.variableName = labelToVariableName(label);
            this.isFile = FILETYPETAGS.indexOf(ttype) !== -1;
            return;

        } else if (ttype === 'Variant') {
            // TODO
            return;

        } else if (ttype === 'Var') {
            var vname = stripped,
                fname = '',
                parameters = '';

            if (vname.indexOf('|') !== -1) {
                // all this because split(something, 1) behaves... odd.
                var vparts = vname.split('|');
                vname = vparts[0];
                fname = vparts.slice(1).join('|');
                if (fname.indexOf(' ') !== -1) {
                    var fparts = fname.split(' ');
                    fname = fparts[0];
                    // Parameters is actually just a string that consists of
                    // everything that remains. The formatter will have to make
                    // sense of it itself.
                    parameters = fparts.slice(1).join(' ');
                }
            }
            if (fname) {
                var formatter;
                if (getFormatter) {
                    formatter = getFormatter(fname);
                }
                if (formatter) {
                    this.formatter = formatter;
                } else {
                    // getFormatter is null, or getFormatter returned nothing.
                    // Either way it is an error.
                    throw {
                        name: 'FormatterNotFound',
                        message: "Formatter '"+fname+"' not found.",
                        formatterName: fname,
                        token: this
                    };
                }
            } else {
                this.formatter = null;
            }

            this.variableName = vname;
            this.formatterName = fname || null;
            this.parameters = parameters || null;
            return;

        } else if (ttype === 'If') {
            var bits = stripped.substr(stripped.indexOf(' ')+1).split(' ');
            if (bits[0].toLowerCase() === 'not') {
                bits.shift();
                this.not = true;
            } else {
                this.not = false;
            }
            this.variableName = bits.shift();
            return;

        } else if (ttype === 'Loop') {
            var lbits = stripped.substr(stripped.indexOf(' ')+1).split(' ');
            this.variableName = lbits.shift();
            if (lbits.length === 2 && lbits[0].toLowerCase() === 'as') {
                this.itemName = lbits[1];
            } else {
                // hackish way to "drop the s".
                var lvname = this.variableName;
                if (lvname.indexOf('.') !== -1) {
                    lvname = lvname.slice(lvname.lastIndexOf('.')+1);
                }
                var single = lvname.substr(0, lvname.length-1);
                // drop 'all' from the front
                single = single.replace(/^all[A-Z]/, function(str) {
                    return str[3].toLowerCase();
                });
                this.itemName = single;
            }
            return;

        } else if (ttype === 'Override') {
            this.snippetName = stripped.substr(stripped.indexOf(' ')+1);
            return;
        }
    };
    // wrap context.get so that we can add the token to the error message
    Token.prototype.getVariable = function(context, defaultValue) {
        var variable;
        try {
            variable = context.get(this.variableName, defaultValue);
        } catch(e) {
            if (e.name === 'VariableNotFound') {
                throw {
                    name: e.name,
                    message: "'"+e.variableName+"' not found.",
                    variableName: e.variableName,
                    token: this // we're adding this because the context
                                // doesn't know which token caused it
                                // (a bit hackish, I know)
                };
            } else {
                throw e;
            }
        }
        return variable;
    };
    // Render a token. Only use this on tokens that form part of a parsed tree.
    // possible runtime errors: VariableNotFound and VariableNotIterable
    Token.prototype.render = function(context, renderSnippet) {
        // once-off lookups
        var ttype = this.ttype,
            tvalue = this.tvalue,
            snippetName = this.snippetName,
            variableName = this.variableName,
            formatterName = this.formatterName,
            formatter = this.formatter,
            parameters = this.parameters;

        if (ttype === "Comment") {
            return '';

        } else if (ttype === "Text") {
            return tvalue;

        } else if (ttype === "Var") {
            var variable = this.getVariable(context);
            if (formatter) {
                // apply the formatter function
                variable = formatter(variable, context, parameters);
            }
            if (variable === null) {
                variable = '';
            }
            return variable;

        } else if (ttype === "If") {
            var ivariable = this.getVariable(context, false),
                output = '',
                isTrue = (ivariable) ? true : false;

            if (isTrue && ivariable instanceof Array) {
                // make empty arrays "false-like"
                isTrue = (ivariable.length > 0);
            }

            if (this.not) {
                // {{if not blah}}
                isTrue = !isTrue;
            }

            if (isTrue) {
                for (var i in this.trueTokens) {
                    var child = this.trueTokens[i];
                    output += child.render(context);
                }
            } else {
                for (var i in this.falseTokens) {
                    var child = this.falseTokens[i];
                    output += child.render(context);
                }
            }
            return output;

        } else if (ttype === "Loop") {
            var lvariable = this.getVariable(context);
            if (lvariable.length === undefined) {
                throw {
                    name: "VariableNotIterable",
                    message: "'"+this.variableName+
                        "' does not look like an array.",
                    variableName: this.variableName,
                    token: this
                };
            }

            // Merge all properties of object 'b' into object 'a'.
            // 'b.property' overwrites 'a.property'
            // Taken from mustache.js
            // (by the way - the fact that hasOwnProperty even _exists_...)
            var merge = function(a, b) {
                var _new = {};
                for (var name in a) {
                    if (a.hasOwnProperty(name)) {
                        _new[name] = a[name];
                    }
                }
                for (var name in b) {
                    if (b.hasOwnProperty(name)) {
                        _new[name] = b[name];
                    }
                }
                return _new;
            };

            var loutput = '',
                items = lvariable;

            for (var i in items) {
                i = parseInt(i, 10); // gaah!
                var item = items[i],
                    odd = false,
                    even = false;

                if (i % 2 === 1) {
                    odd = true;
                } else {
                    even = true;
                }
                var d = {
                    odd: odd,
                    even: even,
                    counter0: i,
                    counter1: i-0+1,
                    first: (i===0),
                    last: (i===items.length-1),
                    multipleOf2: ((i+1)%2===0),
                    multipleOf2n: ((i+1)%2===1),
                    multipleOf3: ((i+1)%3===0),
                    multipleOf3n: ((i+1)%3===1),
                    multipleOf4: ((i+1)%4===0),
                    multipleOf4n: ((i+1)%4===1),
                    multipleOf5: ((i+1)%5===0),
                    multipleOf5n: ((i+1)%5===1),
                    multipleOf6: ((i+1)%6===0),
                    multipleOf6n: ((i+1)%6===1),
                    multipleOf7: ((i+1)%7===0),
                    multipleOf7n: ((i+1)%7===1),
                    multipleOf8: ((i+1)%8===0),
                    multipleOf8n: ((i+1)%8===1),
                    multipleOf9: ((i+1)%9===0),
                    multipleOf9n: ((i+1)%9===1),
                    multipleOf10: ((i+1)%10===0),
                    multipleOf10n: ((i+1)%10===1)
                };

                d[this.itemName] = item;

                context.push(d);
                for (var i in this.children) {
                    var child = this.children[i];
                    loutput += child.render(context);
                }
                context.pop();
            }
            return loutput;

        } else if (ttype === "Override") {
            var ooutput = '';
            if (renderSnippet) {
                for (var i in this.children) {
                    var child = this.children[i];
                    ooutput += child.render(context);
                }
            }
            return ooutput;
        }
        return ''; // by default tokens get skipped
    };
    // drill down the token tree and call callback with the token for every
    // token with a ttype in filter
    Token.prototype.traverse = function(callback, filter) {
        if (!filter || filter.indexOf(this.ttype) !== -1) {
            callback(this);
        }
        if (this.ttype === 'If') {
            // if and ifnot tags use trueTokens and falseTokens
            for (var i in this.trueTokens) {
                this.trueTokens[i].traverse(callback, filter);
            }
            for (var i in this.falseTokens) {
                this.falseTokens[i].traverse(callback, filter);
            }
        } else {
            for (var i in this.children) {
                this.children[i].traverse(callback, filter);
            }
        }
    };

    // descendvariable is used by Context to drill down into an
    // object hierarchy and return the correct variable/object/attribute
    var descendvariable = function(variable, names) {
        for (var i in names) {
            var name = names[i];
            if (variable[name] !== undefined) {
                variable = variable[name];
            } else {
                throw {
                    name: 'VariableNotFound',
                    message: "'"+name+"' not found.",
                    variableName: name
                };
            }
        }
        return variable;
    };

    // Context is really just a stack of data hashes
    // plus the available formatters
    function Context(template, obj, options) {
        this.template = template;
        this.stack = [];
        this.push(obj);
    }
    // stack push
    Context.prototype.push = function(obj) {
        this.stack.push(obj);
    };
    // stack pop
    Context.prototype.pop = function() {
        return this.stack.pop();
    };
    // not to be used directly. use get rather
    Context.prototype.getvariable = function(vname) {
        var index = this.stack.length - 1;
        while (index >= 0) {
            var obj = this.stack[index];
            if (obj[vname] !== undefined) {
                return obj[vname];
            }
            index -= 1;
        }

        throw {
            name: 'VariableNotFound',
            message: "'"+vname+"' not found.",
            variableName: vname
        };
    };
    // return the correct variable where name is something like path.to.variable
    Context.prototype.get = function(name, defaultValue) {
        var names = name.split('.'),
            first = names[0],
            therest = names.slice(1);

        try {
            var variable = this.getvariable(first);
            if (therest) {
                return descendvariable(variable, therest);
            } else {
                return variable;
            }
        } catch(e) {
            if (e.name === 'VariableNotFound' && defaultValue !== undefined) {
                return defaultValue;
            } else {
                throw e;
            }
        }
    };

    // Turn code into a flat list of Tokens.
    // Can also be useful for syntax hilighting.
    var tokenize = function(code) {
        /*
        COMMENT TOKENS
        {# comments #}
        OR OTHER NON-TEXT TOKENS
        {{no tabs or linebreaks, no semi-colons or underscores}}
        (otherwise tight reset css breaks)
        __no tabs or libebreaks, no semi-colons or underscores__
        Everything else is allowed between {{ and }} or __ and __ for the moment.
        __ style tokens get normalised to {{ style ones
        THE REST IS ALL TEXT TOKENS
        */

        // . never matches a newline. People often tell you to use [\s\S],
        // but I cannot get that to work. [^] is apparently another alternative
        // and it appears to work for me
        var expression = '({#[^]*?#})';
        for (var i=0; i<META_START.length; i++) {
            var START = META_START[i],//.replace(/\{/g, '{'),
                END = META_END[i];//.replace(/\}/g, '}');

            expression = expression+'|('+START+'[^\t\n;_]+?'+END+')';
        }

        // using the regex literal syntax appears to cache it or do something
        // very strange in some rare cases. (on V8, at least)
        var regex = new RegExp(expression, 'g'),
        // same as above, but the entire thing must match from start to finish
            matchExpression = '^'+expression+'$',

        // GAAH! Why doesn't Javascript have re.split() like Python?!
        // TODO: refactor into a regsplit function
            bits = [],
            lastIndex = 0;

        while (true) {
            var match = regex.exec(code);
            if (match === null) {
                break;
            }

            var bit = code.slice(lastIndex, match.index);
            if (bit.length) {
                bits.push(bit);
            }

            var bit = match[0];
            bits.push(bit);
            lastIndex = regex.lastIndex;
        }
        // Add the trailing literal
        var bit = code.slice(lastIndex);
        if (bit.length) {
            bits.push(bit);
        }

        var tokens = [],
            offset = 0,
            linenum = 0,
            colnum = 0;

        for (var i in bits) {
            var tvalue = bits[i],
                ttype, // gets determined below
                // this helps us see if this is a comment
                cstart = false,
                cend = false,
                // More strange behaviour. Looks like you have to compile a new
                // one every time you want to use it?
                matchRegex = new RegExp(matchExpression);

            if (tvalue.length >= 5) {
                if (tvalue[1] === '#') {
                    cstart = true;
                }
                if (tvalue[tvalue.length-2] === '#') {
                    cend = true;
                }
            }


            if (tvalue.length >= 5 && cstart && cend) {
                ttype = 'Comment';

            } else {
                // strip meta tags and spaces,
                // then normalise to the fist meta tags.
                var trimmedValue = tvalue;
                for (var i=0; i<META_START.length; i++) {
                    var sl = META_START[i].length,
                        el = META_END[i].length;
                    if (tvalue.slice(0, sl) === META_START[i]) {
                        if (tvalue.slice(-el) === META_END[i]) {
                            var from = META_START[i].length,
                                length = tvalue.length-
                                    (META_START[i].length+META_END[i].length),
                                stripped = tvalue.substr(from, length).trim();
                            trimmedValue = META_START[0]+stripped+META_END[0];
                            break;
                        }
                    }
                }

                if (trimmedValue === META_START[0]+'else'+META_END[0]) {
                    ttype = 'Else';

                } else if (matchRegex.exec(trimmedValue)) {
                    /*
                    TODO: this should be optimised to not use a regex match,
                    but the regex feels safest. Just because something starts
                    and ends with the meta characters doesn't mean it is non-text.
                    */

                    var found = false;
                    if (trimmedValue.indexOf(META_START[0]+'style:') === 0) {
                        // special-case {{style:b Background}}
                        found = true;
                        ttype = 'Style';

                    } else {
                        for (var i in BLOCKTAGS) {
                            var tagname = BLOCKTAGS[i],
                                lowered = tagname.toLowerCase(),
                                startswith = META_START[0]+lowered+' ',
                                endtag = META_START[0]+'/'+lowered+META_END[0];

                            if (trimmedValue.indexOf(startswith) === 0) {
                                found = true;
                                ttype = tagname;
                                break;
                            }
                            if (trimmedValue === endtag) {
                                found = true;
                                ttype = 'End'+tagname;
                                break;
                            }
                        }
                    }
                    if (!found) {
                        ttype = 'Var';
                    }

                } else {
                    ttype = 'Text';
                }
            }

            tokens.push(new Token(ttype, tvalue, offset, linenum, colnum));

            offset += tvalue.length;
            if (tvalue.indexOf('\n') !== -1) {
                linenum += tvalue.split('\n').length-1; // poor man's .count()
                colnum = tvalue.length - tvalue.lastIndexOf('\n') - 1;
            } else {
                colnum += tvalue.length;
            }
        }

        return tokens;
    };

    // Template contains the token tree(s)
    // and remembers when it was retrieved (parsed)
    function Template(code, options) {
        code = code.replace(/\r\n/g, '\n');
        this.retrieved = new Date();
        this.getFormatter = null;
        this.allowedSnippets = [];

        if (options) {
            if (options.getFormatter) {
                // should be a function
                this.getFormatter = options.getFormatter;
            }
            if (options.allowedSnippets) {
                // should be an array of strings
                this.allowedSnippets = options.allowedSnippets;
            }
        }

        var validateRequiredToken = function(setting) {
            var label = setting.stripped.split(' ').slice(1).join(' ');
            if (setting.children.length === 0) {
                throw {
                    name: 'MissingDefaultError',
                    message: label+' requires a default value.',
                    token: setting
                };
            }

            var valueToken = setting.children[0],
                value = valueToken.tvalue;

            if (setting.ttype === 'Size') {
                var rule = value,
                    size = rule.substr(0, rule.length-1) - 0,
                    orient = rule[rule.length-1],
                    orients = ['S', 'W', 'H', 'M'];
                if (!(size>0 && orients.indexOf(orient) !== -1)) {
                    throw {
                        name: 'InvalidSizeError',
                        message: label+' must be a positive integer followed '+
                                 'by S, W, H or M.',
                        token: valueToken
                    };
                }
            } else if (setting.ttype === 'Boolean') {
                if (value !== 'true' && value !== 'false') {
                    throw {
                        name: 'BooleanDefaultError',
                        message: label+' must default to either true or false.',
                        token: valueToken
                    };
                }
            } else if (setting.ttype === 'Colour') {
                var colourValid = true;
                if (value.length !== 4 && value.length !== 7) {
                    colourValid = false;
                }
                if (colourValid && value[0] !== '#') {
                    colourValid = false;
                }
                // TODO: check that each char after the # is a hex digit
                if (!colourValid) {
                    throw {
                        name: 'ColourDefaultError',
                        message: label+' default '+
                        ' must be in #xxx or #xxxxxx format.',
                        token: valueToken
                    };
                }
            }
        };

        // Take the tokens and turn them into nested Token branches as an Array.
        var parseTokens = function(tokens, getFormatter, allowedSnippets) {
            // TODO: This function is getting huge.
            // Perhaps some of it can be refactored into Token?
            var branches = [],
                snippetTags = [],
                blockstack = [],
                untiltype = null;

            var pushToken = function(token) {
                // if we have tokens on the stack, add this token to the one
                // on the top of the stack. otherwise, start a new branch
                if (blockstack.length) {
                    var children,
                        last = blockstack[blockstack.length-1];

                    if (last.ttype === 'If') {
                        // for If tags, use trueTokens or falseTokens
                        if (token.ttype === 'Else' || last.falseTokens.length) {
                            children = last.falseTokens;
                        } else {
                            children = last.trueTokens;
                        }
                    } else {
                        // for all other tags, use children
                        children = last.children;
                    }
                    children.push(token);
                } else {
                    branches.push(token);
                }
            };

            for (var i in tokens) {
                var token = tokens[i];

                // parse what goes on between the meta tags
                token.parseValue(getFormatter);

                var parent = null;
                if (blockstack.length) {
                    parent = blockstack[blockstack.length-1];
                }

                if (parent && TEXTONLYTAGS.indexOf(parent.ttype) !== -1) {
                    // make sure that only Text goes inside text-only tokens
                    if (CLOSETAGS.indexOf(token.ttype) === -1) {
                        if (token.ttype !== 'Text') {
                            throw {
                                name: 'InvalidNestedTag',
                                message: 'Only text can go inside '+
                                    parent.ttype+'. '+
                                    'Did you remember to close the tag?',
                                token: parent // token is the first broken tag
                            };
                        }
                    }
                } else if (parent && parent.ttype === 'Style') {
                    // make sure only Text or Variant tags go inside Style
                    if (CLOSETAGS.indexOf(token.ttype) === -1) {
                        if (['Text', 'Variant'].indexOf(token.ttype) === -1) {
                            throw {
                                name: 'InvalidNestedTag',
                                message: 'Only text or variant tags can go '+
                                    'inside '+parent.ttype+'. '+
                                    'Did you remember to close the tag?',
                                token: parent // token is the first broken tag
                            };
                        }
                    }
                } else if (token.ttype === 'Variant') {
                    if (!parent || parent.ttype !== 'Style') {
                        throw {
                            name: 'TemplateSyntaxError',
                            message: 'Variant tags may only go inside '+
                                     'Style tags.',
                            token: token
                        };
                    }
                }

                if (token.ttype === 'Comment') {
                    // ignore comments (they don't appear in the parse tree)
                    continue;

                } if (token.ttype === 'Text') {
                    pushToken(token);

                } else if (token.ttype === 'Var') {
                    pushToken(token);

                } else if (token.ttype === 'Else') {
                    var last;
                    if (blockstack.length) {
                        last = blockstack[blockstack.length-1];
                    }
                    if (!last || last.ttype !== 'If') {
                        throw {
                            name: 'TemplateSyntaxError',
                            message: 'Else tags may only go inside '+
                                     'If tags.',
                            token: token
                        };
                    }
                    pushToken(token);

                } else if (token.ttype.indexOf('End') === 0) {
                    // close block tag

                    if (CLOSETAGS.indexOf(token.ttype) === -1) {
                        // technically this can't happen right now, because
                        // tokenize will just return it as a variable token
                        throw {
                            name: 'TemplateSyntaxError',
                            message: 'Unknown tag '+token.ttype,
                            token: token
                        };
                    }

                    if (token.ttype === untiltype) {
                        var opentype = untiltype.slice(3);
                        if (TEXTREQUIREDTAGS.indexOf(opentype) !== -1) {
                            // this tag requires a text value
                            var setting = blockstack[blockstack.length-1];
                            validateRequiredToken(setting);
                        }

                        blockstack.pop();
                        if (blockstack.length) {
                            untiltype = 'End'+
                                blockstack[blockstack.length-1].ttype;
                        } else {
                            untiltype = null;
                        }
                    } else {
                        if (untiltype) {
                            throw {
                                name: 'TemplateSyntaxError',
                                message: 'Encountered '+token.ttype+', '+
                                         'but expected '+untiltype+'.',
                                token: token
                            };
                        } else {
                            throw {
                                name: 'TemplateSyntaxError',
                                message: 'Encountered '+token.ttype+', but '+
                                         "didn't expect an end tag.",
                                token: token
                            };
                        }
                    }

                    // HACK
                    pushToken(token);

                } else {
                    // open block tag

                    if (BLOCKTAGS.indexOf(token.ttype) === -1) {
                        throw {
                            name: 'TemplateSyntaxError',
                            message: 'Unknown tag '+token.ttype,
                            token: token
                        };
                    }

                    if (token.ttype === 'Override') {
                        // check if the stack already contains an override token
                        for (var t in blockstack) {
                            if (blockstack[t].ttype !== 'Override') {
                                continue;
                            }
                            throw {
                                name: 'NestedOverrideTags',
                                message: "Override tags may not be nested.",
                                token: token
                            };
                        }

                        var snippetName = token.snippetName;
                        // check that this is the first time the snippet name
                        // is defined
                        if (snippetTags[snippetName] !== undefined) {
                            throw {
                                name: 'DuplicateOverrideTags',
                                message: snippetName+' was already specified.',
                                token: token
                            };
                        }
                        snippetTags[snippetName] = token;

                        // check if the snippet name is known
                        if (allowedSnippets.indexOf(snippetName) === -1) {
                            throw {
                                name: 'UnknownOverrideTag',
                                message: snippetName+' is not a known snippet.',
                                token: token
                            };
                        }
                    }

                    pushToken(token);
                    blockstack.push(token);
                    untiltype = 'End'+token.ttype;
                }
            }

            if (untiltype) {
                // we still have an open block tag at the end of the code
                throw {
                    name: 'TemplateSyntaxError',
                    message: "Missing " + untiltype,
                    token: blockstack[blockstack.length-1]
                };
            }

            return {
                branches: branches,
                snippetTags: snippetTags
            };
        };

        var results = parseTokens(
            tokenize(code),
            this.getFormatter,
            this.allowedSnippets
        );
        this.branches = results.branches;
        this.snippetTags = results.snippetTags;
    }
    Template.prototype.render = function(data, extra) {
        if (!data) {
            data = {};
        }

        var context = (data.getvariable) ? data : new Context(this, data);

        if (extra) {
            context.push(extra);
        }

        var output = '';
        // render the entire template
        for (var i in this.branches) {
            var token = this.branches[i];
            output += token.render(context);
        }
        return output.trim();
    };
    Template.prototype.hasSnippet = function(snippetName) {
        if (this.allowedSnippets.indexOf(snippetName) === -1) {
            throw {
                name: "UnknownSnippet",
                message: snippetName+" is not a known snippet."
            };
        }
        return (this.snippetTags[snippetName] !== undefined);
    };
    Template.prototype.renderSnippet = function(data, snippetName, extra) {
        var context = (data.getvariable) ? data : new Context(this, data);
        if (extra) {
            context.push(extra);
        }

        // render a specific snippet block only
        if (this.allowedSnippets.indexOf(snippetName) === -1) {
            throw {
                name: "UnknownSnippet",
                message: snippetName+" is not a known snippet."
            };
        }
        if (this.snippetTags[snippetName] !== undefined) {
            // render the block
            return this.snippetTags[snippetName].render(context, true).trim();
        }
    };
    // the actual widgets are handled elsewhere - this just "parses" them
    Template.prototype.replaceWidgets = function(html, data, replaceFunc) {
        var context = (data.getvariable) ? data : new Context(this, data);
        html = html.replace(/<p>\s*(\[\[[^\]]+\]\])\s*<\/p>/g,
        function(str, m1) {
            return m1;
        });
        html = html.replace(/\[\[[^\]]+\]\]/g, function(str) {
            var words = str.substr(2, str.length-4).split(' '),
                name = words[0],
                parameters = words.slice(1),
                args = [],
                kwargs = {};

            for (var i in parameters) {
                var parameter = parameters[i],
                    index = parameter.indexOf('=');

                if (index === -1) {
                    args.push(parameter);
                } else {
                    var k = parameter.slice(0, index),
                        v = parameter.slice(index+1);
                    kwargs[k] = v;
                }
            }
            return replaceFunc(context, name, args, kwargs) || '';
        });
        return html;
    };
    Template.prototype.traverse = function(callback, filter) {
        for (var i in this.branches) {
            var token = this.branches[i];
            token.traverse(callback, filter);
        }
    };
    Template.prototype.extractSettings = function() {
        var settings = [];

        this.traverse(function(token) {
            var defaultText = getText(token),
                defaultValue = defaultText,
                options = [],
                variants = [];

            if (token.ttype === 'Boolean') {
                defaultValue = (defaultText.toLowerCase() === 'true');
            }
            if (token.ttype === 'Choice') {
                var bits = defaultText.split('|');
                for (var i=0; i<bits.length; i++) {
                    var optionLabel = bits[i].trim(),
                        optionVName = labelToVariableName(optionLabel);
                    options.push({
                        label: optionLabel,
                        value: optionVName
                    });
                }
                defaultValue = options[0].value;
            }
            if (token.ttype === 'Style') {
                for (var i in token.children) {
                    var child = token.children[i];
                    if (child.ttype === 'Variant') {
                        var tparts = splitSettingsToken(child.stripped);
                        variants.push({
                            label: tparts.label,
                            help: tparts.help,
                            variableName: labelToVariableName(tparts.label),
                            defaultValue: getText(child)
                        });
                    }
                }
                if (variants.length) {
                    defaultValue = null;
                }
            }

            var setting = {
                label: token.label,
                help: token.help,
                type: token.ttype,
                isFile: token.isFile, // why again?
                variableName: token.variableName
            };
            if (token.ttype === 'Choice') {
                setting.options = options;
            }
            if (token.ttype === 'Style') {
                setting.variants = variants;
                setting.subsets = token.subsets;

                if (!setting.variants.length) {
                    setting.defaultValue = defaultValue;
                }
            } else {
                setting.defaultValue = defaultValue;
            }
            settings.push(setting);

        }, SETTINGSTAGS);

        return settings;
    };
    Template.prototype.highlight = function() {
        var html = '<span class="Num">1</span>',
            lineNum = 1;

        var makeLines = function(text) {
            text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return text.replace(/\n/g, function(str) {
                lineNum += 1;
                return '\n<span class="Num">'+lineNum+'</span>';
            });
        };

        this.traverse(function(token) {
            var lines = makeLines(token.tvalue);
            if (TAGS.indexOf(token.ttype) !== -1) {
                var classes = ['Block', token.ttype].join(' ');
                html += '<span class="'+classes+'">'+lines+'</span>';

            } else if (token.ttype === 'Var') {
                html += '<span class="Var">'+lines+'</span>';

            } else if (token.ttype === 'Comment') {
                html += '<span class="Comment">'+lines+'</span>';

            } else {
                html += '<span class="Text">'+lines+'</span>';
            }
        });
        return html;
    };

    return {
        Token: Token,
        tokenize: tokenize,
        Template: Template,
        Context: Context
    };
}();

// commonjs so we can use this in node.js
try {
    for (var k in Beard) {
        if (Beard.hasOwnProperty(k)) {
            exports[k] = Beard[k];
        }
    }
} catch(e) {
    // otherwise you can just use Beard.* from above
    // (after including this file)
}
