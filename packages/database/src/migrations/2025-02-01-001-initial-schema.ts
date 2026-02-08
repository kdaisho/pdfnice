import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// Enable UUID generation extension
	await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

	// Users table
	await db.schema
		.createTable('users')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`)
		)
		.addColumn('email', 'text', (col) => col.notNull().unique())
		.addColumn('created_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`now()`)
		)
		.addColumn('operation_count', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('is_pro', 'boolean', (col) => col.notNull().defaultTo(false))
		.execute();

	// Sessions table
	await db.schema
		.createTable('sessions')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`)
		)
		.addColumn('user_id', 'uuid', (col) =>
			col.notNull().references('users.id').onDelete('cascade')
		)
		.addColumn('token', 'uuid', (col) =>
			col.notNull().unique().defaultTo(sql`gen_random_uuid()`)
		)
		.addColumn('expires_at', 'timestamptz', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`now()`)
		)
		.execute();

	// Create index on sessions.user_id for faster lookups
	await db.schema
		.createIndex('idx_sessions_user_id')
		.on('sessions')
		.column('user_id')
		.execute();

	// Create index on sessions.token for faster lookups
	await db.schema
		.createIndex('idx_sessions_token')
		.on('sessions')
		.column('token')
		.execute();

	// Passkeys table
	await db.schema
		.createTable('passkeys')
		.addColumn('id', 'text', (col) => col.primaryKey())
		.addColumn('user_id', 'uuid', (col) =>
			col.notNull().references('users.id').onDelete('cascade')
		)
		.addColumn('webauthn_user_id', 'text', (col) => col.notNull().unique())
		.addColumn('public_key', 'bytea', (col) => col.notNull())
		.addColumn('counter', 'bigint', (col) => col.notNull())
		.addColumn('device_type', 'varchar(32)', (col) => col.notNull())
		.addColumn('backed_up', 'boolean', (col) => col.notNull())
		.addColumn('transports', 'text', (col) => col.notNull())
		.addColumn('name', 'varchar(255)')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`now()`)
		)
		.execute();

	// Create index on passkeys.user_id for faster lookups
	await db.schema
		.createIndex('idx_passkeys_user_id')
		.on('passkeys')
		.column('user_id')
		.execute();

	// Current challenge table (temporary storage with TTL)
	await db.schema
		.createTable('current_challenge')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('user_id', 'uuid', (col) =>
			col.notNull().references('users.id').onDelete('cascade')
		)
		.addColumn('challenge', 'text', (col) => col.notNull())
		.addColumn('registration_options_user_id', 'text')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`now()`)
		)
		.addColumn('expires_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`now() + interval '5 minutes'`)
		)
		.execute();

	// Create index on current_challenge.user_id for faster lookups
	await db.schema
		.createIndex('idx_current_challenge_user_id')
		.on('current_challenge')
		.column('user_id')
		.execute();

	// Create index on current_challenge.created_at for TTL cleanup
	await db.schema
		.createIndex('idx_current_challenge_created_at')
		.on('current_challenge')
		.column('created_at')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('current_challenge').ifExists().execute();
	await db.schema.dropTable('passkeys').ifExists().execute();
	await db.schema.dropTable('sessions').ifExists().execute();
	await db.schema.dropTable('users').ifExists().execute();
}
