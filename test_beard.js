var sys = require('sys'),
    fs = require('fs'),
    Template = require('./beard').Template;


// comment tag

exports.testOneLineComment = function(test) {
    test.expect(1);
    var code = '{# This is a one line comment. #}';
    var template = new Template(code);
    test.equals(template.render(), '');
    test.done();
};

exports.testMultiLineComment = function(test) {
    test.expect(1);
    var code = '{#\n'+
        'This is a comment\n'+
        'that has a # in it\n'+
        'as well as a } and a }}.\n'+
        '#}';
    var template = new Template(code);
    test.equals(template.render(), '');
    test.done();
};

// variable tag

exports.testSemicolonInVariable = function(test) {
    test.expect(1);
    var code = '{{hello;there}}',
        template = new Template(code);
    test.equals(template.render(), code);
    test.done();
};

exports.testPlainVariable = function(test) {
    test.expect(1);
    var code ='{{knownVariable}}';
    var template = new Template(code);
    test.equals(template.render({knownVariable: 'hello'}), 'hello');
    test.done();
};

exports.testMultipleVariables = function(test) {
    test.expect(1);
    var code ='{{a}}{{b}}';
    var template = new Template(code);
    test.equals(template.render({a: 'a'}, {b: 'b'}), 'ab');
    test.done();
};

exports.testUnknownVariable = function(test) {
    test.expect(1);
    var code = '{{unknownVariable}}';
    var template = new Template(code);
    // must throw VariablenotFound
    try {
        template.render({});
    } catch(e) {
        test.equals(e.name, 'VariableNotFound');
    }
    test.done();
};

exports.testVariableWithKnownFormatter = function(test) {
    test.expect(1);
    var code = '{{variable|knownFormatter}}';
    var template = new Template(code, {
        getFormatter: function(name) {
            if (name == 'knownFormatter') {
                return function(variable, context, parameters) {
                    // just put quotes around the variable as a test
                    var output = '"'+variable+'"';
                    return output
                }
            }
        }
    });
    test.equals(template.render({variable: 'Hello'}), '"Hello"');
    test.done();
};

exports.testVariableWithUnknownFormatter = function(test) {
    test.expect(1);
    var code = '{{variable|unknownFormatter}}';
    // must throw FormatternotFound
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'FormatterNotFound');
    }
    test.done();
};

// if tag

exports.testPlainIf = function(test) {
    test.expect(3);
    var code = '{{if a}}Hello{{/if}}';
    var template = new Template(code);
    test.equals(template.render({a: true}), 'Hello');
    test.equals(template.render({a: false}), '');
    test.equals(template.render({}), '');
    test.done();
};

exports.testIfElse = function(test) {
    test.expect(3);
    var code = '{{if a}}A{{else}}Not A{{/if}}';
    var template = new Template(code);
    test.equals(template.render({a: true}), 'A');
    test.equals(template.render({a: false}), 'Not A');
    test.equals(template.render({}), 'Not A');
    test.done();
};

exports.testIfMissingEnd = function(test) {
    test.expect(1);
    var code = '{{if a}}';
    // must throw TemplateSyntaxError
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'TemplateSyntaxError');
    }
    test.done();
};

// ifnot tag

exports.testPlainIfNot = function(test) {
    test.expect(3);
    var code = '{{if not a}}Hello{{/if}}';
    var template = new Template(code);
    test.equals(template.render({a: false}), 'Hello');
    test.equals(template.render({a: true}), '');
    test.equals(template.render({}), 'Hello');
    test.done();
};

exports.testIfNotElse = function(test) {
    test.expect(3);
    var code = '{{if not a}}Not A{{else}}A{{/if}}';
    var template = new Template(code);
    test.equals(template.render({a: true}), 'A');
    test.equals(template.render({a: false}), 'Not A');
    test.equals(template.render({}), 'Not A');
    test.done();
};

exports.testIfNotMissingEnd = function(test) {
    test.expect(1);
    var code = '{{if not a}}';
    // must throw TemplateSyntaxError
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'TemplateSyntaxError');
    }
    test.done();
};

// loop tag

