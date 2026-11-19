/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { DriveFilesRepository } from '@/models/_.js';
import { DriveService } from '@/core/DriveService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:federation',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		host: { type: 'string' },
	},
	required: ['host'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private driveService: DriveService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// 一括で全件メモリロードすると大規模ホストでOOMするため、ページング処理する
			const CHUNK_SIZE = 100;
			while (true) {
				const files = await this.driveFilesRepository.find({
					where: { userHost: ps.host },
					take: CHUNK_SIZE,
				});
				if (files.length === 0) break;

				for (const file of files) {
					await this.driveService.deleteFile(file);
				}
			}
		});
	}
}
