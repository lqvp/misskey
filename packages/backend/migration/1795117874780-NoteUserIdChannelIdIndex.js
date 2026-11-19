/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const isConcurrentIndexMigrationEnabled = process.env.MISSKEY_MIGRATION_CREATE_INDEX_CONCURRENTLY === '1';

export class NoteUserIdChannelIdIndex1795117874780 {
	name = 'NoteUserIdChannelIdIndex1795117874780';
	transaction = isConcurrentIndexMigrationEnabled ? false : undefined;

	async up(queryRunner) {
		if (isConcurrentIndexMigrationEnabled) {
			const hasValidIndex = await queryRunner.query(`SELECT indisvalid FROM pg_index INNER JOIN pg_class ON pg_index.indexrelid = pg_class.oid WHERE pg_class.relname = 'IDX_NOTE_USER_ID_CHANNEL_ID'`);
			if (hasValidIndex.length === 0 || hasValidIndex[0].indisvalid !== true) {
				await queryRunner.query(`DROP INDEX IF EXISTS "IDX_NOTE_USER_ID_CHANNEL_ID"`);
				await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_NOTE_USER_ID_CHANNEL_ID" ON "note" ("userId", "channelId")`);
			}
		} else {
			await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_NOTE_USER_ID_CHANNEL_ID" ON "note" ("userId", "channelId")`);
		}
	}

	async down(queryRunner) {
		const concurrently = isConcurrentIndexMigrationEnabled ? 'CONCURRENTLY' : '';

		await queryRunner.query(`DROP INDEX ${concurrently} IF EXISTS "public"."IDX_NOTE_USER_ID_CHANNEL_ID"`);
	}
}
