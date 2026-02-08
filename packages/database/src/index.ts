// Export database instance
export { db } from './db.js';

// Export repository functions
export {
	findUserByEmail,
	findUserById,
	createUser,
	checkRateLimit,
	incrementOperationCount,
	resetOperationCount
} from './repositories/users.js';

export {
	createSession,
	findSessionByToken,
	deleteSession,
	deleteAllUserSessions
} from './repositories/sessions.js';

export {
	createPasskey,
	findPasskeyById,
	findPasskeysByUserId,
	findPasskeyByWebAuthnUserId,
	updatePasskeyCounter,
	deletePasskey,
	type CreatePasskeyData
} from './repositories/passkeys.js';

export {
	saveChallenge,
	getChallenge,
	deleteChallenge,
	cleanupExpiredChallenges
} from './repositories/challenges.js';
