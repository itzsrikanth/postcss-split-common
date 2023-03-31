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
  minimumOccurance = 2,
  outputDir = __dirname,
  outputFileName = 'common.css'
}) => {
  return (commonRoot) => {
    const commonMap = new Map(),
     commonFile = path.join(outputDir, outputFileName);

    function addToMap(rule, hash) {
      if (commonMap[hash]) {
        commonMap[hash] += 1;
        if (commonMap[hash] === minimumOccurance) {
          let atRuleCloned;
          switch (rule.parent.type) {
            case 'root':
              commonRoot.append(rule.clone());
              break;
            case 'atrule':
                rule.shouldMove = true;
                if (!rule.parent.hasCommonRule) {
                  rule.parent.hasCommonRule = true;
                  /* when a rule is inside at-rule, it is cloned and children nodes are emptied
                   * and added to the root. All the future rules with same parent will be added
                   * to this */
                  atRuleCloned = rule.parent.clone();
                  atRuleCloned.nodes = [];
                  commonRoot.append(atRuleCloned);
                }
                break;
          }
        }
      } else {
        commonMap[hash] = 1;
      }
    }

    // eslint-disable-next-line no-unused-vars
    const rootList = getCssContent({
      stylePaths,
      globPatterns
    }).map(cssContent => {
      const parsedContent = postcss.parse(cssContent);
      parsedContent.walkAtRules(atRule => {
        addToMap(atRule, `${atRule.name}@${atRule.params.replace(/\s+/g, '_')}#`);
      });
      parsedContent.walkDecls(decl => {
        // ToDo: parse value to minify to a standard hash value, or use after `cssnano`
        decl.hash = `${decl.prop}:${decl.value};`;
      });
      parsedContent.walkRules(rule => {
        if (!(rule.parent.name && rule.parent.name.includes('keyframes'))) {
          // ToDo: sort by property before reduce
          addToMap(rule, `${rule.selector}{${rule.nodes.reduce((acc, node) => acc + node.hash, '')}}`);
        }
      });
      parsedContent.walkAtRules(atRule => {
        if (atRule.parent.type === 'root' && atRule.hasCommonRule) {
          const atRuleAtRoot = commonRoot.nodes.find(node => node.hash === atRule.hash);
          atRuleAtRoot.nodes = atRule.nodes.filter(node => node.shouldMove);
        }
      });
      return parsedContent;
    });
    fs.writeFileSync(commonFile, commonRoot.toString(), 'utf-8');
    commonRoot.toResult();
  }
}

module.exports.postcss = true