exports.testLoopWithoutItem = function(test) {
    test.expect(2);
    var code = '{{loop items}}\n'+
               '{{counter0}}.{{counter1}}.{{if first}}First{{/if}}{{if last}}Last{{/if}}.'+
               '{{if odd}}Odd{{/if}}{{if even}}Even{{/if}}.{{item.name}}\n'+
               '{{/loop}}';
    var template = new Template(code);
    var output = template.render({
        items: [
            {name: 'John'},
            {name: 'Paul'},
            {name: 'George'},
            {name: 'Ringo'}
        ]
    });
    // check that we're actually looping
    // also check First, Last, Even, Odd, Counter0, Counter1
    var firstFound = (output.indexOf('0.1.First.Even.John') != -1);
    var lastFound = (output.indexOf('3.4.Last.Odd.Ringo') != -1);
    test.ok(firstFound);
    test.ok(lastFound);
    test.done();
};

exports.testLoopWithItem = function(test) {
    test.expect(2);
    var code = '{{loop items as banana}}\n'+
               '{{counter0}}.{{counter1}}.{{if first}}First{{/if}}{{if last}}Last{{/if}}.'+
               '{{if odd}}Odd{{/if}}{{if even}}Even{{/if}}.{{banana.name}}\n'+
               '{{/loop}}';
    var template = new Template(code);
    var output = template.render({
        items: [
            {name: 'John'},
            {name: 'Paul'},
            {name: 'George'},
            {name: 'Ringo'}
        ]
    });
    // check that we're actually looping
    // also check First, Last, Even, Odd, Counter0, Counter1
    var firstFound = (output.indexOf('0.1.First.Even.John') != -1);
    var lastFound = (output.indexOf('3.4.Last.Odd.Ringo') != -1);
    test.ok(firstFound);
    test.ok(lastFound);
    test.done();
};

exports.testLoopNonIterable = function(test) {
    test.expect(1);
    var code = '{{loop items}}{{/loop}}';
    var template = new Template(code);
    try {
        template.render({items: 1});
    } catch(e) {
        test.equals(e.name, 'VariableNotIterable');
    }
    test.done();
};

exports.testLoopMissingEnd = function(test) {
    test.expect(1);
    var code = '{{loop items}}';
    // must throw TemplateSyntaxError
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'TemplateSyntaxError');
    }
    test.done();
};


// Override tag

exports.testUnknownSnippet = function(test) {
    test.expect(1);
    var code = '{{override unknown}}{{/override}}';
    // must throw UnknownOverrideTag
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'UnknownOverrideTag');
    }
    test.done();
};

exports.testIgnoreOverride = function(test) {
    test.expect(1);
    var code = '{{override SingleProduct}}Hello{{/override}}';
    var template = new Template(code, {
        allowedSnippets: ['SingleProduct']
    });
    test.equals(template.render({}), '');
    test.done();
};

exports.testRenderOverrideOnly = function(test) {
    test.expect(1);
    var code = 'This will not render\n'+
               '{{override SingleProduct}}Hello{{/override}}\n'+
               'This won\'t render either.';
    var template = new Template(code, {
        allowedSnippets: ['SingleProduct']
    });
    test.equals(template.renderSnippet({}, 'SingleProduct'), 'Hello');
    test.done();
};

exports.testRenderUnknownSnippet = function(test) {
    test.expect(1);
    var code = '';
    var template = new Template(code);
    try {
        template.renderSnippet({}, 'SingleProduct');
    } catch(e) {
        test.equals(e.name, 'UnknownSnippet')
    }
    test.done();
};

exports.testMultipleSameSnippet = function(test) {
    test.expect(1);
    var code = '{{override SingleProduct}}{{/override}}\n'+
               '{{override SingleProduct}}{{/override}}\n';
    try {
        var template = new Template(code, {
           allowedSnippets: ['SingleProduct']
        });
    } catch(e) {
        test.equals(e.name, 'DuplicateOverrideTags');
    }
    test.done();
};

exports.testNestedOverrideTags = function(test) {
    test.expect(1);
    var code = '{{override SingleProduct}}\n'+
               '{{override Products}}{{/override}}\n'+
               '{{/override}}';
    try {
        var template = new Template(code, {
           allowedSnippets: ['SingleProduct', 'Products']
        });
    } catch(e) {
        test.equals(e.name, 'NestedOverrideTags');
    }
    test.done();
};

