/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
export class NoteUserIdChannelIdIndex1795117874780 {
    name = 'NoteUserIdChannelIdIndex1795117874780'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE INDEX "IDX_NOTE_USER_ID_CHANNEL_ID" ON "note"  ("userId", "channelId") `);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_NOTE_USER_ID_CHANNEL_ID"`);
    }
}
