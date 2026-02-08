import { Migrator, FileMigrationProvider } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateDown() {
	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: path.join(__dirname, '../migrations')
		})
	});

	const { error, results } = await migrator.migrateDown();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			console.log(`✓ Migration "${it.migrationName}" was rolled back successfully`);
		} else if (it.status === 'Error') {
			console.error(`✗ Failed to roll back migration "${it.migrationName}"`);
		}
	});

	if (error) {
		console.error('Failed to migrate down');
		console.error(error);
		process.exit(1);
	}

	await db.destroy();
	console.log('\n✓ Migration rollback completed successfully');
}

migrateDown();
