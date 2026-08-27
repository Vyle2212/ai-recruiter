export type WritableCookie = { name: string; value: string; options?: Record<string, unknown> };
export type ServerCookieStore = {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

export function buildSupabaseServerCookieAdapter(store: ServerCookieStore) {
  return {
    getAll() { return store.getAll(); },
    setAll(cookiesToSet: WritableCookie[]) {
      cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
    },
  };
}