// src/routes/setup/+page.server.ts
// Registration form actions for passkey setup
//
// NOTE: This file is renamed from auth-router.ts for backwards compatibility.
// See examples/form-actions/auth-actions.ts for the login flow.

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { Actions, PageServerLoad } from './$types';

const { RP_ID, RP_NAME, ORIGIN } = process.env;

const emailSchema = z.object({
  email: z.string().email(),
});

// Ensure user is logged in to register additional passkeys
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/signin');
  }

  // Get existing passkeys for display
  // const passkeys = await getUserPasskeys(locals.user.id);

  return {
    user: locals.user,
    // passkeys,
  };
};

export const actions: Actions = {
  // Registration Step 1: Generate challenge
  getOptions: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Not authenticated' });
    }

    // Get existing passkeys to exclude (can't register same authenticator twice)
    // const userPasskeys = await getUserPasskeys(locals.user.id);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME ?? 'PDF Splitter',
      rpID: RP_ID!,
      userName: locals.user.email,
      attestationType: 'none',
      // excludeCredentials: userPasskeys.map((passkey) => ({
      //   id: passkey.id,
      //   transports: passkey.transports,
      // })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Prefer Touch ID/Face ID
      },
    });

    // Store challenge temporarily (5-minute TTL)
    // await saveChallenge(locals.user.id, options.challenge, options.user.id);

    return { options };
  },

  // Registration Step 2: Verify response and save passkey
  verify: async ({ request, locals, cookies }) => {
    if (!locals.user) {
      return fail(401, { error: 'Not authenticated' });
    }

    const formData = await request.formData();
    const responseJson = formData.get('response') as string;
    const name = formData.get('name') as string; // Optional passkey nickname

    if (!responseJson) {
      return fail(400, { error: 'Missing response' });
    }

    const response = JSON.parse(responseJson);

    // 1. Get stored challenge
    // const challenge = await getChallenge(locals.user.id);
    // if (!challenge) return fail(400, { error: 'Challenge expired' });

    // 2. Verify the registration response
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: 'challenge.challenge', // Replace with actual
      expectedOrigin: ORIGIN!,
      expectedRPID: RP_ID!,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return fail(400, { error: 'Verification failed' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // 3. Save passkey to database
    // await savePasskey({
    //   id: credential.id,
    //   user_id: locals.user.id,
    //   webauthn_user_id: challenge.registration_options_user_id,
    //   public_key: credential.publicKey,
    //   counter: credential.counter,
    //   device_type: credentialDeviceType,
    //   backed_up: credentialBackedUp,
    //   transports: response.response.transports,
    //   name: name || 'Passkey',
    // });

    // 4. Delete challenge (one-time use)
    // await deleteChallenge(locals.user.id);

    return { success: true, message: 'Passkey registered successfully' };
  },

  // Rename a passkey
  rename: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Not authenticated' });
    }

    const formData = await request.formData();
    const passkeyId = formData.get('passkeyId') as string;
    const name = formData.get('name') as string;

    if (!passkeyId || !name) {
      return fail(400, { error: 'Missing fields' });
    }

    // await renamePasskey(passkeyId, locals.user.id, name);

    return { success: true };
  },

  // Delete a passkey
  delete: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { error: 'Not authenticated' });
    }

    const formData = await request.formData();
    const passkeyId = formData.get('passkeyId') as string;

    if (!passkeyId) {
      return fail(400, { error: 'Missing passkey ID' });
    }

    // Ensure user has at least one other passkey
    // const passkeys = await getUserPasskeys(locals.user.id);
    // if (passkeys.length <= 1) {
    //   return fail(400, { error: 'Cannot delete your only passkey' });
    // }

    // await deletePasskey(passkeyId, locals.user.id);

    return { success: true };
  },
};
