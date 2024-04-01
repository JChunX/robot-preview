// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as vscodeUtils from './vscode-utils';
import RobotPreviewManager from './robotPreview/previewManager';

export enum Commands {
    PreviewRobot = "robot-preview.previewRobot",
}

export let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscodeUtils.createOutputChannel();
    context.subscriptions.push(outputChannel);

	RobotPreviewManager.INSTANCE.setContext(context);

	vscode.window.registerWebviewPanelSerializer('urdfPreview', RobotPreviewManager.INSTANCE);

	vscode.commands.registerCommand(Commands.PreviewRobot, () => {
		ensureErrorMessageOnException(() => {
			if (vscode.window.activeTextEditor) {
				RobotPreviewManager.INSTANCE.preview(vscode.window.activeTextEditor.document.uri);
			}
		});
	});

}

async function ensureErrorMessageOnException(callback: (...args: any[]) => any) {
	try {
		await callback();
	} catch (err) {
		vscode.window.showErrorMessage((err as Error).message);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
