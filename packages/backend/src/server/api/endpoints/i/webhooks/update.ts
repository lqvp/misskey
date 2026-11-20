/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { WebhooksRepository } from '@/models/_.js';
import { webhookEventTypes } from '@/models/Webhook.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../../error.js';

export const meta = {
	tags: ['webhooks'],

	requireCredential: true,

	kind: 'write:account',

	errors: {
		invalidUrl: {
			message: 'Invalid URL.',
			code: 'INVALID_URL',
			id: '1e2c0bba-5e1e-4f1f-8b8c-6f9f8b0f1e2c',
		},
		noSuchWebhook: {
			message: 'No such webhook.',
			code: 'NO_SUCH_WEBHOOK',
			id: 'fb0fea69-da18-45b1-828d-bd4fd1612518',
		},
	},

} as const;

export const paramDef = {
	type: 'object',
	properties: {
		webhookId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 100 },
		url: { type: 'string', format: 'url', minLength: 1, maxLength: 1024 },
		secret: { type: 'string', nullable: true, maxLength: 1024 },
		on: { type: 'array', items: {
			type: 'string', enum: webhookEventTypes,
		} },
		active: { type: 'boolean' },
	},
	required: ['webhookId'],
} as const;

// TODO: ロジックをサービスに切り出す

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.webhooksRepository)
		private webhooksRepository: WebhooksRepository,

		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const webhook = await this.webhooksRepository.findOneBy({
				id: ps.webhookId,
				userId: me.id,
			});

			if (webhook == null) {
				throw new ApiError(meta.errors.noSuchWebhook);
			}

			if (ps.url != null) {
				let u: URL;
				try {
					u = new URL(ps.url);
				} catch {
					throw new ApiError(meta.errors.invalidUrl);
				}
				if (u.protocol !== 'http:' && u.protocol !== 'https:') {
					throw new ApiError(meta.errors.invalidUrl);
				}
			}

			await this.webhooksRepository.update(webhook.id, {
				name: ps.name,
				url: ps.url,
				secret: ps.secret === null ? '' : ps.secret,
				on: ps.on,
				active: ps.active,
			});

			const updated = await this.webhooksRepository.findOneBy({
				id: ps.webhookId,
				userId: me.id,
			});

			if (updated == null) {
				throw new ApiError(meta.errors.noSuchWebhook);
			}

			this.globalEventService.publishInternalEvent('webhookUpdated', updated);
		});
	}
}
