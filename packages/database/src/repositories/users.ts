import { db } from '../db.js';
import type { User } from '@pdf-splitter/shared-types';

export async function findUserByEmail(email: string): Promise<User | undefined> {
	const result = await db
		.selectFrom('users')
		.selectAll()
		.where('email', '=', email)
		.executeTakeFirst();

	return result as User | undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
	const result = await db
		.selectFrom('users')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();

	return result as User | undefined;
}

export async function createUser(email: string): Promise<User> {
	const result = await db
		.insertInto('users')
		.values({
			email,
			operation_count: 0,
			is_pro: false
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	return result as User;
}

export async function checkRateLimit(userId: string, limit: number): Promise<boolean> {
	const user = await findUserById(userId);
	if (!user) {
		return false;
	}
	return user.operation_count < limit;
}

export async function incrementOperationCount(userId: string): Promise<void> {
	await db
		.updateTable('users')
		.set((eb) => ({
			operation_count: eb('operation_count', '+', 1)
		}))
		.where('id', '=', userId)
		.execute();
}

export async function resetOperationCount(userId: string): Promise<void> {
	await db
		.updateTable('users')
		.set({
			operation_count: 0
		})
		.where('id', '=', userId)
		.execute();
}
