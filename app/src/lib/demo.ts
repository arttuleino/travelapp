/**
 * Demo mode (EXPO_PUBLIC_DEMO_MODE=1): a small stand-in for the Supabase client that talks to the
 * demo API built into the Ski Assist web server (server.js on the DanBot host) instead of Supabase.
 * Everyone signed in to the same server shares one sample trip, so a guide's edits and messages
 * reach travellers on other devices within a few seconds.
 *
 * It covers only the client calls this app makes: auth, from(...).select/insert/update/upsert/delete
 * with eq/order/limit, rpc(...) and realtime channels (emulated by polling for changes).
 *
 * The guide's cash book (cash_books, cash_entries) is not in the demo API. It is kept in this
 * browser instead (see `local`), starting from a sample week, so the Talous tab works on the site
 * without server changes. It is not shared between devices.
 */
type User = { id: string; email: string };
type Session = { access_token: string; token_type: string; user: User };
type Result<T = unknown> = { data: T | null; error: { message: string } | null; count?: number | null };
type AuthListener = (event: string, session: Session | null) => void;

const API = `${process.env.EXPO_PUBLIC_DEMO_API_URL ?? ''}/demo-api`;
const STORAGE_KEY = 'ski-assist-demo-session';
const POLL_MS = 2500;

// ---- Session (kept in the browser so a reload stays signed in) ----

function loadSession(): Session | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let session: Session | null = loadSession();
const authListeners = new Set<AuthListener>();

