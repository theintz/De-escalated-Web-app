const test = require('node:test');
const assert = require('node:assert/strict');
const Menu = require('../js/menu.js');

const random = () => Array.from({ length: Menu.ITEM_COUNT }, () => Math.floor(Math.random() * 5));

test('form has the 78 original items plus 1 added later', () => {
  assert.equal(Menu.ITEM_COUNT, 79);
});

test('codes from before an item was added still decode', () => {
  // Generated with the 78-item menu: answers[i] = (i * 3 + 1) % 5.
  const old = Array.from({ length: 78 }, (_, i) => (i * 3 + 1) % 5);
  const expected = old.concat([Menu.NONE]);
  assert.deepEqual(Menu.decode('117JS4B0KXQ43S9D927NX771JVRRWGNHE9VYDSH').answers, expected);
  const withCustom = Menu.decode('117JS4B0KXQ43S9D927NX771JVRRWGNHE9VYDSH.NjJPbGQgY3VzdG9tW');
  assert.deepEqual(withCustom.answers, expected);
  assert.deepEqual(withCustom.custom, [{ category: 6, text: 'Old custom', rating: Menu.LIKE }]);
  // The new item is shown under Financial Management but stored in the last slot.
  const finance = Menu.CATEGORIES.find((c) => c.title === 'Financial Management');
  assert.equal(finance.items.at(-1).slot, 78);
  assert.equal(Menu.CATEGORIES.at(-1).items[0].slot, 72);
});

test('encode/decode round-trips', () => {
  for (let i = 0; i < 200; i++) {
    const answers = random();
    assert.deepEqual(Menu.decode(Menu.encode(answers)), { answers, custom: [] });
  }
  const extremes = [Array(Menu.ITEM_COUNT).fill(0), Array(Menu.ITEM_COUNT).fill(4)];
  for (const a of extremes) assert.deepEqual(Menu.decode(Menu.encode(a)).answers, a);
});

test('decode accepts formatted, lowercase and look-alike characters', () => {
  const answers = random();
  const code = Menu.encode(answers);
  assert.deepEqual(Menu.decode(Menu.format(code).toLowerCase()).answers, answers);
  assert.deepEqual(Menu.decode(` ${code.replace(/0/g, 'O').replace(/1/g, 'l')} `).answers, answers);
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

test('codes without custom items keep the original format', () => {
  // Links shared before custom items existed must keep working.
  const answers = Array.from({ length: Menu.ITEM_COUNT }, (_, i) => i % 5);
  const code = Menu.encode(answers);
  assert.match(code, /^1[0-9A-Z]{38}$/);
  assert.equal(Menu.encode(answers, []), code);
});

const custom = [
  { category: 0, text: 'Weekly sauna 🧖', rating: Menu.MUST },
  { category: 7, text: '  Separate   bedrooms ', rating: Menu.NONE },
  { category: 3, text: 'x'.repeat(80), rating: Menu.OFF },
];

test('custom items round-trip, cleaned and truncated', () => {
  const answers = random();
  const code = Menu.encode(answers, custom);
  assert.match(code, /[0-9A-Z]$/);
  const decoded = Menu.decode(code);
  assert.deepEqual(decoded.answers, answers);
  assert.deepEqual(decoded.custom, [
    { category: 0, text: 'Weekly sauna 🧖', rating: Menu.MUST },
    { category: 7, text: 'Separate bedrooms', rating: Menu.NONE },
    { category: 3, text: 'x'.repeat(60), rating: Menu.OFF },
  ]);
  // Case and whitespace of the custom part survive normalization.
  assert.deepEqual(Menu.decode(` ${code} `), decoded);
});

test('damaged or truncated custom part is rejected', () => {
  const code = Menu.encode(random(), custom);
  for (const cut of [1, 5, 20]) assert.throws(() => Menu.decode(code.slice(0, -cut)), /incomplete or damaged/);
  assert.throws(() => Menu.decode(code + 'A'), /incomplete or damaged/);
  assert.throws(() => Menu.encode(random(), Array(11).fill(custom[0])), /Too many/);
});

test('compare matches custom items by category and text', () => {
  const a = { answers: Array(Menu.ITEM_COUNT).fill(Menu.MUST), custom: [
    { category: 0, text: 'Sauna', rating: Menu.MUST },
    { category: 1, text: 'Only mine', rating: Menu.LIKE },
  ] };
  const b = { answers: Array(Menu.ITEM_COUNT).fill(Menu.MUST), custom: [
    { category: 0, text: 'sauna', rating: Menu.OFF },
    { category: 2, text: 'Only theirs', rating: Menu.MAYBE },
  ] };
  const { categories, counts } = Menu.compare(a, b);
  const customRows = categories.flatMap((c) => c.rows.filter((r) => r.custom));
  assert.deepEqual(customRows.map((r) => [r.item, r.mine, r.theirs, r.tier]), [
    ['Sauna', Menu.MUST, Menu.OFF, 'conflict'],
    ['Only mine', Menu.LIKE, Menu.NONE, 'unanswered'],
    ['Only theirs', Menu.NONE, Menu.MAYBE, 'unanswered'],
  ]);
  assert.equal(counts.match, Menu.ITEM_COUNT);
});

test('mergeCustom adopts partner items and keeps own ratings', () => {
  const own = [{ category: 0, text: 'sauna', rating: Menu.LIKE }, { category: 1, text: 'Mine', rating: Menu.MUST }];
  const partners = [{ category: 0, text: 'Sauna', rating: Menu.OFF }, { category: 2, text: 'New', rating: Menu.MUST }];
  assert.deepEqual(Menu.mergeCustom(own, partners), [
    { category: 0, text: 'Sauna', rating: Menu.LIKE },
    { category: 2, text: 'New', rating: Menu.NONE },
    { category: 1, text: 'Mine', rating: Menu.MUST },
  ]);
});

test('compare counts every item once', () => {
  const { counts, categories } = Menu.compare({ answers: random(), custom: [] }, { answers: random(), custom: [] });
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), Menu.ITEM_COUNT);
  assert.equal(categories.length, 8);
});
