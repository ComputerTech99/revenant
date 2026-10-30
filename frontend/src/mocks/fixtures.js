const BASE_NOW = new Date('2026-10-30T18:30:00Z');

const INITIAL_CONCEPTS = [
  {
    id: 'os_c1',
    deck_id: 'deck_os_u3',
    name: 'Virtual address translation and page tables',
    summary:
      'The memory management unit translates virtual page numbers into physical frame addresses using hierarchical page tables.',
    pages: [2, 3, 5, 6],
    base_health: 0.94,
    interval_days: 24,
    days_elapsed: 1.5,
    status: 'mastered',
    card_count: 9,
  },
  {
    id: 'os_c2',
    deck_id: 'deck_os_u3',
    name: 'Translation lookaside buffer hit ratio',
    summary:
      'The hardware address cache stores recent page table entries so most memory references bypass main memory lookup.',
    pages: [7, 8, 10],
    base_health: 0.89,
    interval_days: 22,
    days_elapsed: 2.4,
    status: 'mastered',
    card_count: 8,
  },
  {
    id: 'os_c3',
    deck_id: 'deck_os_u3',
    name: 'Demand paging and major page faults',
    summary:
      'Pages load into RAM only when referenced, triggering a kernel trap and disk read if the valid bit is clear.',
    pages: [12, 14, 15],
    base_health: 0.78,
    interval_days: 6,
    days_elapsed: 3.1,
    status: 'learning',
    card_count: 9,
  },
  {
    id: 'os_c4',
    deck_id: 'deck_os_u3',
    name: 'Clock replacement and Belady anomaly',
    summary:
      'The clock hand sweeps reference bits to approximate least recently used eviction without scanning the entire frame table.',
    pages: [18, 19, 22],
    base_health: 0.62,
    interval_days: 4,
    days_elapsed: 5.5,
    status: 'shaky',
    card_count: 8,
  },
  {
    id: 'os_c5',
    deck_id: 'deck_os_u3',
    name: 'Working set model and thrashing control',
    summary:
      'When active working sets exceed physical frames, the kernel suspends processes instead of faulting on every instruction.',
    pages: [25, 27, 29],
    base_health: 0.43,
    interval_days: 3,
    days_elapsed: 8.2,
    status: 'shaky',
    card_count: 7,
  },
  {
    id: 'os_c6',
    deck_id: 'deck_os_u3',
    name: 'Copy on write during process fork',
    summary:
      'Parent and child share read only physical frames until either process writes to a page and triggers private allocation.',
    pages: [31, 33, 34],
    base_health: null,
    interval_days: 1,
    days_elapsed: 0,
    status: 'new',
    card_count: 6,
  },
  {
    id: 'db_c1',
    deck_id: 'deck_db_wal',
    name: 'Write ahead log recovery invariants',
    summary:
      'Log records describing a page mutation must reach durable storage before the dirty data page is flushed to disk.',
    pages: [1, 3, 4],
    base_health: 0.91,
    interval_days: 23,
    days_elapsed: 1.8,
    status: 'mastered',
    card_count: 8,
  },
  {
    id: 'db_c2',
    deck_id: 'deck_db_wal',
    name: 'Slotted page layout and tuple indirection',
    summary:
      'A header pointer array grows downward while variable length tuples pack upward from the end of the block.',
    pages: [6, 8, 9],
    base_health: 0.76,
    interval_days: 5,
    days_elapsed: 2.9,
    status: 'learning',
    card_count: 7,
  },
  {
    id: 'db_c3',
    deck_id: 'deck_db_wal',
    name: 'Latch crabbing in concurrent trees',
    summary:
      'Traversals acquire child latches before releasing parent latches once the child node is guaranteed safe from splitting.',
    pages: [12, 14, 16],
    base_health: 0.57,
    interval_days: 3,
    days_elapsed: 4.8,
    status: 'shaky',
    card_count: 8,
  },
  {
    id: 'db_c4',
    deck_id: 'deck_db_wal',
    name: 'Steal and no force buffer policies',
    summary:
      'Allowing uncommitted frames on disk and skipping synchronous data flushes at commit requires undo and redo logging.',
    pages: [18, 20, 21],
    base_health: null,
    interval_days: 1,
    days_elapsed: 0,
    status: 'new',
    card_count: 6,
  },
];

