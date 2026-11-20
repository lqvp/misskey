/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import sanitizeHtml from 'sanitize-html';

/**
 * サーバー設定由来のHTMLを描画する際のサニタイズ。
 * 生のv-html描画は、meta APIの改ざんや設定ミス時にイベントハンドラ系XSSが成立し得るため、
 * 基本的にこれを通すこと。
 */
export function sanitizeServerHtml(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
			a: ['href', 'title', 'target', 'rel'],
		},
		allowedSchemes: ['http', 'https', 'data'],
		transformTags: {
			a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
		},
	});
}
