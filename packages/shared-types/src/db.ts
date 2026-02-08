// Kysely database schema types
import type { ColumnType } from 'kysely';

// Helper for timestamp columns
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
	? ColumnType<S, I | undefined, U>
	: ColumnType<T, T | undefined, T>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

// Table types
export interface UsersTable {
	id: Generated<string>;
	email: string;
	created_at: Generated<Timestamp>;
	operation_count: Generated<number>;
	is_pro: Generated<boolean>;
}

export interface SessionsTable {
	id: Generated<string>;
	user_id: string;
	token: Generated<string>;
	expires_at: Timestamp;
	created_at: Generated<Timestamp>;
}

export interface PasskeysTable {
	id: string;
	user_id: string;
	webauthn_user_id: string;
	public_key: Uint8Array;
	counter: number;
	device_type: string;
	backed_up: boolean;
	transports: string;
	name: string | null;
	created_at: Generated<Timestamp>;
}

export interface CurrentChallengeTable {
	id: Generated<number>;
	user_id: string;
	challenge: string;
	registration_options_user_id: string | null;
	created_at: Generated<Timestamp>;
	expires_at: Timestamp;
}

// Database interface
export interface Database {
	users: UsersTable;
	sessions: SessionsTable;
	passkeys: PasskeysTable;
	current_challenge: CurrentChallengeTable;
}
