import { db } from '../db.js';
import type { Passkey } from '@pdf-splitter/shared-types';

export interface CreatePasskeyData {
	id: string;
	user_id: string;
	webauthn_user_id: string;
	public_key: Uint8Array;
	counter: number;
	device_type: 'singleDevice' | 'multiDevice';
	backed_up: boolean;
	transports: string[];
	name?: string;
}

export async function createPasskey(data: CreatePasskeyData): Promise<Passkey> {
	const result = await db
		.insertInto('passkeys')
		.values({
			id: data.id,
			user_id: data.user_id,
			webauthn_user_id: data.webauthn_user_id,
			public_key: Buffer.from(data.public_key),
			counter: data.counter,
			device_type: data.device_type,
			backed_up: data.backed_up,
			transports: JSON.stringify(data.transports),
			name: data.name || null
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	return {
		...result,
		public_key: new Uint8Array(result.public_key)
	} as Passkey;
}

export async function findPasskeyById(id: string): Promise<Passkey | undefined> {
	const result = await db
		.selectFrom('passkeys')
		.selectAll()
		.where('id', '=', id)
		.executeTakeFirst();

	if (!result) {
		return undefined;
	}

	return {
		...result,
		public_key: new Uint8Array(result.public_key)
	} as Passkey;
}

export async function findPasskeysByUserId(userId: string): Promise<Passkey[]> {
	const results = await db
		.selectFrom('passkeys')
		.selectAll()
		.where('user_id', '=', userId)
		.execute();

	return results.map((result) => ({
		...result,
		public_key: new Uint8Array(result.public_key)
	})) as Passkey[];
}

export async function findPasskeyByWebAuthnUserId(
	webauthnUserId: string
): Promise<Passkey | undefined> {
	const result = await db
		.selectFrom('passkeys')
		.selectAll()
		.where('webauthn_user_id', '=', webauthnUserId)
		.executeTakeFirst();

	if (!result) {
		return undefined;
	}

	return {
		...result,
		public_key: new Uint8Array(result.public_key)
	} as Passkey;
}

export async function updatePasskeyCounter(id: string, counter: number): Promise<void> {
	await db.updateTable('passkeys').set({ counter }).where('id', '=', id).execute();
}

export async function deletePasskey(id: string): Promise<void> {
	await db.deleteFrom('passkeys').where('id', '=', id).execute();
}
