const path = require('path');
const postcss = require('postcss');

const plugin = require('..');

async function run() {
  const stylePaths = path.join(__dirname, 'fixtures');
  const result = await postcss([
    plugin({
      stylePaths,
      outputDir: stylePaths
     })
  ]).process('', {
    from: undefined
  });
  expect(result.css).toMatchSnapshot();
  expect(result.warnings()).toHaveLength(0);
}

describe('split common rules', () => {
  it('do nothing', async () => {
    await run();
  });
});