const INITIAL_CARDS = [
  {
    id: 'card_os_1',
    concept_id: 'os_c4',
    deck_id: 'deck_os_u3',
    type: 'mcq',
    prompt: 'What does the clock page replacement algorithm inspect before evicting a candidate frame?',
    options: [
      'The hardware reference bit in the page table entry',
      'The total byte count allocated to the owning thread',
      'The disk sector cylinder distance from the swap partition',
      'The instruction pointer register of the scheduler',
    ],
    answer: 'The hardware reference bit in the page table entry',
    source: {
      page: 19,
      snippet:
        'As the clock hand sweeps around the circular frame buffer, it inspects the hardware reference bit in the page table entry: if the bit is 1, it clears the bit and advances; if 0, the frame is selected for eviction.',
    },
  },
  {
    id: 'card_os_2',
    concept_id: 'os_c5',
    deck_id: 'deck_os_u3',
    type: 'cloze',
    prompt: 'A system enters ____ when processes spend more time servicing page faults than executing instructions.',
    options: null,
    answer: 'thrashing',
    source: {
      page: 25,
      snippet:
        'When the sum of active working sets exceeds physical memory frames, the system enters thrashing, spending more time servicing page faults than executing instructions.',
    },
  },
  {
    id: 'card_os_3',
    concept_id: 'os_c3',
    deck_id: 'deck_os_u3',
    type: 'explain',
    prompt: 'Explain the exact sequence of steps the kernel performs when a process triggers a major page fault.',
    options: null,
    answer:
      'The CPU traps into the kernel after seeing the valid bit is zero, the OS verifies the virtual address is legal, allocates a free frame, schedules a disk read from backing store, updates the page table entry with the frame number and valid bit, and restarts the faulting instruction.',
    source: {
      page: 14,
      snippet:
        'On a major page fault, the MMU raises a trap to the kernel. The OS checks the virtual memory area permissions, locates the page on backing store, issues a disk read into a free physical frame, sets the valid bit in the page table entry, and restarts the instruction.',
    },
  },
  {
    id: 'card_os_4',
    concept_id: 'os_c2',
    deck_id: 'deck_os_u3',
    type: 'mcq',
    prompt: 'Why must the translation lookaside buffer be flushed or tagged with address space identifiers on context switch?',
    options: [
      'Two processes use identical virtual page numbers that map to different physical frames',
      'The CPU instruction cache cannot read physical addresses while kernel mode is active',
      'Page frames in RAM lose their contents whenever the timer interrupt fires',
      'Virtual addresses are stored on the swap disk rather than inside processor registers',
    ],
    answer: 'Two processes use identical virtual page numbers that map to different physical frames',
    source: {
      page: 8,
      snippet:
        'Because each process owns a private virtual address space, two processes use identical virtual page numbers that map to different physical frames; without ASID tags, a context switch must flush non global TLB entries.',
    },
  },
  {
    id: 'card_os_5',
    concept_id: 'os_c1',
    deck_id: 'deck_os_u3',
    type: 'cloze',
    prompt: 'During virtual address translation, the page ____ is concatenated unchanged with the physical frame number.',
    options: null,
    answer: 'offset',
    source: {
      page: 3,
      snippet:
        'Because pages and frames have identical power of two sizes, the lower bits form the page offset, which is concatenated unchanged with the physical frame number.',
    },
  },
  {
    id: 'card_db_1',
    concept_id: 'db_c3',
    deck_id: 'deck_db_wal',
    type: 'mcq',
    prompt: 'When is a child node considered safe for releasing ancestor latches during an insert traversal?',
    options: [
      'When the child has at least one free slot and will not split',
      'When the buffer pool manager pins page zero in shared mode',
      'When the write ahead log tail reaches the checkpoint boundary',
      'When all sibling leaf pointers point to contiguous disk blocks',
    ],
    answer: 'When the child has at least one free slot and will not split',
    source: {
      page: 14,
      snippet:
        'During an insert traversal, a child node is safe when it is not full (has at least one free slot and will not split); once latched, all exclusive latches held on ancestors can be released immediately.',
    },
  },
  {
    id: 'card_db_2',
    concept_id: 'db_c1',
    deck_id: 'deck_db_wal',
    type: 'cloze',
    prompt: 'Every data page stores the ____ sequence number of the most recent operation that modified it.',
    options: null,
    answer: 'log',
    source: {
      page: 3,
      snippet:
        'To enforce the write ahead rule, every data page header stores the page LSN, the log sequence number of the most recent operation that modified it.',
    },
  },
];

