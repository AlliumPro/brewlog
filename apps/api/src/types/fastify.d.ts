declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Marks a route as reachable without a session. Absent or false means the auth hook
     * rejects the request — the gate is opt-out, never opt-in, so a new route is protected
     * by default even if its author forgets to think about it.
     */
    public?: boolean;
  }
}

export {};
