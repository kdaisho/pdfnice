// src/hooks.server.ts
//
// SvelteKit server hooks - runs on every request before route handlers.
// Used for session validation and populating event.locals.user.

import type { Handle } from '@sveltejs/kit';
// import { db } from '$lib/server/db/client';
// import { sessions, users } from '$lib/server/db/schema';
// import { eq, gt, and } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionToken = event.cookies.get('session');

  if (sessionToken) {
    // Validate session against database
    // const session = await db.query.sessions.findFirst({
    //   where: and(
    //     eq(sessions.token, sessionToken),
    //     gt(sessions.expires_at, new Date())
    //   ),
    //   with: {
    //     user: true,
    //   },
    // });

    // Mock session for example
    const session = {
      user: {
        id: 'user-id',
        email: 'user@example.com',
        is_pro: false,
        usage_count_today: 3,
        last_reset_date: new Date().toISOString().split('T')[0],
      },
    };

    if (session?.user) {
      // Reset daily usage count if needed
      // const today = new Date().toISOString().split('T')[0];
      // if (session.user.last_reset_date !== today) {
      //   await db.update(users)
      //     .set({ usage_count_today: 0, last_reset_date: today })
      //     .where(eq(users.id, session.user.id));
      //   session.user.usage_count_today = 0;
      // }

      // Attach user to locals for access in routes
      event.locals.user = session.user;
    }
  }

  return resolve(event);
};

// -------------------------------------------------------------------
// TypeScript type augmentation for event.locals
// Add to src/app.d.ts:
// -------------------------------------------------------------------

// declare global {
//   namespace App {
//     interface Locals {
//       user?: {
//         id: string;
//         email: string;
//         is_pro: boolean;
//         usage_count_today: number;
//       };
//     }
//   }
// }
//
// export {};