let mockState = {
  offsetDays: 0,
  dailyGoal: 15,
  streak: 6,
  bestStreak: 14,
  freezes: 1,
  xpToday: 110,
  xpTotal: 1480,
  reviewsToday: 11,
  decks: [
    {
      deck_id: 'deck_os_u3',
      title: 'Operating Systems, Unit 3',
      status: 'ready',
      progress: 1.0,
      page_count: 34,
      concept_count: 6,
      card_count: 47,
      due_count: 5,
      mastery_pct: 63.4,
      created_at: '2026-10-28T14:20:00Z',
    },
    {
      deck_id: 'deck_db_wal',
      title: 'Database Internals, B Trees and WAL',
      status: 'ready',
      progress: 1.0,
      page_count: 21,
      concept_count: 4,
      card_count: 29,
      due_count: 2,
      mastery_pct: 42.8,
      created_at: '2026-10-29T09:15:00Z',
    },
  ],
  concepts: JSON.parse(JSON.stringify(INITIAL_CONCEPTS)),
  cards: JSON.parse(JSON.stringify(INITIAL_CARDS)),
  reviewedCardIds: new Set(),
};

function getNowDate() {
  return new Date(BASE_NOW.getTime() + mockState.offsetDays * 86400000);
}

function toIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function computeConceptView(concept) {
  if (concept.status === 'new' || concept.base_health === null) {
    return {
      id: concept.id,
      deck_id: concept.deck_id,
      name: concept.name,
      summary: concept.summary,
      pages: concept.pages,
      health: null,
      status: 'new',
      next_due: null,
      card_count: concept.card_count,
    };
  }

  const effectiveDays = Math.max(0, concept.days_elapsed + mockState.offsetDays);
  const rawHealth = Math.pow(0.9, effectiveDays / Math.max(1, concept.interval_days));
  const scaledHealth = Math.min(1, Math.max(0.18, Number((concept.base_health * rawHealth).toFixed(2))));

  let status = 'learning';
  if (scaledHealth < 0.7) {
    status = 'shaky';
  } else if (scaledHealth >= 0.85 && concept.interval_days >= 21) {
    status = 'mastered';
  }

  const dueOffsetDays = Math.round(concept.interval_days - effectiveDays);
  const nextDueDate = new Date(getNowDate().getTime() + dueOffsetDays * 86400000);

  return {
    id: concept.id,
    deck_id: concept.deck_id,
    name: concept.name,
    summary: concept.summary,
    pages: concept.pages,
    health: scaledHealth,
    status,
    next_due: toIso(nextDueDate),
    card_count: concept.card_count,
  };
}

export function getMockHealth() {
  return { ok: true, model: 'gemma4:e4b', provider: 'ollama' };
}

export function getMockStats() {
  const goalMet = mockState.reviewsToday >= mockState.dailyGoal;
  return {
    streak: mockState.streak,
    best_streak: Math.max(mockState.bestStreak, mockState.streak),
    freezes: mockState.freezes,
    xp_today: mockState.xpToday,
    xp_total: mockState.xpTotal,
    daily_goal: mockState.dailyGoal,
    reviews_today: mockState.reviewsToday,
    goal_met: goalMet,
    now: toIso(getNowDate()),
  };
}

export function updateMockSettings(dailyGoal) {
  mockState.dailyGoal = dailyGoal;
  return getMockStats();
}

export function getMockDecks() {
  return mockState.decks.map((d) => ({ ...d }));
}

