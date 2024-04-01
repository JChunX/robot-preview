import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene: THREE.Scene | undefined = undefined;
// let currentRobot : TODO
let ground : THREE.Mesh | undefined = undefined;
let camera : THREE.PerspectiveCamera | undefined = undefined;
let renderer : THREE.WebGLRenderer | undefined = undefined;

async function createScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

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
}

function getLoader(resource : string) {
    const ext = resource.split('.').pop();
    const manager = new THREE.LoadingManager();
    if (ext === "xacro") {
        return new URDFLoader(manager);
    }
    else if (ext === "urdf") {
        return new URDFLoader(manager);
    }
    else {
        throw new Error("Unsupported file type");
    }
}

async function main() {
    await createScene();

    const header = document.getElementById('heading');

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'loadRobot':
            const loader = getLoader(message.robot);
            
            console.log("Loading robot from " + message.robot);

            loader.load(
                message.robot,
                (robot) => {
                    if (scene) {
                        console.log("Adding robot to scene");
                        scene.add(robot);
                    }
                }
            );
            
            break;
        }
    });

    window.addEventListener('resize', function() {
        const parentWidth = renderer.domElement.parentElement.clientWidth;
        const parentHeight = renderer.domElement.parentElement.clientHeight;
        
        // Update camera
        camera.aspect = parentWidth / parentHeight;
        camera.updateProjectionMatrix();
        
        // Update renderer
        renderer.setSize(parentWidth, parentHeight);
    }, false);


    let counter = 0;
    setInterval(() => {
        if (header) {
            header.innerHTML = `Hello ${counter++}`;
        }
    }, 1000);
}

window.addEventListener('load', main);