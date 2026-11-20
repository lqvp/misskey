/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { RegistryApiService } from '@/core/RegistryApiService.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '../../../error.js';

export const meta = {
	requireCredential: true,
	kind: 'write:account',

	errors: {
		valueIsTooBig: {
			message: 'The value is too big.',
			code: 'VALUE_IS_TOO_BIG',
			id: 'f7dd41ac-6e5f-4d4d-8e75-2e7b6b0f9a6a',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		key: { type: 'string', minLength: 1, maxLength: 1024 },
		value: {},
		scope: { type: 'array', default: [], maxItems: 32, items: {
			type: 'string', maxLength: 128, pattern: /^[a-zA-Z0-9_]+$/.toString().slice(1, -1),
		} },
		domain: { type: 'string', nullable: true },
	},
	required: ['key', 'value', 'scope'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private registryApiService: RegistryApiService,
	) {
		super(meta, paramDef, async (ps, me, accessToken) => {
			try {
				await this.registryApiService.set(me.id, accessToken ? accessToken.id : (ps.domain ?? null), ps.scope, ps.key, ps.value);
			} catch (e) {
				if (e instanceof IdentifiableError && e.id === meta.errors.valueIsTooBig.id) {
					throw new ApiError(meta.errors.valueIsTooBig);
				}
				throw e;
			}
		});
	}
}
