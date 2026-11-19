/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import sanitizeHtml from 'sanitize-html';

/**
 * サーバーから提供されるHTML（インスタンスの説明文・サーバールールなど）をサニタイズする。
 * 管理者が設定する信頼されたHTMLではあるが、サーバー侵害・設定不備時にXSSへと偽装される影響を抑えるため、
 * 最低限のサニタイズを行う。
 */
export function sanitizeServerProvidedHtml(html: string): string {
	return sanitizeHtml(html);
}
