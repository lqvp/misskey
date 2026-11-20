/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import { sanitizeServerProvidedHtml } from '@/utility/sanitize-server-provided-html.js';

describe('sanitizeServerProvidedHtml', () => {
	test('script要素は除去される', () => {
		assert.strictEqual(sanitizeServerProvidedHtml('<p>テキスト</p><script>alert(1)</script>'), '<p>テキスト</p>');
	});

	test('img要素は除去されず残る', () => {
		const result = sanitizeServerProvidedHtml('<img src="https://example.com/a.png" alt="代替テキスト">');

		assert.ok(result.includes('<img'));
		assert.ok(result.includes('src="https://example.com/a.png"'));
		assert.ok(result.includes('alt="代替テキスト"'));
	});

	test('a要素のtargetを尊重しつつ rel="noopener noreferrer" を強制する', () => {
		const result = sanitizeServerProvidedHtml('<a href="https://example.com/" target="_blank">リンク</a>');

		assert.ok(result.includes('target="_blank"'));
		assert.ok(result.includes('rel="noopener noreferrer"'));
	});

	test('a要素に入力されたrelは noopener noreferrer で上書きされる', () => {
		const result = sanitizeServerProvidedHtml('<a href="https://example.com/" rel="opener">リンク</a>');

		assert.ok(result.includes('rel="noopener noreferrer"'));
		assert.ok(!result.includes('rel="opener"'));
	});

	test('プロトコル相対URLは拒否される', () => {
		const result = sanitizeServerProvidedHtml('<a href="//evil.example/">リンク</a><img src="//evil.example/a.png">');

		assert.ok(!result.includes('evil.example'));
	});

	test('javascript: スキームは拒否される', () => {
		const result = sanitizeServerProvidedHtml('<a href="javascript:alert(1)">リンク</a>');

		assert.ok(!result.includes('javascript:'));
		assert.ok(!result.includes('href="javascript'));
	});

	test('data: スキームの画像は許可される', () => {
		const result = sanitizeServerProvidedHtml('<img src="data:image/png;base64,iVBOR">');

		assert.ok(result.includes('data:image/png;base64,iVBOR'));
	});
});
