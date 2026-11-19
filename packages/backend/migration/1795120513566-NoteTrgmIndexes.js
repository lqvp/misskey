/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const isConcurrentIndexMigrationEnabled = process.env.MISSKEY_MIGRATION_CREATE_INDEX_CONCURRENTLY === '1';

export class NoteTrgmIndexes1795120513566 {
	name = 'NoteTrgmIndexes1795120513566';
	transaction = isConcurrentIndexMigrationEnabled ? false : undefined;

	async up(queryRunner) {
		try {
			await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
		} catch (err) {
			// pg_trgm 拡張が利用できない環境（権限不足など）では、インデックス作成をスキップする
			console.warn(`pg_trgm extension is not available, skipping trgm indexes: ${err instanceof Error ? err.message : err}`);
			return;
		}

		if (isConcurrentIndexMigrationEnabled) {
			await queryRunner.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_NOTE_TEXT_TRGM" ON "note" USING gin ("text" gin_trgm_ops)');
			await queryRunner.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_NOTE_CW_TRGM" ON "note" USING gin ("cw" gin_trgm_ops)');
		} else {
			await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_NOTE_TEXT_TRGM" ON "note" USING gin ("text" gin_trgm_ops)');
			await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_NOTE_CW_TRGM" ON "note" USING gin ("cw" gin_trgm_ops)');
		}
	}

	async down(queryRunner) {
		const concurrently = isConcurrentIndexMigrationEnabled ? 'CONCURRENTLY' : '';

		await queryRunner.query(`DROP INDEX ${concurrently} IF EXISTS "public"."IDX_NOTE_CW_TRGM"`);
		await queryRunner.query(`DROP INDEX ${concurrently} IF EXISTS "public"."IDX_NOTE_TEXT_TRGM"`);
		// 拡張自体は他の用途で使われる可能性があるため残す
	}
}