// Settings tags

exports.testSettingsWithInvalidSubtags = function(test) {
    test.expect(1);
    var code = "{{colour Background}}{{if something}}Err!{{/if}}{{/colour}}";
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'InvalidNestedTag');
    }
    test.done();
};

exports.testStyleWithInvalidSubtags = function(test) {
    test.expect(1);
    var code = "{{style Logo}}{{if something}}Err!{{/if}}{{/style}}";
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'InvalidNestedTag');
    }
    test.done();
};

exports.testStyleWithoutSubsets = function(test) {
    test.expect(4);
    var code = "{{style Logo}}{{/style}}";
    var template = new Template(code),
        settings = template.extractSettings();

    test.equals(settings.length, 1);
    var style = settings[0];
    test.equals(style.subsets.length, 2);
    test.equals(style.subsets[0], "b");
    test.equals(style.subsets[1], "f");

    test.done();
};

exports.testStyleWithValidSubsets = function(test) {
    test.expect(3);
    var code = "{{style:b Background}}{{/style}}";
    var template = new Template(code),
        settings = template.extractSettings();

    test.equals(settings.length, 1);
    var style = settings[0];
    test.equals(style.subsets.length, 1);
    test.equals(style.subsets[0], "b");

    test.done();
};

exports.testStyleWithInvalidSubsets = function(test) {
    test.expect(1);
    var code = "{{style:rawr Invalid}}{{/style}}";
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'InvalidSubsets');
    }
    test.done();
};

exports.testTopLevelVariants = function(test) {
    test.expect(1);
    var code = "{{variant Something}}";
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, "TemplateSyntaxError");
    }
    test.done();
};

exports.testNonStyleWithVariants = function(test) {
    test.expect(1);
    var code = "{{if someVar}}{{variant Normal}}Err!{{/variant}}{{/if}}";
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'TemplateSyntaxError');
    }
    test.done();
};

exports.testStyleWithVariants = function(test) {
    test.expect(19);
    var code = "{{style:bf Nav | Global, utility and in-page.}}\n"+
               "{{variant Normal | The default.}}color: #aaa;{{/variant}}\n"+
               "{{variant Hover}}color: #333;{{/variant}}\n"+
               "{{variant Selected}}color: #000;{{/variant}}\n"+
               "{{/style}}";

    /*
    console.log("about to parse the template!");
    try {
        var template = new Template(code);
        console.log("successfully parsed the template!");
    } catch(e) {
        console.log("template parse error!");
        console.log(e);
    }
    */

    var template = new Template(code),
        settings = template.extractSettings();

    test.equals(settings.length, 1);

    var style = settings[0];

    test.equals(style.label, "Nav");
    test.equals(style.help, "Global, utility and in-page.");
    test.equals(style.type, "Style");
    test.equals(style.isFile, false);
    test.equals(style.variableName, "nav");
    test.equals(style.defaultValue, undefined);
    test.equals(style.options, undefined);
    test.equals(style.variants.length, 3);
    test.equals(style.subsets.length, 2);
    test.equals(style.subsets[0], 'b');
    test.equals(style.subsets[1], 'f');

    var v1 = style.variants[0],
        v2 = style.variants[1],
        v3 = style.variants[2];

    test.equals(v1.label, "Normal");
    test.equals(v1.variableName, "normal");
    test.equals(v1.help, "The default.");
    test.equals(v1.defaultValue, "color: #aaa;");

    test.equals(v2.label, "Hover");
    test.equals(v2.help, "");

    test.equals(v3.label, "Selected");

    test.done();
};

exports.testChoiceSettings = function(test) {
    test.expect(7);
    var code = "{{choice Sidebar Position}}Left|Right{{/choice}}",
        template = new Template(code),
        settings = template.extractSettings();

    test.equals(settings.length, 1);
    var choice = settings[0];
    test.equals(choice.defaultValue, "left");
    test.equals(choice.options.length, 2);
    test.equals(choice.options[0].label, "Left");
    test.equals(choice.options[0].value, "left");
    test.equals(choice.options[1].label, "Right");
    test.equals(choice.options[1].value, "right");

    test.done();
};

