import * as vscode from 'vscode';
import * as path from "path";

import RobotPreview from './preview';

export default class RobotPreviewManager implements vscode.WebviewPanelSerializer {
    public static readonly INSTANCE = new RobotPreviewManager();

    private readonly _previews: RobotPreview[] = [];
    private _activePreview: RobotPreview | undefined = undefined;
    private _context: vscode.ExtensionContext | undefined;

    public setContext(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public refresh() {
        for (const preview of this._previews) {
            preview.refresh();
        }
    }

    public preview(
        resource: vscode.Uri
    ): void {
        if (RobotPreviewManager.handlesUri(resource)) {
            let preview = this.getExistingPreview(resource);
            if (preview) {
                preview.reveal();
                preview.update(resource);
            } else {
                if (this._context) {
                    preview = this.createNewPreview(this._context, resource);
                    preview.update(resource);
                }
            }
        }
    }

    public get activePreviewResource() {
        return this._activePreview && this._activePreview.resource;
    }

    public async deserializeWebviewPanel(
        webview: vscode.WebviewPanel,
        state: any
    ): Promise<void> {
        if (state && this._context) {
            const preview = await RobotPreview.revive(
                webview,
                this._context,
                state);

            this.registerPreview(preview);
        }
    }

    private getExistingPreview(
        resource: vscode.Uri
    ): RobotPreview | undefined {
        return this._previews.find(preview =>
            preview.matchesResource(resource));
    }

    private createNewPreview(
        context: vscode.ExtensionContext,
        resource: vscode.Uri
    ): RobotPreview {
        const preview = RobotPreview.create(
            context,
            resource);

        this._activePreview = preview;
        return this.registerPreview(preview);
    }

    private registerPreview(
        preview: RobotPreview
    ): RobotPreview {
        this._previews.push(preview);

        preview.onDispose(() => {
            const existing = this._previews.indexOf(preview);
            if (existing === -1) {
                return;
            }
            this._previews.splice(existing, 1);
            if (this._activePreview === preview) {
                this._activePreview = undefined;
            }
        });

        preview.onDidChangeViewState(({ webviewPanel }: { webviewPanel: vscode.WebviewPanel }) => {
            this._activePreview = webviewPanel.active ? preview : undefined;
        });

        return preview;
    }

    private static handlesUri(
        uri: vscode.Uri
    ): boolean {

        let ext = path.extname(uri.fsPath);
        if (ext === ".xacro" ||
            ext === ".urdf") {
            return true;
        }

        return false;
    }
}