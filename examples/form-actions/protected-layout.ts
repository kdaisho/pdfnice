// src/routes/(authed)/+layout.server.ts
//
// This layout runs for all routes under (authed)/ and enforces authentication.
// If user is not logged in, they're redirected to signin page.

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // User is populated by hooks.server.ts if session cookie is valid
  if (!locals.user) {
    // Preserve the original URL so we can redirect back after login
    const redirectTo = url.pathname + url.search;
    redirect(303, `/signin?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  // Make user data available to all child routes
  return {
    user: {
      id: locals.user.id,
      email: locals.user.email,
      is_pro: locals.user.is_pro ?? false,
      usage_count_today: locals.user.usage_count_today ?? 0,
    },
  };
};

// -------------------------------------------------------------------
// For Pro-only routes (Phase 3), create a nested route group:
// src/routes/(authed)/(pro)/+layout.server.ts
// -------------------------------------------------------------------

// import { redirect } from '@sveltejs/kit';
// import type { LayoutServerLoad } from './$types';
//
// export const load: LayoutServerLoad = async ({ locals }) => {
//   if (!locals.user?.is_pro) {
//     redirect(303, '/billing?upgrade=true');
//   }
//   return {};
// };
