// Menu data, answer-code encoding and comparison logic.
// Pure functions only, so they can be tested in Node and used in the browser.
(function (root) {
  'use strict';

  // IMPORTANT: codes store answers by position ("slot"). Plain strings get slots
  // 0, 1, 2, … in order, so never reorder, insert or remove them. To add an item,
  // write it as { text, slot } with the next unused slot, anywhere in the list:
  // older codes then show it as unanswered. Note: 79 slots fill the 39-character
  // code; an 80th item makes codes longer and needs decodeAnswers to accept old lengths.
  const CATEGORIES = [
    {
      title: 'Commitment',
      items: [
        'Marriage',
        'Pregnancy/children together',
        'Coparenting children from other partnerships',
        'Sharing pet(s)',
        'Having a key',
        'Cohabitation',
        'Home ownership',
        'Prioritization over other partners',
        'Relationship labels',
        'Planning for future',
        'Expectation of long term involvement',
        'Commitment to working through challenges',
        'Commitment to relationship maintenance',
        'Power of attorney/wills',
        'Support through health challenges',
      ],
    },
    {
      title: 'Emotional Intimacy',
      items: [
        'Expressing happiness and joy',
        'Offering support in hard times',
        'Sharing vulnerable feelings',
        'Saying “I love you”',
        'Sharing stories about past',
        'Sharing hopes for future',
        'Knowing personal likes/dislikes (eg fav foods)',
        'Using pet names',
        'Sharing about mental health challenges',
        'Supporting mental health work',
      ],
    },
    {
      title: 'Social Integration',
      items: [
        'Meeting metamours (partners’ other partners)',
        'Meeting children',
        'Meeting parents/siblings/extended family',
        'Meeting friends',
        'Spending time as a couple with friends/family',
        'Positive relationships with metamours',
        'Serving as +1 for social events',
        'Presenting as a couple in public settings',
        'Following on social media',
        'Presenting as a couple on social media',
        'Presenting as a couple in professional settings',
        'Joint vacations with family/metamours',
      ],
    },
    {
      title: 'Physical Intimacy',
      items: [
        'Physical affection',
        'PDA (public displays of affection)',
        'Compatible sex drives',
        'Sexual chemistry',
        'Orgasms',
        'Kissing',
        'Oral sex',
        'Manual sex (fingering)',
        'Mutual masturbation',
        'Penetration/PIV (penis-in-vagina)',
        'Using sex toys',
        'Condom/barrier use',
        'Regular STI testing',
        'Kinky stuff',
        'Threesomes or group sex',
      ],
    },
    {
      title: 'Communication',
      items: [
        'Daily or frequent check ins',
        'Texting',
        'Phone / video calls',
        'Discussing work and hobbies',
        'Discussing family, partners, relationships',
        'Discussing politics and current events',
        'Ability to express disagreements or hurt feelings',
        'Ability to address and resolve conflict',
        'Radical honesty',
      ],
    },
    {
      title: 'Quality Time',
      items: [
        'Regularly scheduled time together',
        'Date nights',
        'Spending the night',
        'Shared hobbies or activities',
        'Vacations together as couple',
        'Calendar management/scheduling initiation',
      ],
    },
    {
      title: 'Financial Management',
      items: [
        'Shared bank account(s)',
        'Mutual contributions to vacation/activity fund',
        'Financial support',
        'Large gifts',
        'Complete financial integration',
        { text: 'Equal/fair share of joint costs (e.g. for a shared vacation)', slot: 78 },
      ],
    },
    {
      title: 'Autonomy',
      items: [
        'Balance of time together and apart',
        'Support to pursue independent interests',
        'Maintaining independent friendships',
        'Maintaining independent romantic relationships',
        'Equal distribution of relationship power',
        'Alone time',
      ],
    },
  ];

  // Answer values. 0 means "not answered".
  const NONE = 0, MUST = 1, LIKE = 2, MAYBE = 3, OFF = 4;
  const RATINGS = [
    { value: MUST, label: 'Must have', short: 'Must', icon: '●', description: 'Can’t do without' },
    { value: LIKE, label: 'Like to have', short: 'Like', icon: '◉', description: 'Don’t need it, but nice to have' },
    { value: MAYBE, label: 'Maybe', short: 'Maybe', icon: '?', description: 'Maybe, but perfectly happy without' },
    { value: OFF, label: 'Off limits', short: 'Off', icon: '⊘', description: 'Preferably never' },
  ];

  // Normalize every item to { text, slot }.
  let nextSlot = 0;
  for (const cat of CATEGORIES) {
    cat.items = cat.items.map((item) => (typeof item === 'string' ? { text: item, slot: nextSlot++ } : item));
  }
  const ITEM_COUNT = CATEGORIES.reduce((n, c) => n + c.items.length, 0);
  const slots = CATEGORIES.flatMap((c) => c.items.map((i) => i.slot)).sort((a, b) => a - b);
  if (slots.some((s, i) => s !== i)) throw new Error('Menu item slots must be unique and consecutive');
  const MAX_CUSTOM = 10;
  const MAX_CUSTOM_LENGTH = 60;

  // ---- code format ----
  // A code is "<answers>" or "<answers>.<custom items>".
  // <answers>: version digit + the fixed items' answers as one base-5 number in
  //   Crockford base32 + check characters. Short enough to type.
  // <custom items>: base64url of "<category><rating><text>" lines + check characters.
  //   Only present when the menu has custom items; then the code is shared as a link.
  //
  // Version 1 (older links, still accepted) has one weak check character.
  // Version 2 (all new codes) has two, holding a value mod 1021. As 1021 is a prime
  // larger than any single character change, every single-character typo and every
  // swap of neighbouring characters is caught; other damage slips through about 1 in 1021.
  const CODE_VERSION = '2';
  // Crockford base32: no I, L, O, U, so codes are easy to read and type.
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  // Enough base32 digits to hold any 5^ITEM_COUNT value.
  const BODY_LENGTH = Math.ceil((ITEM_COUNT * Math.log2(5)) / 5);
  const PRIME = 1021;

  function weakChecksum(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += (i + 1) * ALPHABET.indexOf(digits[i]);
    return ALPHABET[sum % 32];
  }

  // The base32 digits read as one number, mod PRIME.
  function strongChecksum(digits) {
    let n = 0;
    for (const ch of digits) n = (n * 32 + ALPHABET.indexOf(ch)) % PRIME;
    return checkChars(n);
  }

  // Check characters for the custom part are always alphanumeric, so the link never
  // ends in "-" or "_", which messengers may leave out of the link.
  function textHash(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % PRIME;
    return n;
  }
  const checkChars = (n) => ALPHABET[Math.floor(n / 32)] + ALPHABET[n % 32];

  const FORMATS = {
    1: { check: weakChecksum, checkLength: 1, textCheck: (s) => ALPHABET[textHash(s) % 32] },
    2: { check: strongChecksum, checkLength: 2, textCheck: (s) => checkChars(textHash(s)) },
  };

  function cleanText(text) {
    return Array.from(String(text).replace(/\s+/g, ' ').trim()).slice(0, MAX_CUSTOM_LENGTH).join('');
  }

  function toBase64Url(text) {
    let binary = '';
    for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(b64) {
    const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  }

  function encodeAnswers(answers) {
    if (answers.length !== ITEM_COUNT) throw new Error('Wrong number of answers');
    let n = 0n;
    for (let i = answers.length - 1; i >= 0; i--) {
      const a = answers[i];
      if (!Number.isInteger(a) || a < NONE || a > OFF) throw new Error('Invalid answer');
      n = n * 5n + BigInt(a);
    }
    let body = '';
    for (let i = 0; i < BODY_LENGTH; i++) {
      body = ALPHABET[Number(n % 32n)] + body;
      n /= 32n;
    }
    const raw = CODE_VERSION + body;
    return raw + FORMATS[CODE_VERSION].check(raw);
  }

  // custom: [{ category, text, rating }]
  function encode(answers, custom = []) {
    const code = encodeAnswers(answers);
    if (!custom.length) return code;
    if (custom.length > MAX_CUSTOM) throw new Error('Too many custom items');
    const lines = custom.map((c) => {
      const text = cleanText(c.text);
      if (!text || !CATEGORIES[c.category] || c.rating < NONE || c.rating > OFF) throw new Error('Invalid custom item');
      return `${c.category}${c.rating}${text}`;
    });
    const b64 = toBase64Url(lines.join('\n'));
    return `${code}.${b64}${FORMATS[CODE_VERSION].textCheck(b64)}`;
  }

  function normalizeAnswers(code) {
    return code.toUpperCase().replace(/-/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  }

  function normalize(code) {
    const s = String(code).replace(/\s/g, '');
    const dot = s.indexOf('.');
    return dot < 0 ? normalizeAnswers(s) : normalizeAnswers(s.slice(0, dot)) + s.slice(dot);
  }

  function decodeAnswers(c, format) {
    if (!c) throw new Error('Please enter a code.');
    if (!format) throw new Error('This code is from a different version of the menu.');
    if (c.length !== 1 + BODY_LENGTH + format.checkLength) {
      throw new Error('This code has the wrong length. Check for missing or extra characters.');
    }
    for (const ch of c) if (ALPHABET.indexOf(ch) < 0) throw new Error(`“${ch}” is not a valid character.`);
    const raw = c.slice(0, 1 + BODY_LENGTH);
    if (format.check(raw) !== c.slice(raw.length)) throw new Error('This code contains a typo. Please check it.');
    let n = 0n;
    for (const ch of raw.slice(1)) n = n * 32n + BigInt(ALPHABET.indexOf(ch));
    const answers = [];
    for (let i = 0; i < ITEM_COUNT; i++) {
      answers.push(Number(n % 5n));
      n /= 5n;
    }
    if (n !== 0n) throw new Error('This code is not valid.');
    return answers;
  }

  function decodeCustom(part, format) {
    const damaged = new Error('This link is incomplete or damaged. Ask for it to be sent again.');
    const b64 = part.slice(0, -format.checkLength);
    if (!b64 || format.textCheck(b64) !== part.slice(b64.length)) throw damaged;
    let text;
    try { text = fromBase64Url(b64); } catch (e) { throw damaged; }
    const custom = text.split('\n').map((line) => ({
      category: Number(line[0]),
      rating: Number(line[1]),
      text: cleanText(line.slice(2)),
    }));
    const valid = custom.length <= MAX_CUSTOM && custom.every((c) =>
      CATEGORIES[c.category] && c.rating >= NONE && c.rating <= OFF && c.text);
    if (!valid) throw damaged;
    return custom;
  }

  // Returns { answers, custom }, or throws an Error with a user-facing message.
  function decode(code) {
    const c = normalize(code);
    const format = FORMATS[c[0]];
    const dot = c.indexOf('.');
    if (dot < 0) return { answers: decodeAnswers(c, format), custom: [] };
    return { answers: decodeAnswers(c.slice(0, dot), format), custom: decodeCustom(c.slice(dot + 1), format) };
  }

  // Groups of 5 characters for readability (codes without custom items only).
  function format(code) {
    const c = normalize(code);
    return c.includes('.') ? c : c.match(/.{1,5}/g).join('-');
  }

  // ---- comparison ----
  // Comparison tiers, ordered from best to worst.
  const TIERS = {
    match: { label: 'Match', description: 'Same answer' },
    close: { label: 'Close', description: 'Must have vs. like to have' },
    discuss: { label: 'Discuss', description: 'At least one “maybe”' },
    conflict: { label: 'Conflict', description: 'Wanted vs. off limits' },
    unanswered: { label: 'Unanswered', description: 'At least one person skipped it' },
  };

  function tier(a, b) {
    if (a === NONE || b === NONE) return 'unanswered';
    if (a === b) return 'match';
    if (a === MAYBE || b === MAYBE) return 'discuss';
    if (a === OFF || b === OFF) return 'conflict';
    return 'close'; // the only remaining pair is must vs. like
  }

  // Custom items are matched by category and text.
  const customKey = (c) => `${c.category}|${c.text.toLowerCase()}`;

  // mine, theirs: { answers, custom } as returned by decode().
  function compare(mine, theirs) {
    const counts = Object.fromEntries(Object.keys(TIERS).map((k) => [k, 0]));
    const theirCustom = new Map(theirs.custom.map((c) => [customKey(c), c]));
    const myKeys = new Set(mine.custom.map(customKey));
    const row = (item, a, b, custom) => {
      const r = { item, mine: a, theirs: b, tier: tier(a, b), custom };
      counts[r.tier]++;
      return r;
    };
    const categories = CATEGORIES.map((cat, ci) => {
      const rows = cat.items.map((item) => row(item.text, mine.answers[item.slot], theirs.answers[item.slot], false));
      for (const c of mine.custom.filter((c) => c.category === ci)) {
        const t = theirCustom.get(customKey(c));
        rows.push(row(c.text, c.rating, t ? t.rating : NONE, true));
      }
      for (const c of theirs.custom.filter((c) => c.category === ci && !myKeys.has(customKey(c)))) {
        rows.push(row(c.text, NONE, c.rating, true));
      }
      return { title: cat.title, rows };
    });
    return { categories, counts };
  }

  // A recipient adopts the sender's custom items, keeping their own ratings for
  // items with the same text and any items of their own the sender doesn't have.
  function mergeCustom(own, partners) {
    const ownByKey = new Map(own.map((c) => [customKey(c), c]));
    const merged = partners.map((c) => {
      const o = ownByKey.get(customKey(c));
      return { category: c.category, text: c.text, rating: o ? o.rating : NONE };
    });
    const partnerKeys = new Set(partners.map(customKey));
    return merged.concat(own.filter((c) => !partnerKeys.has(customKey(c)))).slice(0, MAX_CUSTOM);
  }

  const api = {
    CATEGORIES, RATINGS, TIERS, ITEM_COUNT, MAX_CUSTOM, MAX_CUSTOM_LENGTH, NONE, MUST, LIKE, MAYBE, OFF,
    encode, decode, format, normalize, cleanText, tier, compare, mergeCustom,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Menu = api;
})(this);
