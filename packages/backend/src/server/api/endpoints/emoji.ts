/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { EmojisRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../error.js';

export const meta = {
	tags: ['meta'],

	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,

	errors: {
		noSuchEmoji: {
			message: 'No such emoji.',
			code: 'NO_SUCH_EMOJI',
			id: 'a665f1e4-22d3-41f2-93f1-9dc5d7a2b1f0',
			httpStatusCode: 404,
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'EmojiDetailed',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: {
			type: 'string',
		},
	},
	required: ['name'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private emojiEntityService: EmojiEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const emoji = await this.emojisRepository.findOneBy({
				name: ps.name,
				host: IsNull(),
			});

			if (emoji == null) throw new ApiError(meta.errors.noSuchEmoji);

			return this.emojiEntityService.packDetailed(emoji);
		});
	}
}