export function getMockDeckById(deckId) {
  const deck = mockState.decks.find((d) => d.deck_id === deckId);
  if (!deck) {
    const err = new Error('Could not find this deck.');
    err.code = 'not_found';
    throw err;
  }
  if (deck.status === 'processing') {
    const nextProgress = Math.min(1, Number((deck.progress + 0.34).toFixed(2)));
    deck.progress = nextProgress;
    if (nextProgress >= 1) {
      deck.status = 'ready';
      deck.concept_count = 5;
      deck.card_count = 23;
      deck.due_count = 6;
      deck.mastery_pct = 18.5;
    }
  }
  return { ...deck };
}

export function createMockDeck(file) {
  const rawName = file?.name || 'Lecture Notes.pdf';
  const cleanTitle = rawName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
  const deckId = `deck_${Date.now()}`;
  const newDeck = {
    deck_id: deckId,
    title: cleanTitle,
    status: 'processing',
    progress: 0.16,
    page_count: 19,
    concept_count: 0,
    card_count: 0,
    due_count: 0,
    mastery_pct: 0,
    created_at: toIso(getNowDate()),
  };
  mockState.decks = [newDeck, ...mockState.decks];

  const newConcepts = [
    {
      id: `${deckId}_c1`,
      deck_id: deckId,
      name: 'Core definitions and system model',
      summary: 'Establishes the primary assumptions, state transitions and invariants introduced in the opening pages.',
      pages: [1, 2, 4],
      base_health: 0.87,
      interval_days: 21,
      days_elapsed: 1.0,
      status: 'mastered',
      card_count: 6,
    },
    {
      id: `${deckId}_c2`,
      deck_id: deckId,
      name: 'Execution pipeline and scheduling trade offs',
      summary: 'Balances throughput against tail latency when contention rises across shared worker queues.',
      pages: [5, 7, 9],
      base_health: 0.64,
      interval_days: 4,
      days_elapsed: 4.5,
      status: 'shaky',
      card_count: 8,
    },
    {
      id: `${deckId}_c3`,
      deck_id: deckId,
      name: 'Fault tolerance and state verification',
      summary: 'Reconstructs consistent state from durable checkpoints after unexpected node interruption.',
      pages: [11, 14, 18],
      base_health: null,
      interval_days: 1,
      days_elapsed: 0,
      status: 'new',
      card_count: 9,
    },
  ];
  mockState.concepts.push(...newConcepts);

  mockState.cards.push({
    id: `${deckId}_k1`,
    concept_id: `${deckId}_c2`,
    deck_id: deckId,
    type: 'mcq',
    prompt: `In ${cleanTitle}, what happens when worker queue utilisation approaches capacity?`,
    options: [
      'Tail latency rises nonlinearly as queueing delay dominates service time',
      'All pending tasks bypass memory allocation and execute in register space',
      'The scheduler disables interrupts permanently until reboot',
      'Throughput doubles linearly without bound',
    ],
    answer: 'Tail latency rises nonlinearly as queueing delay dominates service time',
    source: {
      page: 7,
      snippet:
        'As arrival rate approaches service capacity, tail latency rises nonlinearly because queueing delay dominates raw execution time.',
    },
  });

  return { ...newDeck };
}

export function getMockDeckPath(deckId) {
  const targetId = deckId || mockState.decks[0]?.deck_id;
  const list = mockState.concepts.filter((c) => c.deck_id === targetId);
  if (list.length === 0 && mockState.concepts.length > 0) {
    return mockState.concepts
      .filter((c) => c.deck_id === mockState.decks[0].deck_id)
      .map(computeConceptView);
  }
  return list.map(computeConceptView);
}

export function getMockDueCards(deckId, limit = 15) {
  let pool = mockState.cards;
  if (deckId) {
    const filtered = pool.filter((c) => c.deck_id === deckId);
    if (filtered.length > 0) {
      pool = filtered;
    }
  }
  return pool.slice(0, limit).map((c) => ({ ...c }));
}

