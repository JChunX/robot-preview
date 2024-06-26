import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import * as extension from "../extension";

export default class RobotPreview {
    private _resource: vscode.Uri;
    private _processing: boolean;
    private _disposables: Disposable[] = [];
    private _context: vscode.ExtensionContext;
    private _messageQueue: any[];
    private _webviewReady: boolean;
    private _maxQueueSize: number = 10;
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
        var editor = vscode.window.createWebviewPanel(
            'robotPreview',
            'Robot Preview',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
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
        this._messageQueue = [];
        this._webviewReady = false;

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
        console.log('refreshing');
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
        try {
            const robotUri = this._webview.webview.asWebviewUri(this._resource);
            
            this.queueMessage({
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
        const cssUri = this.getUri(webview, extensionUri, ["dist", "styles.css"]);
        const nonce = this.getNonce();

        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${cssUri}" nonce="${nonce}">
            <title>URDF Preview</title>
            </head>
            <body>
                <div id="menu">
                    <div id="controls" class="hidden">
                        <div id="toggle-controls"></div>
                        <div id="ignore-joint-limits" class="toggle">Ignore Joint Limits</div>
                        <div id="radians-toggle" class="toggle">Use Radians</div>
                        <div id="autocenter-toggle" class="toggle checked">Autocenter</div>
                        <div id="collision-toggle" class="toggle">Show Collision</div>
                        <label>
                            Up Axis
                            <select id="up-select">
                                <option value="+X">+X</option>
                                <option value="-X">-X</option>
                                <option value="+Y">+Y</option>
                                <option value="-Y">-Y</option>
                                <option value="+Z" selected>+Z</option>
                                <option value="-Z">-Z</option>
                            </select>
                        </label>
                        <ul></ul>
                    </div>
                </div>
                
                <robot-viewer up="+Z" display-shadow tabindex="0"></robot-viewer>
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

    private queueMessage(message: any) {
        if (this._webviewReady) {
            this._webview.webview.postMessage(message);
        } else {
            this._messageQueue.push(message);
            if (this._messageQueue.length > this._maxQueueSize) {
                this._messageQueue.shift();
            }
        }
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
        (message: any) => {
            const command = message.command;
            const text = message.text;
    
            switch (command) {
            case "webviewReady":
                this._webviewReady = true;
                this._messageQueue.forEach((message) => {
                    this._webview.webview.postMessage(message);
                });
                this._messageQueue = [];
                return;
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