exports.testMutipleSettingsWithSameName = function(test) {
    // multiple sizes with the same name
    test.expect(1);
    var code = "{{size Small}}100W{{/size}}{{size Small}}200W{{/size}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "DuplicateNameError");
    }
    test.done();
};
/*
exports.testMutipleSizesWithSameValue = function(test) {
    test.expect(1);
    var code = "{{size Small}}100W{{/size}}{{size Medium}}100W{{/size}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "DuplicateSizeError");
    }
    test.done();
};
*/
exports.testImageAndLogoWithSameName = function(test) {
    // image and logo with the same name
    test.expect(1);
    var code = "{{logo Logo}}{{/logo}}{{image Logo}}{{/image}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "DuplicateNameError");
    }
    test.done();
};

exports.testFontSizeWithWrongUnit = function(test) {
    // FontSize with wrong unit
    test.expect(1);
    var code = "{{fontsize Text}}2em{{/fontsize}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "FontSizeDefaultError");
    }
    test.done();
};
exports.testFontSizeOutOfRange = function(test) {
    // FontSize that's too small or too big
    test.expect(1);
    var code = "{{fontsize Text}}5px{{/fontsize}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "FontSizeDefaultError");
    }
    test.done();
};
exports.testFloatPixelFontSize = function(test) {
    // pixel FontSize that's not an integer
    test.expect(1);
    var code = "{{fontsize Text}}12.5px{{/fontsize}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "FontSizeDefaultError");
    }
    test.done();
};
exports.testSizeRuleMissingOrientation = function(test) {
    // image size that doesn't end with a valid character
    test.expect(1);
    var code = "{{size Small}}100{{/size}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "InvalidSizeError");
    }
    test.done();
};
exports.testSizeRuleTooSmall = function(test) {
    // image size of zero
    test.expect(1);
    var code = "{{size Very Small}}0{{/size}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "InvalidSizeError");
    }
    test.done();
};
exports.testColourWithoutHash = function(test) {
    // colour without #
    test.expect(1);
    var code = "{{colour Something Black}}000000{{/colour}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "ColourDefaultError");
    }
    test.done();
};
exports.testColourNotValid = function(test) {
    // colour that's not 3 or 6 hex digits
    test.expect(1);
    var code = "{{colour Something Wrong}}#ff{{/colour}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "ColourDefaultError");
    }
    test.done();
};
exports.testInvalidBoolean = function(test) {
    // boolean that's not true or false
    test.expect(1);
    var code = "{{boolean Will this work?}}No{{/boolean}}",
        template;
    try {
        template = new Template(code);
    } catch(e) {
        test.equals(e.name, "BooleanDefaultError");
    }
    test.done();
};

// other tests

exports.testAlternativeStyleTags = function(test) {
    test.expect(1);
    var code = "__object.property__",
        template = new Template(code),
        output = template.render({
            object: {
                property: "hello"
            }
        });
    test.equals(output, "hello");
    test.done();
};

exports.testSpaciousTags = function(test) {
    test.expect(3);
    var code = '{{ if a }}A{{ else }}Not A{{ /if }}';
    var template = new Template(code);
    test.equals(template.render({a: true}), 'A');
    test.equals(template.render({a: false}), 'Not A');
    test.equals(template.render({}), 'Not A');
    test.done();
};

exports.testUnbalancedTags = function(test) {
    test.expect(1);
    var code = '{{if a}}{{loop b}}{{/if}}{{/loop}}';
    try {
        var template = new Template(code);
    } catch(e) {
        test.equals(e.name, 'TemplateSyntaxError');
    }
    test.done();
};

exports.testBlockTagsAsVariables = function(test) {
    test.expect(1);
    var tags = ['Loop', 'If', 'Override', 'Size', 'Image', 'Logo', 'CSS',
                'JS', 'Style', 'Variant', 'HTML', 'Colour', 'Boolean',
                'Font', 'Choice'],
        code = "",
        expected = "",
        context = {};

    for (var i in tags) {
        var varname = tags[i].toLowerCase();
        code = code + '{{' + varname + '}}';
        expected = expected + varname;
        context[varname] = varname;
    }

    var template = new Template(code),
        output = template.render(context);
    test.equals(output, expected);
    test.done();
};

// TODO: test these:
// hasSnippet
// replaceWidgets
// highlight