function applyMockReviewUpdate(card, grade, xpBase) {
  const wasGoalMet = mockState.reviewsToday >= mockState.dailyGoal;
  mockState.reviewsToday += 1;
  const nowGoalMet = mockState.reviewsToday >= mockState.dailyGoal;

  let xpGained = xpBase;
  if (!wasGoalMet && nowGoalMet) {
    xpGained += 20;
    mockState.streak += 1;
  }

  mockState.xpToday += xpGained;
  mockState.xpTotal += xpGained;

  const concept = mockState.concepts.find((c) => c.id === card.concept_id);
  let updatedConceptView = null;
  if (concept) {
    if (grade === 'again') {
      concept.base_health = 0.54;
      concept.days_elapsed = 2.5;
      concept.interval_days = 1;
    } else if (grade === 'hard') {
      concept.base_health = 0.76;
      concept.days_elapsed = 0.5;
      concept.interval_days = Math.max(3, concept.interval_days);
    } else {
      const wasMastered = concept.base_health !== null && concept.base_health >= 0.85 && concept.interval_days >= 21;
      concept.base_health = 0.96;
      concept.days_elapsed = 0;
      concept.interval_days = grade === 'easy' ? 25 : Math.max(7, concept.interval_days + 6);
      if (!wasMastered && concept.interval_days >= 21 && mockState.freezes < 2) {
        mockState.freezes = Math.min(2, mockState.freezes + 1);
      }
    }
    updatedConceptView = computeConceptView(concept);
  }

  const deck = mockState.decks.find((d) => d.deck_id === card.deck_id);
  if (deck && grade !== 'again') {
    deck.due_count = Math.max(0, deck.due_count - 1);
    deck.mastery_pct = Number(Math.min(100, deck.mastery_pct + 2.3).toFixed(1));
  }

  const nextDays = grade === 'again' ? 0 : grade === 'hard' ? 1 : 7;
  const nextDue = toIso(new Date(getNowDate().getTime() + nextDays * 86400000));

  return {
    nextDue,
    concept: updatedConceptView,
    xpGained,
    stats: getMockStats(),
  };
}

export function submitMockCardGrade(cardId, grade) {
  const card = mockState.cards.find((c) => c.id === cardId) || mockState.cards[0];
  const xpBase = grade === 'good' || grade === 'easy' ? 10 : 0;
  const res = applyMockReviewUpdate(card, grade, xpBase);
  return {
    next_due: res.nextDue,
    concept: res.concept,
    xp_gained: res.xpGained,
    stats: res.stats,
  };
}

export function submitMockExplainAnswer(cardId, answerText) {
  const card = mockState.cards.find((c) => c.id === cardId) || mockState.cards[0];
  const words = (answerText || '').trim().split(/\s+/).filter(Boolean).length;

  let score = 0.85;
  let grade = 'good';
  let feedback =
    'You captured the kernel trap, frame allocation from backing store, and page table update before instruction restart.';

  if (words < 6) {
    score = 0.42;
    grade = 'again';
    feedback =
      'Your answer is too brief. Mention the valid bit trap into the kernel, reading the page from disk into a free frame, and restarting the instruction.';
  } else if (words < 14) {
    score = 0.68;
    grade = 'hard';
    feedback =
      'You identified the disk read into RAM, yet omitted checking virtual address permissions and setting the valid bit in the page table entry.';
  }

  const xpBase = Math.round(score * 20);
  const res = applyMockReviewUpdate(card, grade, xpBase);

  return {
    score,
    feedback,
    grade,
    source: card.source,
    next_due: res.nextDue,
    concept: res.concept,
    xp_gained: res.xpGained,
    stats: res.stats,
  };
}

export function applyMockTimewarp(days) {
  mockState.offsetDays += Number(days) || 0;
  mockState.decks.forEach((d) => {
    if (d.status === 'ready') {
      d.due_count = Math.min(d.card_count, d.due_count + Math.max(1, Math.round(days * 1.5)));
      d.mastery_pct = Number(Math.max(12.4, d.mastery_pct - days * 4.2).toFixed(1));
    }
  });
  return { now: toIso(getNowDate()) };
}

export function resetMockTimewarp() {
  mockState.offsetDays = 0;
  mockState.decks[0].due_count = 5;
  mockState.decks[0].mastery_pct = 63.4;
  if (mockState.decks[1]) {
    mockState.decks[1].due_count = 2;
    mockState.decks[1].mastery_pct = 42.8;
  }
  return { now: toIso(getNowDate()) };
}

