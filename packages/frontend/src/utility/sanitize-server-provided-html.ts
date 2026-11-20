/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import sanitizeHtml from 'sanitize-html';

/**
 * サーバーから提供されるHTML（インスタンスの説明文・サーバールールなど）をサニタイズする。
 * 管理者が設定する信頼されたHTMLではあるが、サーバー侵害・設定不備時にXSSへと偽装される影響を抑えるため、
 * 最低限のサニタイズを行う。
 *
 * 許可はデフォルトの設定に img のみ追加し、スキームは http/https/data に限定してプロトコル相対URLを拒否する。
 * また a タグには rel="noopener noreferrer" を強制する。
 */
export function sanitizeServerProvidedHtml(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
			a: ['href', 'title', 'target', 'rel'],
		},
		allowedSchemes: ['http', 'https', 'data'],
		allowProtocolRelative: false,
		transformTags: {
			a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
		},
	});
}
