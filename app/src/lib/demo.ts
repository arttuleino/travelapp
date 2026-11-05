/**
 * Demo mode (EXPO_PUBLIC_DEMO_MODE=1): a small stand-in for the Supabase client that talks to the
 * demo API built into the Ski Assist web server (server.js on the DanBot host) instead of Supabase.
 * Everyone signed in to the same server shares one sample trip, so a guide's edits and messages
 * reach travellers on other devices within a few seconds.
 *
 * It covers only the client calls this app makes: auth, from(...).select/insert/update/delete with
 * eq/order/limit, rpc(...) and realtime channels (emulated by polling for changes).
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
  op: 'select' | 'insert' | 'update' | 'delete';
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
    return call<T>('query', this.spec)
      .then((result) => {
        if (write) void poll(); // show our own change without waiting for the next poll
        // Writes return the affected rows; their number stands in for Supabase's `count`.
        return write ? { ...result, count: Array.isArray(result.data) ? result.data.length : 0 } : result;
      })
      .then(onFulfilled, onRejected);
  }
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
