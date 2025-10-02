import * as THREE from './three/three.module.js';
import { TrackballControls } from './three/TrackballControls.js';
import Stats from './three/stats.module.js';
import { GUI } from './three/lil-gui.module.min.js';

import { vertShader, fragShader } from './sphereShader.js';

let scene, camera, renderer, clock, keyboard, controls, orbitalMesh, timer, stats, enableSpin, spinVelocity, gridHelper;

timer = 0;
enableSpin = true;
spinVelocity = 1;

let n = 3; // Principal quantum number
let l = 2; // Azimuthal quantum number (0 ≤ l < n)
let m = 1; // Magnetic quantum number (-l ≤ m ≤ l)

const params = {
	n: 3,
	l: 2,
	m: 1,
	sampleCount: 7,
	pointDensity: 2,
	radialDensity: 1.5,
	viewInside: true,
	enableSpin: true,
	spinVelocity: 1,
	showGrid: false,
	background: 0xeeeeee,
	colourMap: 0,
	resetCamera: () => {
		camera.position.set(0, 0, 30);
		controls.target = new THREE.Vector3();
		camera.up = new THREE.Vector3(0, 1, 0);
		controls.object.lookAt(new THREE.Vector3());
	}
}

const colourMaps = {
	"Shades of Green": 0,
	"Nebula": 1,
	"Heatmap": 2,
	"Coolmap": 3,
	"Diverging": 4,
	"Inferno": 5,
	"Viridis": 6
};

keyboard = {}

function init() {

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	clock = new THREE.Clock();

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor("#eeeeee");

	document.body.appendChild(renderer.domElement);

	camera.position.set(0, 0, 30);

	// Add orbital to scene
	orbitalMesh = generateOrbital();

	// Create inputs for quantum numbers using stats
	stats = new Stats();
	document.body.appendChild(stats.dom);

	// Create GUI
	const gui = new GUI();
	const quantumFolder = gui.addFolder("Quantum Numbers");
	quantumFolder.add(params, "n", 1, 7, 1).onChange((value) => {
		n = params.n;

		if (params.l >= params.n) params.l = params.n - 1;
		l = params.l;

		if (params.m < -params.l) params.m = -params.l;
		if (params.m > params.l) params.m = params.l;
		m = params.m;

		if (params.n == 7) {
			if (params.l > 1) params.l = 1;
			if (params.l < 0) params.l = 0;
			l = params.l;

			if (params.m < -params.l) params.m = -params.l;
			if (params.m > params.l) params.m = params.l;
			m = params.m;
		}
		
		scene.remove(orbitalMesh);
		orbitalMesh = generateOrbital();
	}).listen();

	quantumFolder.add(params, "l", 0, 6, 1).name("l (l < n-1)").onChange((value) => {
		scene.remove(orbitalMesh);
		
		if (params.l >= params.n) params.l = params.n - 1;
		l = params.l;

		if (params.m < -params.l) params.m = -params.l;
		if (params.m > params.l) params.m = params.l;
		m = params.m;

		if (params.n == 7) {
			if (params.l > 1) params.l = 1;
			if (params.l < 0) params.l = 0;
			l = params.l;

			if (params.m < -params.l) params.m = -params.l;
			if (params.m > params.l) params.m = params.l;
			m = params.m;
		}
		
		orbitalMesh = generateOrbital();
	}).listen();

	quantumFolder.add(params, "m", -6, 6, 1).name("m (-l < m < l)").onChange((value) => {
		if (params.m < -params.l) params.m = -params.l;
		if (params.m > params.l) params.m = params.l;
		m = params.m;

		scene.remove(orbitalMesh);
		orbitalMesh = generateOrbital();
	}).listen();

	quantumFolder.open();

	// Create settings folder
	const settingsFolder = gui.addFolder("Settings");

	// Create a sample count
	const sampleCountInput = settingsFolder.add(params, "sampleCount", 0, 20, 0.1).name("Sample Count 10^5");
	sampleCountInput.onChange((value) => {
		scene.remove(orbitalMesh);
		orbitalMesh = generateOrbital();
	});

	// Create probability multiplier
	const probabilityInput = settingsFolder.add(params, "pointDensity", 0, 5, 0.01).name("Threshhold");
	probabilityInput.onChange((value) => {
		scene.remove(orbitalMesh);
		orbitalMesh = generateOrbital();
	});

	// Create radial density option
	const radialDensityInput = settingsFolder.add(params, "radialDensity", 0, 20, 0.01).name("Radial Density");
	radialDensityInput.onChange((value) => {
		scene.remove(orbitalMesh);
		orbitalMesh = generateOrbital();
	});

	// Create show inside option
	const showInsideInput = settingsFolder.add(params, "viewInside").name("View Inside");
	showInsideInput.onChange((value) => {
		orbitalMesh.material.uniforms.showInside.value = value;
	}).listen();

	// Create enable spin option
	const enableSpinInput = settingsFolder.add(params, "enableSpin").name("Enable Spin");
	enableSpinInput.onChange((value) => {
		enableSpin = value;
	}).listen();

	// Create enable spin speed option
	const spinVelocityOption = settingsFolder.add(params, "spinVelocity", 0, 10, 0.01).name("Spin Velocity");
	spinVelocityOption.onChange((value) => {
		spinVelocity = value;
	}).listen();

	// Create grid option
	const gridInput = settingsFolder.add(params, "showGrid").name("Show Grid");
	gridInput.onChange((value) => {
		if (value) {
			gridHelper = new THREE.GridHelper(40, 40);
			scene.add(gridHelper);
		} else {
			scene.remove(gridHelper);
		}
	});

	// Create background options
	const backgroundInput = settingsFolder.addColor(params, "background").name("background");
	backgroundInput.onChange((value) => {
		renderer.setClearColor(value);
	});
	
	// GUI dropdown for colormap selection
	settingsFolder.add(params, 'colourMap', colourMaps).name("Colour Map").onChange((value) => {
		orbitalMesh.material.uniforms.colourMap.value = value;
	});

	// Create reset camera button
	const resetCamButton = settingsFolder.add(params, "resetCamera").name("Reset Camera");

}

