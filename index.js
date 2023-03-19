/**
 * @type {import('postcss').PluginCreator}
 */

const fs = require('fs');
const path = require('path');
const walkSync = require('walk-sync');
const postcss = require('postcss');

/**
 * ToDo: one of the `cssnano` optimizations combines the at-rule declarations which will
 * further help to reduce confusions in this plugin. Test for presence of same `@` declaration
 * within same CSS file.
 */

function getCssContent({ stylePaths, globPatterns }) {
  if (typeof stylePaths === 'string') {
    stylePaths = [stylePaths];
  }
  return stylePaths.reduce((acc, stylePath) => {
    acc = acc.concat(
      walkSync(stylePath, {
        globs: globPatterns,
        directories: false
      }).map(cssPath =>
        fs.readFileSync(
          path.join(stylePath, cssPath), 'utf-8'
        )
      )
    );
    return acc;
  }, []);
}


module.exports = ({
  stylePaths,
  globPatterns = ['**/*.css'],
  minimumOccurance = 2
}) => {
  return () => {
    const commonMap = new Map();
    const commonRoot = postcss.root();

    function addToMap(hash) {
      if (commonMap[hash]) {
        commonMap[hash] += 1;
        if (commonMap[hash] === minimumOccurance) {
          switch (rule.parent.type) {
            case 'root':
              commonRoot.append(rule);
              break;
            case 'atrule':
                rule.shouldMove = true;
                rule.parent.hasCommonRule = true;
                break;
          }
        }
      } else {
        commonMap[hash] = 1;
      }
    }

    const rootList = getCssContent({
      stylePaths,
      globPatterns
    }).map(cssContent => {
      const parsedContent = postcss.parse(cssContent);
      parsedContent.walkAtRules(atRule => {
        addToMap(`${atRule.name}@${atRule.params.replace(/\s+/g, '_')}#`);
      });
      parsedContent.walkDecls(decl => {
        // ToDo: parse value to minify to a standard hash value, or use after `cssnano`
        decl.hash = `${decl.prop}:${decl.value};`;
      });
      parsedContent.walkRules(rule => {
        if (!rule.parent.name?.includes('keyframes')) {
          // ToDo: sort by property before reduce
          addToMap(`${rule.selector}{${rule.nodes.reduce((acc, node) => acc + node.hash, '')}}`);
        }
      });
      parsedContent.walkAtRules(atRule => {
        if (atRule.parent.type === 'root' && atRule.hasCommonRule) {
          const clonedAtRule = atRule.clone();
          clonedAtRule.nodes = atRule.nodes.filter(node => node.shouldMove);
          commonRoot.append(clonedAtRule);
        }
      });
      return parsedContent;
    });
    console.log(commonRoot.toString());
  }
}

module.exports.postcss = true
