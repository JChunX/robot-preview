// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "robot-preview" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('robot-preview.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Robot Preview!');
	});

	context.subscriptions.push(disposable);

	context.subscriptions.push(
        vscode.commands.registerCommand('robot-preview.preview', () => {
            // Create and show a new webview
            const panel = vscode.window.createWebviewPanel(
                'threeJs', // Identifies the type of the webview. Used internally
                'Three.js', // Title of the panel displayed to the user
                vscode.ViewColumn.One, // Editor column to show the new webview panel in.
                {
					enableScripts: true,
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'assets')]
				} // Webview options. More on these later.
            );

            // And set its HTML content
            panel.webview.html = getWebviewContent(context, panel);
        })
    );
}

function getWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
	const robotPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'robot.urdf');
	const webviewRobotPath = panel.webview.asWebviewUri(robotPath);

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Three.js in VSCode</title>
			<script type="importmap">
				{
					"imports": {
						"three": "https://unpkg.com/three@0.163.0/build/three.module.js",
						"three/examples/jsm/loaders/STLLoader.js": "https://unpkg.com/three@0.163.0/examples/jsm/loaders/STLLoader.js",
						"three/examples/jsm/loaders/ColladaLoader.js": "https://unpkg.com/three@0.163.0/examples/jsm/loaders/ColladaLoader.js",
						"three/examples/jsm/controls/OrbitControls.js": "https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js"
					}
				}
			</script>
        </head>
        <body>
			<img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
			<h1 id="lines-of-code-counter">0</h1>
			<div id="canvas"></div>
			<script type="module">
				import * as THREE from 'three';
				import URDFLoader from 'https://unpkg.com/urdf-loader';
				import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
				const scene = new THREE.Scene();
				scene.background = new THREE.Color(0xaaaaaa);
				const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
				camera.position.z = 5;
				const renderer = new THREE.WebGLRenderer();
				renderer.setSize(window.innerWidth, window.innerHeight);
				document.getElementById('canvas').appendChild(renderer.domElement);
				
				const manager = new THREE.LoadingManager();
				const loader = new URDFLoader(manager);
				loader.packages = {
					packageName: './package/dir/' // The equivalent of a (list of) ROS package(s):// directory
				};
				loader.load(
					'${webviewRobotPath}',
					robot => {
						// The robot is loaded!
						scene.add(robot);
					}
				);

				const light = new THREE.AmbientLight(0xffffff);
				light.position.set(0, 0, 10);
				scene.add(light);

				const controls = new OrbitControls(camera, renderer.domElement);
				controls.update(); // Controls update must be called after any manual changes to the camera's transform

				function animate() {
					requestAnimationFrame(animate);
					controls.update();
					renderer.render(scene, camera);
				}
				animate();

				document.getElementById('canvas').appendChild(renderer.domElement);
				const counter = document.getElementById('lines-of-code-counter');
				let count = 0;
				setInterval(() => {
					counter.textContent = String(count++);
				}, 1000);
			</script>
        </body>
        </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
