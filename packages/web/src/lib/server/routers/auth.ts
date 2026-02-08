import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON,
	AuthenticationResponseJSON
} from '@simplewebauthn/server/script/deps';
import {
	findUserByEmail,
	createUser,
	saveChallenge,
	getChallenge,
	deleteChallenge,
	createPasskey,
	findPasskeysByUserId,
	findPasskeyById,
	updatePasskeyCounter,
	createSession,
	deleteSession
} from '@pdf-splitter/database';

// Environment variables
const RP_ID = process.env.PUBLIC_RP_ID || 'localhost';
const RP_NAME = process.env.PUBLIC_RP_NAME || 'PDF Splitter';
const ORIGIN = process.env.PUBLIC_ORIGIN || 'http://localhost:5173';

// Rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(email: string): void {
	const now = Date.now();
	const key = email.toLowerCase();
	const record = rateLimitMap.get(key);

	if (!record || now > record.resetTime) {
		rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
		return;
	}

	if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
		throw new TRPCError({
			code: 'TOO_MANY_REQUESTS',
			message: 'Too many authentication attempts. Please try again later.'
		});
	}

	record.count++;
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [key, record] of rateLimitMap.entries()) {
		if (now > record.resetTime) {
			rateLimitMap.delete(key);
		}
	}
}, 5 * 60 * 1000);

export const authRouter = router({
	// Get registration options
	getRegistrationOptions: publicProcedure
		.input(z.object({ email: z.string().email() }))
		.mutation(async ({ input }): Promise<PublicKeyCredentialCreationOptionsJSON> => {
			checkRateLimit(input.email);

			// Find or create user
			let user = await findUserByEmail(input.email);
			if (!user) {
				user = await createUser(input.email);
			}

			// Get existing passkeys for this user
			const userPasskeys = await findPasskeysByUserId(user.id);

			// Generate registration options
			const options = await generateRegistrationOptions({
				rpName: RP_NAME,
				rpID: RP_ID,
				userID: new TextEncoder().encode(user.id),
				userName: user.email,
				attestationType: 'none',
				excludeCredentials: userPasskeys.map((passkey) => ({
					id: new TextEncoder().encode(passkey.id),
					type: 'public-key',
					transports: JSON.parse(passkey.transports)
				})),
				authenticatorSelection: {
					residentKey: 'preferred',
					userVerification: 'preferred'
				}
			});

			// Save challenge to database
			await saveChallenge(user.id, options.challenge, options.user.id);

			return options;
		}),

	// Verify registration
	verifyRegistration: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				registrationResponse: z.string()
			})
		)
		.mutation(async ({ input, ctx }) => {
			const user = await findUserByEmail(input.email);
			if (!user) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
			}

			// Get challenge from database
			const challengeRecord = await getChallenge(user.id);
			if (!challengeRecord) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Challenge not found or expired'
				});
			}

			const response: RegistrationResponseJSON = JSON.parse(input.registrationResponse);

			// Verify registration response
			let verification;
			try {
				verification = await verifyRegistrationResponse({
					response,
					expectedChallenge: challengeRecord.challenge,
					expectedOrigin: ORIGIN,
					expectedRPID: RP_ID
				});
			} catch (error) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Registration verification failed'
				});
			}

			if (!verification.verified || !verification.registrationInfo) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Registration verification failed'
				});
			}

			// Save passkey to database
			const { credential, credentialDeviceType, credentialBackedUp } =
				verification.registrationInfo;

			await createPasskey({
				id: credential.id,
				user_id: user.id,
				webauthn_user_id: challengeRecord.registration_options_user_id!,
				public_key: credential.publicKey,
				counter: credential.counter,
				device_type: credentialDeviceType,
				backed_up: credentialBackedUp,
				transports: response.response.transports || []
			});

			// Delete challenge
			await deleteChallenge(user.id);

			// Create session
			const sessionToken = await createSession(user.id);

			// Set session cookie
			ctx.cookies.set('session', sessionToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 * 7, // 7 days
				path: '/'
			});

			return { success: true };
		}),

	// Get login options
	getLoginOptions: publicProcedure
		.input(z.object({ email: z.string().email() }))
		.mutation(async ({ input }): Promise<PublicKeyCredentialRequestOptionsJSON> => {
			checkRateLimit(input.email);

			const user = await findUserByEmail(input.email);
			if (!user) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
			}

			// Get user's passkeys
			const userPasskeys = await findPasskeysByUserId(user.id);
			if (userPasskeys.length === 0) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'No passkeys found for this user'
				});
			}

			// Generate authentication options
			const options = await generateAuthenticationOptions({
				rpID: RP_ID,
				allowCredentials: userPasskeys.map((passkey) => ({
					id: new TextEncoder().encode(passkey.id),
					type: 'public-key',
					transports: JSON.parse(passkey.transports)
				})),
				userVerification: 'preferred'
			});

			// Save challenge to database
			await saveChallenge(user.id, options.challenge);

			return options;
		}),

	// Verify login
	verifyLogin: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				authenticationResponse: z.string()
			})
		)
		.mutation(async ({ input, ctx }) => {
			const user = await findUserByEmail(input.email);
			if (!user) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
			}

			// Get challenge from database
			const challengeRecord = await getChallenge(user.id);
			if (!challengeRecord) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Challenge not found or expired'
				});
			}

			const response: AuthenticationResponseJSON = JSON.parse(input.authenticationResponse);

			// Get passkey from database
			const passkey = await findPasskeyById(response.id);
			if (!passkey) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Passkey not found' });
			}

			// Verify passkey belongs to user
			if (passkey.user_id !== user.id) {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Passkey does not belong to user' });
			}

			// Verify authentication response
			let verification;
			try {
				verification = await verifyAuthenticationResponse({
					response,
					expectedChallenge: challengeRecord.challenge,
					expectedOrigin: ORIGIN,
					expectedRPID: RP_ID,
					credential: {
						id: passkey.id,
						publicKey: passkey.public_key,
						counter: passkey.counter
					}
				});
			} catch (error) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Authentication verification failed'
				});
			}

			if (!verification.verified) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Authentication verification failed'
				});
			}

			// Verify userHandle matches stored webauthn_user_id (prevents credential swapping)
			if (response.response.userHandle !== passkey.webauthn_user_id) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Invalid authentication credentials'
				});
			}

			// Update counter (prevents replay attacks)
			const { authenticationInfo } = verification;
			if (authenticationInfo.newCounter <= passkey.counter) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Invalid counter value (possible replay attack)'
				});
			}
			await updatePasskeyCounter(passkey.id, authenticationInfo.newCounter);

			// Delete challenge
			await deleteChallenge(user.id);

			// Create session
			const sessionToken = await createSession(user.id);

			// Set session cookie
			ctx.cookies.set('session', sessionToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 * 7, // 7 days
				path: '/'
			});

			return { success: true };
		}),

	// Logout
	logout: protectedProcedure.mutation(async ({ ctx }) => {
		const sessionToken = ctx.cookies.get('session');
		if (sessionToken) {
			await deleteSession(sessionToken);
		}

		ctx.cookies.delete('session', { path: '/' });

		return { success: true };
	})
});