// Function to compute the radial wavefunction
function radialWavefunction(r, n, l) {
    const rho = 2 * r / n;
    const normalization = Math.sqrt((2 / n) ** 3 * factorial(n - l - 1) / (2 * n * factorial(n + l)));
    const laguerre = associatedLaguerre(n - l - 1, 2 * l + 1, rho);
    return normalization * Math.exp(-rho / 2) * Math.pow(rho, l) * laguerre;
}

// Function to compute the spherical harmonic Y(l, m)
function sphericalHarmonic(l, m, theta, phi) {
    // Use absolute value for normalization factor
    const prefactor = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) *
                      (factorial(l - Math.abs(m)) / factorial(l + Math.abs(m))));
    
    // Compute the associated Legendre polynomial for cos(theta)
    const P_lm = associatedLegendre(l, Math.abs(m), Math.cos(theta));
    
    // For m < 0, include the standard factor
    const signFactor = (m < 0) ? Math.pow(-1, m) * factorial(l - Math.abs(m)) / factorial(l + Math.abs(m)) : 1;
    
    const legendre = signFactor * P_lm;
    
    const realPart = prefactor * legendre * Math.cos(m * phi);
    const imagPart = prefactor * legendre * Math.sin(m * phi);
    return new THREE.Vector2(realPart, imagPart);
}

// Generate the 3D orbital point cloud
function generateOrbital() {
    const numPoints = params.sampleCount * 100000 * (n + l);

	// Create shader material
	const shaderMaterial = new THREE.ShaderMaterial({
		vertexShader: vertShader,
		fragmentShader: fragShader,
		uniforms: {
			time: { value: 0.0 },
			showInside: { value: true },
			m: { value: 0.0 },
			delta: { value: 0.0 },
			camPos: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
			colourMap: { value: 0.0 }
		},
		vertexColors: true
	});
	
	// Sphere geometry and material
	const sphereGeometry = new THREE.SphereGeometry(0.04 + 0.02 * (n - 1), 8, 8);  // Small spheres
	
	const mesh = new THREE.InstancedMesh(sphereGeometry, shaderMaterial, numPoints);
	const pointProbabilities = new Float32Array(numPoints);

	// Create a transformation matrix for each sphere
	const dummy = new THREE.Object3D();
	let count = 0;

    for (let i = 0; i < numPoints; i++) {
        // Generate random spherical coordinates
        const r = Math.random() * 10 * (n + l);
        const theta = Math.random() * Math.PI;
        const phi = Math.random() * 2 * Math.PI;

        // Compute probability density
        const R = radialWavefunction(r, n, l);
        const Y = sphericalHarmonic(l, m, theta, phi);

        // Compute the magnitude of the complex number
		const Y_magnitude = Math.sqrt(Y.x * Y.x + Y.y * Y.y);

		// Compute probability density
		const probability = Math.pow(R * Y_magnitude, 2);

		let scaledProbability = probability * params.pointDensity;
		scaledProbability *= 5 * (l * l + n);
		let densityScaledProbability = scaledProbability * Math.max(0.1, Math.pow(r, params.radialDensity));

		if (densityScaledProbability < 0.02 / (n + l)) continue;

        if (Math.random() < densityScaledProbability) {
            const x = r * Math.sin(theta) * Math.cos(phi);
            const y = r * Math.sin(theta) * Math.sin(phi);
            const z = r * Math.cos(theta);

			pointProbabilities[count] = Math.min(1.0, scaledProbability * 30 * (n + l));

            // Position the sphere using the transformation matrix
			dummy.position.set(x, y, z);
			dummy.updateMatrix();
			mesh.setMatrixAt(count++, dummy.matrix); // Set instance matrix
        }
    }

    // Update the instance count
	mesh.count = count;
	mesh.instanceMatrix.needsUpdate = true;

	// Attach color data
	const colorAttribute = new THREE.InstancedBufferAttribute(pointProbabilities, 1);
	mesh.geometry.setAttribute('instanceProbability', colorAttribute);

	// Add to the scene
	scene.add(mesh);

	// Reset timer
	timer = 0;

	return mesh;
}

