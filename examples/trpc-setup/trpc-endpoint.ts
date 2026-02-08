// src/routes/api/trpc/[...trpc]/+server.ts
import { createContext } from '$lib/server/trpc';
import { appRouter } from '$lib/server/routers/_app';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { RequestHandler } from './$types';

const handler: RequestHandler = (event) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: event.request,
    router: appRouter,
    createContext: () => createContext(event),
  });

export const GET = handler;
export const POST = handler;
