// Menu data, answer-code encoding and comparison logic.
// Pure functions only, so they can be tested in Node and used in the browser.
(function (root) {
  'use strict';

  // IMPORTANT: codes store answers by position. Never reorder, insert or remove
  // items within a version; bump CODE_VERSION and keep the old list instead.
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
        'Meeting metamors (partners’ other partners)',
        'Meeting children',
        'Meeting parents/siblings/extended family',
        'Meeting friends',
        'Spending time as a couple with friends/family',
        'Positive relationships with metamors',
        'Serving as +1 for social events',
        'Presenting as a couple in public settings',
        'Following on social media',
        'Presenting as a couple on social media',
        'Presenting as a couple in professional settings',
        'Joint vacations with family/metamors',
      ],
    },
    {
      title: 'Physical Intimacy',
      items: [
        'Physical affection',
        'PDA',
        'Compatible sex drives',
        'Sexual chemistry',
        'Orgasms',
        'Kissing',
        'Oral sex',
        'Manual sex (fingering)',
        'Mutual masturbation',
        'Penetration/PIV',
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
        'Calendar mgt/scheduling initiation',
      ],
    },
    {
      title: 'Financial Mgt',
      items: [
        'Shared bank account(s)',
        'Mutual contributions to vacation/activity fund',
        'Financial support',
        'Large gifts',
        'Complete financial integration',
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
    { value: MUST, label: 'Must have', short: 'Must', icon: '●' },
    { value: LIKE, label: 'Like to have', short: 'Like', icon: '◉' },
    { value: MAYBE, label: 'Maybe', short: 'Maybe', icon: '?' },
    { value: OFF, label: 'Off limits', short: 'Off', icon: '⊘' },
  ];

  const ITEM_COUNT = CATEGORIES.reduce((n, c) => n + c.items.length, 0);
  const CODE_VERSION = '1';
  // Crockford base32: no I, L, O, U, so codes are easy to read and type.
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  // Enough base32 digits to hold any 5^ITEM_COUNT value.
  const BODY_LENGTH = Math.ceil((ITEM_COUNT * Math.log2(5)) / 5);
  const CODE_LENGTH = 1 + BODY_LENGTH + 1; // version + body + checksum

  function checksum(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += (i + 1) * ALPHABET.indexOf(digits[i]);
    return ALPHABET[sum % 32];
  }

  function encode(answers) {
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
    return raw + checksum(raw);
  }

  function normalize(code) {
    return String(code)
      .toUpperCase()
      .replace(/[\s-]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1');
  }

  // Returns the answers array, or throws an Error with a user-facing message.
  function decode(code) {
    const c = normalize(code);
    if (!c) throw new Error('Please enter a code.');
    if (c[0] !== CODE_VERSION) throw new Error('This code is from a different version of the menu.');
    if (c.length !== CODE_LENGTH) throw new Error('This code has the wrong length. Check for missing or extra characters.');
    for (const ch of c) if (ALPHABET.indexOf(ch) < 0) throw new Error(`“${ch}” is not a valid character.`);
    const raw = c.slice(0, -1);
    if (checksum(raw) !== c[c.length - 1]) throw new Error('This code contains a typo. Please check it.');
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

  // Groups of 5 characters for readability.
  function format(code) {
    return normalize(code).match(/.{1,5}/g).join('-');
  }

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

  function compare(mine, theirs) {
    let index = 0;
    const counts = Object.fromEntries(Object.keys(TIERS).map((k) => [k, 0]));
    const categories = CATEGORIES.map((cat) => ({
      title: cat.title,
      rows: cat.items.map((item) => {
        const row = { item, mine: mine[index], theirs: theirs[index], tier: tier(mine[index], theirs[index]) };
        counts[row.tier]++;
        index++;
        return row;
      }),
    }));
    return { categories, counts };
  }

  const api = {
    CATEGORIES, RATINGS, TIERS, ITEM_COUNT, NONE, MUST, LIKE, MAYBE, OFF,
    encode, decode, format, normalize, tier, compare,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Menu = api;
})(this);