// Utility functions

// Factorial function with memoization
const factorialCache = {};
function factorial(n) {
    if (n in factorialCache) return factorialCache[n];
    if (n <= 1) return 1;
    return factorialCache[n] = n * factorial(n - 1);
}

// Compute the double factorial for odd numbers: (2n-1)!!
function doubleFactorial(n) {
    let result = 1;
    for (let k = n; k > 0; k -= 2) {
        result *= k;
    }
    return result;
}

function associatedLaguerre(p, q, x) {
    if (p === 0) return 1;
    if (p === 1) return 1 + q - x;
    return ((2 * (p - 1) + 1 + q - x) * associatedLaguerre(p - 1, q, x) -
        (p - 1 + q) * associatedLaguerre(p - 2, q, x)) / p;
}

// Compute the associated Legendre polynomial P_l^m(x) for m>=0
// using the standard recurrence relations.
function associatedLegendre(l, m, x) {
    if (m > l) {
        m = l
    }
    // Base case: m == l
    if (l === m) {
        // P_m^m(x) = (-1)^m (2m-1)!! (1-x^2)^(m/2)
        return Math.pow(-1, m) * doubleFactorial(2 * m - 1) * Math.pow(1 - x * x, m / 2);
    }
    // Next base: l == m+1
    if (l === m + 1) {
        // P_{m+1}^m(x) = x (2m+1) P_m^m(x)
        return x * (2 * m + 1) * associatedLegendre(m, m, x);
    }
    // Use recurrence for l > m+1:
    // P_l^m(x) = ((2l-1)x P_{l-1}^m(x) - (l+m-1) P_{l-2}^m(x)) / (l-m)
    return ((2 * l - 1) * x * associatedLegendre(l - 1, m, x) - (l + m - 1) * associatedLegendre(l - 2, m, x)) / (l - m);
}

// Listen for keyboard events
window.addEventListener("keydown", e => {
	keyboard[e.key] = true;
})

window.addEventListener("keyup", e => {
	keyboard[e.key] = false;
})

// Setup mouse look
function setupMouseLook() {
	controls = new TrackballControls( camera, renderer.domElement );

	controls.rotateSpeed = 4;
	controls.zoomSpeed = 1.2;
	controls.panSpeed = 0.8;

	controls.keys = [ 'KeyA', 'KeyS', 'KeyD' ];
}

// Change render scale on window size change
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);

// Main Game Loop

function animate() {
	requestAnimationFrame(animate);

	let delta = clock.getDelta();
	controls.update();
	stats.update();

	// Update shader time
	if (enableSpin) timer += delta

	orbitalMesh.material.uniforms.time.value = timer * spinVelocity;
	orbitalMesh.material.uniforms.showInside.value = params.viewInside;
	orbitalMesh.material.uniforms.m.value = m;
	orbitalMesh.material.uniforms.delta.value = delta;
	orbitalMesh.material.uniforms.camPos.value = camera.position;
	orbitalMesh.material.uniforms.colourMap.value = params.colourMap;

	renderer.render(scene, camera);
}

init();
setupMouseLook();
animate();