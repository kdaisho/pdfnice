import { db } from '../db.js';
import { sql } from 'kysely';
import type { Session } from '@pdf-splitter/shared-types';

export async function createSession(userId: string, expiresInDays: number = 7): Promise<string> {
	const result = await db
		.insertInto('sessions')
		.values({
			user_id: userId,
			expires_at: sql`now() + interval '${sql.raw(expiresInDays.toString())} days'`
		})
		.returning('token')
		.executeTakeFirstOrThrow();

	return result.token;
}

export async function findSessionByToken(token: string): Promise<Session | undefined> {
	const result = await db
		.selectFrom('sessions')
		.innerJoin('users', 'users.id', 'sessions.user_id')
		.select([
			'sessions.id',
			'sessions.user_id',
			'sessions.token',
			'sessions.expires_at',
			'sessions.created_at',
			'users.id as user.id',
			'users.email as user.email',
			'users.created_at as user.created_at',
			'users.operation_count as user.operation_count',
			'users.is_pro as user.is_pro'
		])
		.where('sessions.token', '=', token)
		.where('sessions.expires_at', '>', new Date())
		.executeTakeFirst();

	if (!result) {
		return undefined;
	}

	// Transform flat result into nested structure
	return {
		id: result.id,
		user_id: result.user_id,
		token: result.token,
		expires_at: result.expires_at,
		created_at: result.created_at,
		user: {
			id: result['user.id'],
			email: result['user.email'],
			created_at: result['user.created_at'],
			operation_count: result['user.operation_count'],
			is_pro: result['user.is_pro']
		}
	} as Session;
}

export async function deleteSession(token: string): Promise<void> {
	await db.deleteFrom('sessions').where('token', '=', token).execute();
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
	await db.deleteFrom('sessions').where('user_id', '=', userId).execute();
}
