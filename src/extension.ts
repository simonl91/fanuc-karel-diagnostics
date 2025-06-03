'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as cp from 'child_process';
import { disconnect } from 'process';

export function activate(context: vscode.ExtensionContext) {

	const collection = vscode.languages.createDiagnosticCollection('test');
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
		if (path.extname(document.fileName) == '.kl') {
			if (vscode.window.activeTextEditor) {
				updateDiagnostics(vscode.window.activeTextEditor.document, collection);
			}
		}
	}));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDiagnostics(editor.document, collection);
		}
	}));
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
	const dir = path.dirname(document.fileName); // get current path, use it as cwd for 'ktrans' command
	const file = document.uri.path.toLowerCase();
	if (file.endsWith('.kl')
		&& !file.endsWith('.th.kl')
		&& !file.endsWith('.h.kl')) {

		let ktrans: string;
		try {
			const opts = vscode.workspace.getConfiguration('ktrans'); // Get extension options
			const args = opts.get('args'); // extract args
			ktrans = cp.execSync(
				'ktrans ' + args + ' "' + document.fileName + '"',
				{ cwd: dir }
			).toString();
		} catch (err: any) {
			ktrans = err.stdout.toString();
		} finally {
			const pcFile = document.fileName.replace(/\.kl$/i, '.pc');
			if (fs.existsSync(pcFile)) {
				fs.unlinkSync(pcFile);
			}
		}

		const pattern = /(\n\s*)(?<line>\d+)(\s+)(?<text>.*?)(\n)(?<column>.*?\^)(.*?\n)(?<message>.*?)(\n)/gs;

		if (ktrans == undefined) return;

		let m: RegExpExecArray | null;
		let problems = 0;
		const diagnostics: vscode.Diagnostic[] = [];
		while ((m = pattern.exec(ktrans))) {
			problems++;
			if (m != null) {
				if (m.groups == undefined) return;
				const lineNum = parseInt(m.groups.line);
				const colNum = m.groups.column.length - 5;
				diagnostics.push({
					code: m.groups.text,
					message: m.groups.message,
					range: new vscode.Range(lineNum - 1, colNum, lineNum - 1, colNum),
					severity: vscode.DiagnosticSeverity.Error,
					source: '',
				});
			}
		}
		if (problems > 0) {
			collection.set(document.uri, diagnostics);
		} else {
			collection.clear();
		}
	} else {
		collection.clear();
	}
}