function setSession(next: Session | null, event: string) {
  session = next;
  try {
    if (next) globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
  authListeners.forEach((listener) => listener(event, next));
}

async function call<T>(path: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`${API}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
    if (res.status === 401 && session && path !== 'login') setSession(null, 'SIGNED_OUT');
    if (!res.ok) return { data: null, error: { message: json.error ?? `HTTP ${res.status}` } };
    return { data: json.data ?? null, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

// ---- Realtime: poll table versions and wake the subscribers of tables that changed ----

type Subscription = { table: string; callback: () => void };
const subscriptions = new Set<Subscription>();
let versions: Record<string, number> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  if (!session) return;
  const { data } = await call<Record<string, number>>('versions');
  if (!data) return;
  const previous = versions;
  versions = data;
  if (!previous) return;
  for (const sub of subscriptions) {
    if ((data[sub.table] ?? 0) !== (previous[sub.table] ?? 0)) sub.callback();
  }
}

function startPolling() {
  if (timer || subscriptions.size === 0) return;
  void poll();
  timer = setInterval(() => void poll(), POLL_MS);
}

function stopPollingIfIdle() {
  if (!timer || subscriptions.size > 0) return;
  clearInterval(timer);
  timer = null;
  versions = null;
}

class Channel {
  private subs: Subscription[] = [];
  on(_type: string, options: { table: string }, callback: () => void) {
    this.subs.push({ table: options.table, callback });
    return this;
  }
  subscribe() {
    this.subs.forEach((s) => subscriptions.add(s));
    startPolling();
    return this;
  }
  unsubscribe() {
    this.subs.forEach((s) => subscriptions.delete(s));
    stopPollingIfIdle();
  }
}

// ---- Queries ----

type Op = 'eq' | 'lt' | 'lte' | 'gt' | 'gte';

type Spec = {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  columns: string;
  filters: [string, unknown, Op][];
  order: [string, boolean][];
  limit: number | null;
  values: unknown;
};

class Query<T = unknown> implements PromiseLike<Result<T>> {
  private spec: Spec;
  constructor(table: string) {
    this.spec = { table, op: 'select', columns: '*', filters: [], order: [], limit: null, values: null };
  }
  select(columns = '*') {
    if (this.spec.op === 'select') this.spec.columns = columns;
    return this;
  }
  insert(values: unknown) {
    this.spec.op = 'insert';
    this.spec.values = values;
    return this;
  }
  update(values: unknown) {
    this.spec.op = 'update';
    this.spec.values = values;
    return this;
  }
  upsert(values: unknown, _options?: { onConflict?: string }) {
    this.spec.op = 'upsert';
    this.spec.values = values;
    return this;
  }
  delete(_options?: { count?: string }) {
    this.spec.op = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.spec.filters.push([column, value, 'eq']);
    return this;
  }
  lt(column: string, value: unknown) {
    this.spec.filters.push([column, value, 'lt']);
    return this;
  }
  lte(column: string, value: unknown) {
    this.spec.filters.push([column, value, 'lte']);
    return this;
  }
  gt(column: string, value: unknown) {
    this.spec.filters.push([column, value, 'gt']);
    return this;
  }
  gte(column: string, value: unknown) {
    this.spec.filters.push([column, value, 'gte']);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.spec.order.push([column, options?.ascending !== false]);
    return this;
  }
  limit(count: number) {
    this.spec.limit = count;
    return this;
  }
  then<A = Result<T>, B = never>(
    onFulfilled?: ((result: Result<T>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const write = this.spec.op !== 'select';
    if (LOCAL_TABLES.has(this.spec.table)) return local<T>(this.spec).then(onFulfilled, onRejected);
    return call<T>('query', this.spec)
      .then((result) => {
        if (write) void poll(); // show our own change without waiting for the next poll
        // Writes return the affected rows; their number stands in for Supabase's `count`.
        return write ? { ...result, count: Array.isArray(result.data) ? result.data.length : 0 } : result;
      })
      .then(onFulfilled, onRejected);
  }
}

// ---- Tables kept in this browser (the demo API has no cash book) ----

type Row = Record<string, unknown>;
const LOCAL_TABLES = new Set(['cash_books', 'cash_entries']);
const LOCAL_KEY = 'ski-assist-demo-local';
let store: Record<string, Row[]> | null = null;

function loadStore(): Record<string, Row[]> {
  if (store) return store;
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_KEY);
    store = raw ? (JSON.parse(raw) as Record<string, Row[]>) : {};
  } catch {
    store = {};
  }
  return store;
}

function saveStore(table: string) {
  try {
    globalThis.localStorage?.setItem(LOCAL_KEY, JSON.stringify(store));
  } catch {
    // Without storage the demo cash book lasts until reload.
  }
  for (const sub of subscriptions) if (sub.table === table) sub.callback();
}

const rowsOf = (table: string) => (loadStore()[table] ??= []);
const compare = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? '')));

function matches(row: Row, filters: Spec['filters']) {
  return filters.every(([column, value, op]) => {
    const c = compare(row[column], value);
    return op === 'eq' ? row[column] === value : op === 'lt' ? c < 0 : op === 'lte' ? c <= 0 : op === 'gt' ? c > 0 : c >= 0;
  });
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const BOOK_DEFAULTS = { dest_number: '', department: '', responsible: '', currency: 'EUR', opening_bank: 0, opening_cash: 0, opening_mobile: 0, next_voucher: 1, report_sent_at: null };

/** What the database triggers do: one cash book per trip, voucher numbers 1, 2, 3... */
function insertEntry(values: Row): Row {
  const books = rowsOf('cash_books');
  let book = books.find((b) => b.trip_id === values.trip_id);
  if (!book) books.push((book = { trip_id: values.trip_id, ...BOOK_DEFAULTS }));
  const voucher_no = Number(book.next_voucher ?? 1);
  book.next_voucher = voucher_no + 1;
  const row = { id: newId(), receipt: false, programme_item_id: null, transfer_id: null, comment: '', ...values, voucher_no, created_at: new Date().toISOString() };
  rowsOf('cash_entries').push(row);
  return row;
}

async function local<T>(spec: Spec): Promise<Result<T>> {
  const { table, op, filters } = spec;
  if (table === 'cash_entries' || table === 'cash_books') {
    const trip = filters.find(([c]) => c === 'trip_id')?.[1] ?? (spec.values as Row | null)?.trip_id;
    if (typeof trip === 'string') await seed(trip);
  }
  const rows = rowsOf(table);
  if (op === 'select') {
    let list = rows.filter((r) => matches(r, filters));
    for (const [column, ascending] of [...spec.order].reverse()) list = [...list].sort((a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1));
    if (spec.limit != null) list = list.slice(0, spec.limit);
    return { data: list.map((r) => ({ ...r })) as T, error: null };
  }
  let changed: Row[] = [];
  const values = (Array.isArray(spec.values) ? spec.values : [spec.values]) as Row[];
  if (op === 'insert') changed = values.map((v) => (table === 'cash_entries' ? insertEntry(v) : (rows.push({ ...v }), v)));
  else if (op === 'upsert') {
    changed = values.map((v) => {
      const key = table === 'cash_books' ? 'trip_id' : 'id';
      const found = rows.find((r) => r[key] === v[key]);
      if (found) return Object.assign(found, v);
      const row = table === 'cash_books' ? { ...BOOK_DEFAULTS, ...v } : { ...v };
      rows.push(row);
      return row;
    });
  } else if (op === 'update') {
    // Voucher numbers, owners and transfer pairs never change (as in the database).
    const { trip_id: _t, voucher_no: _v, transfer_id: _x, id: _i, ...patch } = (spec.values ?? {}) as Row;
    changed = rows.filter((r) => matches(r, filters)).map((r) => Object.assign(r, patch));
  } else if (op === 'delete') {
    changed = rows.filter((r) => matches(r, filters));
    loadStore()[table] = rows.filter((r) => !changed.includes(r));
  }
  saveStore(table);
  return { data: changed.map((r) => ({ ...r })) as T, error: null, count: changed.length };
}

const seeding = new Map<string, Promise<void>>();

/** The first time a trip's cash book is opened, fill it with a sample week (as in the demo). */
function seed(tripId: string): Promise<void> {
  if (rowsOf('cash_books').some((b) => b.trip_id === tripId)) return Promise.resolve();
  let p = seeding.get(tripId);
  if (!p) {
    p = seedTrip(tripId);
    seeding.set(tripId, p);
  }
  return p;
}

async function seedTrip(tripId: string) {
  const [trip, items] = await Promise.all([
    call<Row[]>('query', { table: 'trips', op: 'select', columns: '*', filters: [['id', tripId, 'eq']], order: [], limit: 1, values: null }),
    call<Row[]>('query', { table: 'programme_items', op: 'select', columns: '*', filters: [['trip_id', tripId, 'eq']], order: [['day', true]], limit: null, values: null }),
  ]);
  if (rowsOf('cash_books').some((b) => b.trip_id === tripId)) return;
  const t = trip.data?.[0];
  // The demo API may not serve trips on their own; the programme's first day is the trip start too.
  const firstDay = (items.data ?? []).map((i) => String(i.day ?? '')).filter(Boolean).sort()[0];
  const start = typeof t?.starts_on === 'string' ? t.starts_on : (firstDay ?? new Date().toISOString().slice(0, 10));
  const day = (n: number) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const item = (re: RegExp) => (items.data ?? []).find((i) => re.test(String(i.title ?? '')))?.id ?? null;
  const welcome = item(/tervetulo|welcome|välkom|velkomst/i);
  const fondue = item(/fondue/i);
  const sledge = item(/kelk|sledg|pulk|aking/i);
  const hike = item(/vaell|hike|vandr|tur\b/i);
  const tyrol = item(/tirol|tyrol/i);
  rowsOf('cash_books').push({
    trip_id: tripId,
    ...BOOK_DEFAULTS,
    dest_number: '274',
    department: 'Talvi, Charter',
    responsible: '',
    opening_bank: 1200,
    opening_cash: 300,
  });
  // Arrangement income needs a programme item; without one it is booked as other income.
  const income = (id: unknown) => (id ? 'income_arrangement' : 'income_other');
  const transfer = newId();
  const sample: Row[] = [
    { kind: 'cost_other', account: 'bankcard', amount: -86.4, entry_date: day(0), comment: 'Tervetulotilaisuuden tarjoilut', programme_item_id: welcome, receipt: true },
    { kind: 'cost_other', account: 'bankcard', amount: -23.9, entry_date: day(0), comment: 'Puhelinliittymä, data', receipt: true },
    { kind: 'transfer', account: 'bank', amount: -500, entry_date: day(1), comment: 'Käteisnosto', transfer_id: transfer },
    { kind: 'transfer', account: 'cash', amount: 500, entry_date: day(1), comment: 'Käteisnosto', transfer_id: transfer },
    { kind: income(fondue), account: 'mobile', amount: 590, entry_date: day(1), comment: '10 hlö', programme_item_id: fondue },
    { kind: income(fondue), account: 'cash', amount: 118, entry_date: day(1), comment: '2 hlö', programme_item_id: fondue },
    { kind: 'cost_arrangement', account: 'cash', amount: -420, entry_date: day(1), comment: 'Ennakkomaksu Hochalm', programme_item_id: fondue, receipt: true },
    { kind: income(sledge), account: 'mobile', amount: 270, entry_date: day(1), comment: '6 hlö', programme_item_id: sledge },
    { kind: income(sledge), account: 'cash', amount: 45, entry_date: day(1), comment: '1 hlö', programme_item_id: sledge },
    { kind: 'income_other', account: 'mobile', amount: 480, entry_date: day(2), comment: 'Tiroli-ilta, liput', programme_item_id: tyrol },
    { kind: 'income_other', account: 'cash', amount: 64, entry_date: day(2), comment: 'Tiroli-ilta, liput', programme_item_id: tyrol },
    { kind: 'cost_arrangement', account: 'bankcard', amount: -312.5, entry_date: day(2), comment: 'Bussikuljetus, Taxi Hinterglemm', programme_item_id: fondue },
    { kind: income(hike), account: 'mobile', amount: 117, entry_date: day(2), comment: '3 hlö', programme_item_id: hike },
    { kind: 'cost_arrangement', account: 'bankcard', amount: -35.8, entry_date: day(2), comment: 'Eväät', programme_item_id: hike },
  ];
  // A cost tied to no programme item is an "other" cost.
  for (const row of sample) insertEntry({ trip_id: tripId, ...row, kind: row.kind === 'cost_arrangement' && !row.programme_item_id ? 'cost_other' : row.kind });
  saveStore('cash_entries');
  saveStore('cash_books');
}

const notInDemo = { message: 'Demo-tilassa kirjaudutaan demon salasanalla.' };

export function createDemoClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
      onAuthStateChange(listener: AuthListener) {
        authListeners.add(listener);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const result = await call<Session>('login', { email, password });
        if (result.data) setSession(result.data, 'SIGNED_IN');
        return { data: { session: result.data, user: result.data?.user ?? null }, error: result.error };
      },
      signInWithOtp: async () => ({ data: null, error: notInDemo }),
      verifyOtp: async () => ({ data: null, error: notInDemo }),
      async signOut() {
        await call('logout', {});
        setSession(null, 'SIGNED_OUT');
        return { error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
    from: (table: string) => new Query(table),
    rpc: (name: string, args: Record<string, unknown>) =>
      call('rpc', { name, args }).then((result) => {
        void poll();
        return result;
      }),
    channel: () => new Channel(),
    removeChannel: async (channel: Channel) => {
      channel.unsubscribe();
      return 'ok';
    },
  };
}
