import { db } from '../db.js';
import { sql } from 'kysely';
import type { CurrentChallenge } from '@pdf-splitter/shared-types';

export async function saveChallenge(
	userId: string,
	challenge: string,
	registrationOptionsUserId?: string
): Promise<void> {
	// Delete existing challenges for this user (prevent multiple active challenges)
	await db.deleteFrom('current_challenge').where('user_id', '=', userId).execute();

	// Insert new challenge with 5-minute TTL
	await db
		.insertInto('current_challenge')
		.values({
			user_id: userId,
			challenge,
			registration_options_user_id: registrationOptionsUserId || null,
			expires_at: sql`now() + interval '5 minutes'`
		})
		.execute();
}

export async function getChallenge(userId: string): Promise<CurrentChallenge | undefined> {
	const result = await db
		.selectFrom('current_challenge')
		.selectAll()
		.where('user_id', '=', userId)
		.where('expires_at', '>', new Date())
		.orderBy('created_at', 'desc')
		.executeTakeFirst();

	return result as CurrentChallenge | undefined;
}

export async function deleteChallenge(userId: string): Promise<void> {
	await db.deleteFrom('current_challenge').where('user_id', '=', userId).execute();
}

export async function cleanupExpiredChallenges(): Promise<void> {
	await db
		.deleteFrom('current_challenge')
		.where('expires_at', '<', new Date())
		.execute();
}
