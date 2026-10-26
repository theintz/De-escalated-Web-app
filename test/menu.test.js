const test = require('node:test');
const assert = require('node:assert/strict');
const Menu = require('../js/menu.js');

const random = () => Array.from({ length: Menu.ITEM_COUNT }, () => Math.floor(Math.random() * 5));

test('form has all 78 items', () => {
  assert.equal(Menu.ITEM_COUNT, 78);
});

test('encode/decode round-trips', () => {
  for (let i = 0; i < 200; i++) {
    const answers = random();
    assert.deepEqual(Menu.decode(Menu.encode(answers)), answers);
  }
  const extremes = [Array(78).fill(0), Array(78).fill(4)];
  for (const a of extremes) assert.deepEqual(Menu.decode(Menu.encode(a)), a);
});

test('decode accepts formatted, lowercase and look-alike characters', () => {
  const answers = random();
  const code = Menu.encode(answers);
  assert.deepEqual(Menu.decode(Menu.format(code).toLowerCase()), answers);
  assert.deepEqual(Menu.decode(` ${code.replace(/0/g, 'O').replace(/1/g, 'l')} `), answers);
});

test('decode rejects typos and bad input', () => {
  const code = Menu.encode(random());
  const i = 5;
  const swapped = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
  assert.throws(() => Menu.decode(swapped), /typo/);
  assert.throws(() => Menu.decode(code.slice(0, -2)), /length/);
  assert.throws(() => Menu.decode(''), /enter a code/);
  assert.throws(() => Menu.decode('9' + code.slice(1)), /version/);
  assert.throws(() => Menu.decode(code.slice(0, 3) + 'U' + code.slice(4)), /not a valid character/);
});

test('tiers', () => {
  const { NONE, MUST, LIKE, MAYBE, OFF, tier } = Menu;
  assert.equal(tier(MUST, MUST), 'match');
  assert.equal(tier(OFF, OFF), 'match');
  assert.equal(tier(MUST, LIKE), 'close');
  assert.equal(tier(LIKE, MUST), 'close');
  assert.equal(tier(MAYBE, OFF), 'discuss');
  assert.equal(tier(MUST, MAYBE), 'discuss');
  assert.equal(tier(MUST, OFF), 'conflict');
  assert.equal(tier(OFF, LIKE), 'conflict');
  assert.equal(tier(NONE, MUST), 'unanswered');
});

test('compare counts every item once', () => {
  const { counts, categories } = Menu.compare(random(), random());
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 78);
  assert.equal(categories.length, 8);
});
