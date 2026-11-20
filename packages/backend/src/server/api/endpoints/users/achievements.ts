/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '../../error.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';

export const meta = {
	requireCredential: false,

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '4362f8dc-731f-4ad8-a694-be5a88922a24',
			httpStatusCode: 404,
		},
	},

	res: {
		type: 'array',
		items: {
			ref: 'Achievement',
		},
	},

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '9ae5f2b6-5c97-4c7f-91b4-ebc6f274b7f1',
			httpStatusCode: 404,
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneBy({ userId: ps.userId });

			if (profile == null) {
				throw new ApiError(meta.errors.noSuchUser);
			}

			return profile.achievements;
		});
	}
}
