/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as Proto from '../protocol';
import * as PConst from '../protocol.const';
import { ITypeScriptServiceClient } from '../typescriptService';
import * as typeConverters from '../utils/typeConverters';

const getSymbolKind = (kind: string): vscode.SymbolKind => {
	switch (kind) {
		case PConst.Kind.module: return vscode.SymbolKind.Module;
		case PConst.Kind.class: return vscode.SymbolKind.Class;
		case PConst.Kind.enum: return vscode.SymbolKind.Enum;
		case PConst.Kind.interface: return vscode.SymbolKind.Interface;
		case PConst.Kind.memberFunction: return vscode.SymbolKind.Method;
		case PConst.Kind.memberVariable: return vscode.SymbolKind.Property;
		case PConst.Kind.memberGetAccessor: return vscode.SymbolKind.Property;
		case PConst.Kind.memberSetAccessor: return vscode.SymbolKind.Property;
		case PConst.Kind.variable: return vscode.SymbolKind.Variable;
		case PConst.Kind.const: return vscode.SymbolKind.Variable;
		case PConst.Kind.localVariable: return vscode.SymbolKind.Variable;
		case PConst.Kind.variable: return vscode.SymbolKind.Variable;
		case PConst.Kind.function: return vscode.SymbolKind.Function;
		case PConst.Kind.localFunction: return vscode.SymbolKind.Function;
	}
	return vscode.SymbolKind.Variable;
};

class TypeScriptDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
	public constructor(
		private readonly client: ITypeScriptServiceClient
	) { }

	public async provideDocumentSymbols(resource: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentSymbol[] | undefined> {
		const file = this.client.toPath(resource.uri);
		if (!file) {
			return undefined;
		}


		let tree: Proto.NavigationTree;
		try {
			const args: Proto.FileRequestArgs = { file };
			const { body } = await this.client.execute('navtree', args, token);
			if (!body) {
				return undefined;
			}
			tree = body;
		} catch {
			return undefined;
		}

		if (tree && tree.childItems) {
			// The root represents the file. Ignore this when showing in the UI
			const result: vscode.DocumentSymbol[] = [];
			tree.childItems.forEach(item => TypeScriptDocumentSymbolProvider.convertNavTree(resource.uri, result, item));
			return result;
		}

		return undefined;
	}

	private static convertNavTree(resource: vscode.Uri, bucket: vscode.DocumentSymbol[], item: Proto.NavigationTree): boolean {
		const symbolInfo = new vscode.DocumentSymbol(
			item.text,
			'',
			getSymbolKind(item.kind),
			typeConverters.Range.fromTextSpan(item.spans[0]),
			typeConverters.Range.fromTextSpan(item.spans[0]),
		);

		let shouldInclude = TypeScriptDocumentSymbolProvider.shouldInclueEntry(item);

		if (item.childItems) {
			for (const child of item.childItems) {
				const includedChild = TypeScriptDocumentSymbolProvider.convertNavTree(resource, symbolInfo.children, child);
				shouldInclude = shouldInclude || includedChild;
			}
		}

		if (shouldInclude) {
			bucket.push(symbolInfo);
		}
		return shouldInclude;
	}

	private static shouldInclueEntry(item: Proto.NavigationTree | Proto.NavigationBarItem): boolean {
		if (item.kind === PConst.Kind.alias) {
			return false;
		}
		return !!(item.text && item.text !== '<function>' && item.text !== '<class>');
	}
}


export function register(
	selector: vscode.DocumentSelector,
	client: ITypeScriptServiceClient,
) {
	return vscode.languages.registerDocumentSymbolProvider(selector,
		new TypeScriptDocumentSymbolProvider(client));
}
