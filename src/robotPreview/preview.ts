import * as vscode from 'vscode';
import { Disposable, window } from 'vscode';
import * as path from "path";
import * as extension from "../extension";
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';

export default class RobotPreview {
    private _resource: vscode.Uri;
    private _processing: boolean;
    private _context: vscode.ExtensionContext;
    private _disposables: Disposable[] = [];
    _robotEditor: vscode.TextEditor | undefined;
    _webview: vscode.WebviewPanel;

    public get state() {
        return {
            resource: this.resource.toString()
        };
    }

    public static create(
        context: vscode.ExtensionContext,
        resource: vscode.Uri
    ): RobotPreview {
        // Create and show a new webview
        var editor = vscode.window.createWebviewPanel(
            'robotPreview', // Identifies the type of the webview. Used internally
            'Robot Preview', // Title of the panel displayed to the user
            vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
            {
                enableScripts: true,
                retainContextWhenHidden: true,

                // localResourceRoots: [
                //     vscode.Uri.joinPath(context.extensionUri, 'assets'),
                //     vscode.Uri.joinPath(context.extensionUri, 'dist'),
                    
                // ]
            }
        );

        return new RobotPreview(editor, context, resource);
    }

    private constructor(
        webview: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        resource: vscode.Uri
    ) {
        this._webview = webview;
        this._context = context;
        this._resource = resource;
        this._processing = false;

        let subscriptions: Disposable[] = [];

        // Set an event listener to listen for messages passed from the webview context
        this._setWebviewMessageListener(this._webview.webview);

        this._webview.webview.html = this._getWebviewContent(this._webview.webview, context.extensionUri);

        vscode.workspace.onDidSaveTextDocument(event => {

            if (event && this.isPreviewOf(event.uri)) {
                this.refresh();
            }
        }, this, subscriptions);

        this._webview.onDidDispose(() => {
            this.dispose();
        }, null, subscriptions);

        this._disposables = subscriptions;
    }

    public static async revive(
        webview: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        state: any,
    ): Promise<RobotPreview> {
        const resource = vscode.Uri.file(state.previewFile);

        const preview = new RobotPreview(
            webview,
            context,
            resource);

        return preview;
    } 

    public matchesResource(
        otherResource: vscode.Uri
    ): boolean {
        return this.isPreviewOf(otherResource);
    }

    public get resource(): vscode.Uri {
        return this._resource;
    }

    public async refresh() {
        if (this._processing === false) {
            this.loadResource();
        }
    }

    public reveal() {
        this._webview.reveal(vscode.ViewColumn.Two);
    }  
    
    public update(resource: vscode.Uri) {
        const editor = vscode.window.activeTextEditor;

        // If we have changed resources, cancel any pending updates
        const isResourceChange = resource.fsPath !== this._resource.fsPath;
        this._resource = resource;
        // Schedule update if none is pending
        this.refresh();
    }

    public dispose() {
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }

        this._onDisposeEmitter.fire();
        this._onDisposeEmitter.dispose();

        this._onDidChangeViewStateEmitter.dispose();
        this._webview.dispose();    
    }

    private readonly _onDisposeEmitter = new vscode.EventEmitter<void>();
    public readonly onDispose = this._onDisposeEmitter.event;    

    private readonly _onDidChangeViewStateEmitter = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
    public readonly onDidChangeViewState = this._onDidChangeViewStateEmitter.event;

    private isPreviewOf(resource: vscode.Uri): boolean {
        return this._resource.fsPath === resource.fsPath;
    }

    private async loadResource() {
        this._processing = true;
        // console.log("Loading resource");
        try {
            const robotUri = this._webview.webview.asWebviewUri(this._resource);
            
            this._webview.webview.postMessage({
                command: 'loadRobot',
                robot: robotUri.toString()
            });
        } catch (error) {
            console.error(error);
        }

        this._processing = false;
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const webviewUri = this.getUri(webview, extensionUri, ["dist", "webview.js"]);
        const nonce = this.getNonce();

        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style nonce="${nonce}">
                html,
                body {
                overflow: hidden;
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                }

                #renderCanvas {
                width: 100%;
                height: 100%;
                touch-action: none;
                }
            </style>
            <title>URDF Preview</title>
            </head>
            <body>
                <h1 id="heading">hello world</h1>
                
                <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
            </body>
            </html>
        `;
    }  

    private getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
        return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
    }

    private getNonce() {
        let text = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
        (message: any) => {
            const command = message.command;
            const text = message.text;
    
            switch (command) {
            case "info":
                vscode.window.showInformationMessage(text);
                return;
            case "error":
                vscode.window.showErrorMessage(text);
                return;
            case "trace":
            extension.outputChannel.appendLine(text);
            return;
            }
        },
        undefined,
        this._disposables
        );
    }

}