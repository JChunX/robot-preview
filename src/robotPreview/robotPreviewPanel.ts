
import RobotInteractiveViewer from './robot-interactive-viewer-element.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';

customElements.define('robot-viewer', RobotInteractiveViewer);

const vscode = acquireVsCodeApi();

const viewer: RobotInteractiveViewer = document.querySelector('robot-viewer')!;

const limitsToggle: HTMLElement = document.getElementById('ignore-joint-limits')!;
const collisionToggle: HTMLElement = document.getElementById('collision-toggle')!;
const autocenterToggle: HTMLElement = document.getElementById('autocenter-toggle')!;
const upSelect: HTMLSelectElement = document.getElementById('up-select')! as HTMLSelectElement;
const sliderList: HTMLUListElement = document.querySelector('#controls ul')!;
const radiansToggle: HTMLElement = document.getElementById('radians-toggle')!;
const controlsToggle: HTMLElement = document.getElementById('toggle-controls')!;
const controlsel: HTMLElement = document.getElementById('controls')!;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 1 / DEG2RAD;

let sliders : { [key: string]: HTMLElement } = {};

limitsToggle.addEventListener('click', () => {
    limitsToggle.classList.toggle('checked');
    viewer.ignoreLimits = limitsToggle.classList.contains('checked');
});

radiansToggle.addEventListener('click', () => {
    radiansToggle.classList.toggle('checked');
    Object
        .values(sliders)
        .forEach(sl => sl.update());
});

collisionToggle.addEventListener('click', () => {
    collisionToggle.classList.toggle('checked');
    viewer.showCollision = collisionToggle.classList.contains('checked');
});

autocenterToggle.addEventListener('click', () => {
    autocenterToggle.classList.toggle('checked');
    viewer.noAutoRecenter = !autocenterToggle.classList.contains('checked');
});

upSelect.addEventListener('change', () => viewer.up = upSelect.value);
controlsToggle.addEventListener('click', () => controlsel.classList.toggle('hidden'));

const setColor = (color: string): void => {

    document.body.style.backgroundColor = color;
    viewer.highlightColor = '#' + (new THREE.Color(0xffffff)).lerp(new THREE.Color(color), 0.35).getHexString();

};

viewer.addEventListener('angle-change', (e: CustomEvent) => {

    if (sliders[e.detail]) {
        sliders[e.detail].update();
    }

});

viewer.addEventListener('joint-mouseover', (e: MouseEvent) => {
    const j = document.querySelector(`li[joint-name="${e.detail}"]`);
    if (j) {
        j.setAttribute('robot-hovered', 'true');
    }
});

viewer.addEventListener('joint-mouseout', (e: MouseEvent) => {
    const j = document.querySelector(`li[joint-name="${e.detail}"]`);
    if (j) {
        j.removeAttribute('robot-hovered');
    }
});

let originalNoAutoRecenter: boolean;
viewer.addEventListener('manipulate-start', (e: MouseEvent) => {

    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) {
        j.scrollIntoView({ block: 'nearest' });
        window.scrollTo(0, 0);
    }

    originalNoAutoRecenter = viewer.noAutoRecenter;
    viewer.noAutoRecenter = true;

});

viewer.addEventListener('manipulate-end', (e: MouseEvent) => {

    viewer.noAutoRecenter = originalNoAutoRecenter;

});

viewer.addEventListener('robot-processed', () => {

    const r = viewer.robot;
    Object
        .keys(r.joints)
        .sort((a, b) => {

            const da = a.split(/[^\d]+/g).filter(v => !!v).pop();
            const db = b.split(/[^\d]+/g).filter(v => !!v).pop();

            if (da !== undefined && db !== undefined) {
                const delta = parseFloat(da) - parseFloat(db);
                if (delta !== 0) return delta;
            }

            if (a > b) return 1;
            if (b > a) return -1;
            return 0;

        })
        .map(key => r.joints[key])
        .forEach(joint => {

            const li = document.createElement('li');
            li.innerHTML =
                `
            <span title="${joint.name}">${joint.name}</span>
            <input type="range" value="0" step="0.0001"/>
            <input type="number" step="0.0001" />
            `;
            li.setAttribute('joint-type', joint.jointType);
            li.setAttribute('joint-name', joint.name);

            sliderList.appendChild(li);

            // update the joint display
            const slider = li.querySelector('input[type="range"]')! as HTMLInputElement;
            const input = li.querySelector('input[type="number"]')! as HTMLInputElement;
            li.update = () => {
                const degMultiplier = radiansToggle.classList.contains('checked') ? 1.0 : RAD2DEG;
                let angle = joint.angle;

                if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
                    angle *= degMultiplier;
                }

                if (Math.abs(angle) > 1) {
                    angle = angle.toFixed(1);
                } else {
                    angle = angle.toPrecision(2);
                }

                input.value = angle;

                // directly input the value
                slider.value = joint.angle.toString();

                if (viewer.ignoreLimits || joint.jointType === 'continuous') {
                    slider.min = (-6.28).toString();
                    slider.max = (6.28).toString();

                    input.min = (-6.28 * degMultiplier).toString();
                    input.max = (6.28 * degMultiplier).toString();
                } else {
                    slider.min = joint.limit.lower.toString();
                    slider.max = joint.limit.upper.toString();

                    input.min = (joint.limit.lower * degMultiplier).toString();
                    input.max = (joint.limit.upper * degMultiplier).toString();
                }
            };

            switch (joint.jointType) {

                case 'continuous':
                case 'prismatic':
                case 'revolute':
                    break;
                default:
                    li.update = () => { };
                    input.remove();
                    slider.remove();

            }

            slider.addEventListener('input', () => {
                viewer.setJointValue(joint.name, slider.value);
                li.update();
            });

            input.addEventListener('change', () => {
                const degMultiplier = radiansToggle.classList.contains('checked') ? 1.0 : RAD2DEG;
                viewer.setJointValue(joint.name, parseFloat(input.value) / degMultiplier);
                li.update();
            });

            li.update();

            sliders[joint.name] = li as HTMLElement;

        });

});


function main() {

    viewer.loadMeshFunc = (path, manager, done) => {

        const ext = path.split(/\./g).pop().toLowerCase();
        switch (ext) {

            case 'gltf':
            case 'glb':
                new GLTFLoader(manager).load(
                    path,
                    result => done(result.scene),
                    undefined, 
                    err => done(null, err),
                );
                break;
            case 'obj':
                new OBJLoader(manager).load(
                    path,
                    result => done(result),
                    undefined, 
                    err => done(null, err),
                );
                break;
            case 'dae':
                new ColladaLoader(manager).load(
                    path,
                    result => done(result.scene),
                    undefined,
                    err => done(null, err),
                );
                break;
            case 'stl':
                new STLLoader(manager).load(
                    path,
                    result => {
                        const material = new THREE.MeshPhongMaterial();
                        const mesh = new THREE.Mesh(result, material);
                        done(mesh);
                    },
                    undefined,
                    err => done(null, err),
                );
                break;

        }

    };

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'loadRobot':
                console.log('========== loading robot ========', message.robot);
                viewer.robotFile = message.robot;
                break;
        }
    });

    viewer.camera.position.set(-5.5, 3.5, 5.5);
    setColor('#8495ED');
}

document.addEventListener('DOMContentLoaded', () => {
    main();
    vscode.postMessage({ command: 'webviewReady' });
});