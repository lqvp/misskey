/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const isConcurrentIndexMigrationEnabled = process.env.MISSKEY_MIGRATION_CREATE_INDEX_CONCURRENTLY === '1';

export class NoteTrgmIndexes1795120513566 {
	name = 'NoteTrgmIndexes1795120513566';
	transaction = isConcurrentIndexMigrationEnabled ? false : undefined;

	async up(queryRunner) {
		// pg_trgm 拡張の作成に失敗した場合（権限不足など）はインデックス作成をスキップする。
		// なお、非CONCURRENTLYモードでは全マイグレーションが1トランザクションで実行されるため、
		// 拡張作成の失敗でトランザクションが中断状態にならないようセーブポイントで保護する。
		if (isConcurrentIndexMigrationEnabled) {
			try {
				await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
			} catch (err) {
				console.warn(`pg_trgm extension is not available, skipping trgm indexes: ${err instanceof Error ? err.message : err}`);
				return;
			}
		} else {
			await queryRunner.query('SAVEPOINT create_pg_trgm_ext');
			try {
				await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
			} catch (err) {
				await queryRunner.query('ROLLBACK TO SAVEPOINT create_pg_trgm_ext');
				await queryRunner.query('RELEASE SAVEPOINT create_pg_trgm_ext');
				console.warn(`pg_trgm extension is not available, skipping trgm indexes: ${err instanceof Error ? err.message : err}`);
				return;
			}
			await queryRunner.query('RELEASE SAVEPOINT create_pg_trgm_ext');
		}

		await this.ensureValidIndex(queryRunner, 'IDX_NOTE_TEXT_TRGM', 'text');
		await this.ensureValidIndex(queryRunner, 'IDX_NOTE_CW_TRGM', 'cw');
	}

	async down(queryRunner) {
		const concurrently = isConcurrentIndexMigrationEnabled ? 'CONCURRENTLY' : '';

		await queryRunner.query(`DROP INDEX ${concurrently} IF EXISTS "public"."IDX_NOTE_CW_TRGM"`);
		await queryRunner.query(`DROP INDEX ${concurrently} IF EXISTS "public"."IDX_NOTE_TEXT_TRGM"`);
		// 拡張自体は他の用途で使われる可能性があるため残す
	}

	async ensureValidIndex(queryRunner, indexName, columnName) {
		if (isConcurrentIndexMigrationEnabled) {
			// CONCURRENTLYで作成中に失敗したインデックスはINVALIDのまま残るため、再作成する
			const hasValidIndex = await queryRunner.query(`SELECT indisvalid FROM pg_index INNER JOIN pg_class ON pg_index.indexrelid = pg_class.oid WHERE pg_class.relname = '${indexName}'`);
			if (hasValidIndex.length === 0 || hasValidIndex[0].indisvalid !== true) {
				await queryRunner.query(`DROP INDEX IF EXISTS "${indexName}"`);
				await queryRunner.query(`CREATE INDEX CONCURRENTLY "${indexName}" ON "note" USING gin ("${columnName}" gin_trgm_ops)`);
			}
		} else {
			await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "note" USING gin ("${columnName}" gin_trgm_ops)`);
		}
	}
}
