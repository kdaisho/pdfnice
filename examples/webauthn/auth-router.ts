// src/lib/server/routers/auth.ts
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';

const { RP_ID, ORIGIN } = process.env;

export const authRouter = router({
  // Registration Step 1: Generate challenge
  getRegistrationOptions: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      // 1. Check rate limiting
      // checkRateLimit(input.email);

      // 2. Find or create user
      // const user = await findUserByEmail(input.email);
      // if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      // 3. Get existing passkeys to exclude
      // const userPasskeys = await getUserPasskeys(user);

      // 4. Generate registration options
      const options = await generateRegistrationOptions({
        rpName: 'PDF Splitter',
        rpID: RP_ID!,
        userName: 'user.email', // Replace with actual user.email
        attestationType: 'none',
        // excludeCredentials: userPasskeys.map(...),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform', // Prefer Touch ID/Face ID
        },
      });

      // 5. Store challenge temporarily
      // await saveChallenge(user.id, options.challenge, options.user.id);

      return options;
    }),

  // Registration Step 2: Verify response
  verifyRegistration: publicProcedure
    .input(z.object({
      email: z.string().email(),
      registrationResponse: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Find user and challenge
      // const user = await findUserByEmail(input.email);
      // const challenge = await getChallenge(user.id);

      // 2. Parse response
      const data = JSON.parse(input.registrationResponse);

      // 3. Verify registration
      const verification = await verifyRegistrationResponse({
        response: data,
        expectedChallenge: 'challenge.challenge', // Replace with actual challenge
        expectedOrigin: ORIGIN!,
        expectedRPID: RP_ID!,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

        // 4. Save passkey to database
        // await savePasskey({
        //   user_id: user.id,
        //   id: credential.id,
        //   webauthn_user_id: challenge.registration_options_user_id,
        //   public_key: credential.publicKey,
        //   counter: credential.counter,
        //   device_type: credentialDeviceType,
        //   backed_up: credentialBackedUp,
        //   transports: data.response.transports,
        // });

        // 5. Create session
        // const sessionToken = await createSession(user.id);

        // 6. Set httpOnly cookie
        // ctx.cookies.set('session', sessionToken, {
        //   httpOnly: true,
        //   secure: true,
        //   sameSite: 'strict',
        //   maxAge: 60 * 60 * 24 * 7, // 7 days
        //   path: '/',
        // });

        // 7. Delete challenge (one-time use)
        // await deleteChallenge(challenge.id, user.id);

        return { success: true };
      }

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Verification failed' });
    }),

  // Login Step 1: Generate authentication challenge
  getLoginOptions: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      // Implementation similar to getRegistrationOptions
      // Use generateAuthenticationOptions() instead
      return { challenge: 'example' };
    }),

  // Login Step 2: Verify authentication
  verifyLogin: publicProcedure
    .input(z.object({
      email: z.string().email(),
      authenticationResponse: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Implementation similar to verifyRegistration
      // Use verifyAuthenticationResponse() instead
      // Validate counter increment
      // Update counter in database
      return { success: true };
    }),
});
