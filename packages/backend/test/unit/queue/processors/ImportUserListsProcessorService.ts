/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { parseListName } from '@/queue/processors/ImportUserListsProcessorService.js';
import { formatCsvCell } from '@/queue/processors/ExportUserListsProcessorService.js';

describe(parseListName, () => {
	test('非引用フィールド: 最初のカンマまでをリスト名として解析する', () => {
		expect(parseListName('friends,@alice.example.com,withReplies=false')).toEqual({
			name: 'friends',
			rest: '@alice.example.com,withReplies=false',
		});
	});

	test('非引用フィールド: カンマが無い場合は行全体がリスト名になる', () => {
		expect(parseListName('friends')).toEqual({ name: 'friends', rest: '' });
	});

	test('引用符付きフィールド: カンマを含むリスト名を復元する', () => {
		expect(parseListName('"a,b",@alice.example.com,withReplies=false')).toEqual({
			name: 'a,b',
			rest: '@alice.example.com,withReplies=false',
		});
	});

	test('引用符付きフィールド: "" はエスケープであり閉じクォートとして扱わない', () => {
		expect(parseListName('"quoted ""name""",@alice.example.com,withReplies=false')).toEqual({
			name: 'quoted "name"',
			rest: '@alice.example.com,withReplies=false',
		});
	});

	test('引用符付きフィールド: カンマと引用符を混ぜた名前（=a,"b"）を復元する', () => {
		expect(parseListName('"=a,""b""",@alice.example.com,withReplies=true')).toEqual({
			name: '=a,"b"',
			rest: '@alice.example.com,withReplies=true',
		});
	});

	test('引用符付きフィールド: 改行を含む名前もそのまま復元する', () => {
		// 注: 呼び出し側で行単位に分割するため、parseListName に入るのは改行を含まない行が前提。
		// ここでは引用符付きフィールドとしての解析そのものを検証する。
		expect(parseListName('"a,b\nc",@alice.example.com,withReplies=false')).toEqual({
			name: 'a,b\nc',
			rest: '@alice.example.com,withReplies=false',
		});
	});

	test('引用符付きフィールド: 閉じクォートが見つからない場合は引用符付きとみなさず最初のカンマで分割する', () => {
		expect(parseListName('"abc,def')).toEqual({ name: '"abc', rest: 'def' });
	});

	test('数式インジェクション対策で前置されたシングルクォートを外す', () => {
		expect(parseListName('\'=cmd,@alice.example.com')).toEqual({ name: '=cmd', rest: '@alice.example.com' });
		expect(parseListName('\'+cmd,@alice.example.com')).toEqual({ name: '+cmd', rest: '@alice.example.com' });
		expect(parseListName('\'-cmd,@alice.example.com')).toEqual({ name: '-cmd', rest: '@alice.example.com' });
		expect(parseListName('\'@cmd,@alice.example.com')).toEqual({ name: '@cmd', rest: '@alice.example.com' });
	});

	test('シングルクォートの後に数式プレフィックスが続かない場合はシングルクォートを維持する', () => {
		expect(parseListName('\'friends,@alice.example.com')).toEqual({ name: '\'friends', rest: '@alice.example.com' });
	});
});

describe('ExportUserListsProcessorService.formatCsvCell との往復', () => {
	// エクスポート時は formatCsvCell がリスト名をクォート・エスケープし、
	// インポート時は parseListName がそれを復元する。1往復で元のリスト名に戻ることを検証する。
	const acct = '@alice.example.com,withReplies=false';

	test.each([
		['friends'],
		['=cmd'],
		['+cmd'],
		['-cmd'],
		['@cmd'],
		['\t'],
		['\r'],
		['a,b'],
		['a\nb'],
		['quote "name"'],
		['quoted ""name"""'],
		['=a,"b"'],
		['a,"b",c\n=d\t+e'],
		['\'friends'],
	])('リスト名 %p をエクスポートしてインポートすると元に戻る', (name) => {
		const line = `${formatCsvCell(name)},${acct}`;
		expect(parseListName(line)).toEqual({ name, rest: acct });
	});
});
