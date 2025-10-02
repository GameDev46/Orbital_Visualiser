const vertShader = `
    varying vec2 vUv;
	varying vec3 vNormal;
    varying float vProbability;
    varying vec3 vPosition;

    in float instanceProbability;
 
    uniform float time;
    uniform bool showInside;
    uniform float m;
    uniform float delta;
    uniform vec3 camPos;
  
	void main() {

        vUv = uv;
        vNormal = normalize(mat3(instanceMatrix) * normal);
        vProbability = instanceProbability;

        // Compute world-space position of the electron
        vec4 worldPosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

        // Rotate each electron around the nucleus
        mat3 rotationMatrix = mat3(1.0);

        float distanceFromAxis = length(worldPosition.xy);
        distanceFromAxis = distanceFromAxis + 0.01;

        float hbar = 1.0545718e-34; // Planck's constant / 2π
        float me = 9.10938356e-31;  // Electron mass

        // Compute velocity
        float v_phi = (m * hbar) / (me * distanceFromAxis);

        // Update angular position
        float phi = (v_phi * delta * time) / distanceFromAxis;  // ω = v/r

        float angle = v_phi * time * 1e4;
        rotationMatrix[0] = vec3(cos(angle), sin(angle), 0.0);
        rotationMatrix[1] = vec3(-sin(angle), cos(angle), 0.0);
        rotationMatrix[2] = vec3(0.0, 0.0, 1.0);

        vec3 rotatedPosition = rotationMatrix * worldPosition.xyz;
        vec3 posDifference = rotatedPosition - worldPosition.xyz;

        vPosition = rotatedPosition;
    
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position + posDifference, 1.0);
	}
`;

const fragShader = `
	varying vec2 vUv;
 	varying vec3 vNormal;
    varying float vProbability;
    varying vec3 vPosition;
 
	uniform float time;
    uniform bool showInside;
    uniform float m;
    uniform float delta;
    uniform vec3 camPos;
    uniform float colourMap;

    vec3 nucleusPosition = vec3(0.0, 0.0, 0.0);

    vec3 innerCol = vec3(0.6, 0.9, 0.3);
    vec3 middleCol = vec3(0.3, 0.9, 0.1);
    vec3 outerCol = vec3(0.0, 0.2, 0.0);
    vec3 centralCol = vec3(2.0, 2.0, 2.0);

    vec3 smoothGradient(float value, vec3 color1, vec3 color2, vec3 color3, vec3 color4) {
        // Clamp value to [0,1] range to avoid issues
        value = clamp(value, 0.0, 1.0);
        value = smoothstep(0.0, 1.0, value);
        
        if (value < 0.33) {
            // Interpolate between first and second color
            return mix(color1, color2, smoothstep(0.0, 0.33, value));
        } else if (value < 0.66) {
            // Interpolate between second and third color
            return mix(color2, color3, smoothstep(0.33, 0.66, value));
        } else {
            // Interpolate between third and fourth color
            return mix(color3, color4, smoothstep(0.66, 1.0, value));
        }
    }

    vec3 getColourmap(float value, float map) {
        value = clamp(value, 0.0, 1.0);
        
        if (map == 0.0) {
            // Shades of Green
            return smoothGradient(value, centralCol, innerCol, middleCol, outerCol); // White → Green
        }
        else if (map == 1.0) {
            // Nebula
            return mix(vec3(0.1, 0.0, 0.2), vec3(0.5, 0.2, 0.8), smoothstep(0.0, 1.0, value)); // Dark Purple → Blue
        }
        else if (map == 2.0) {
            // Heatmap
            return mix(vec3(1.0, 0.4, 0.4), vec3(0.4, 0.4, 1.0), smoothstep(0.0, 1.0, value)); // Red → Blue
        }
        else if (map == 3.0) {
            // Coolmap
            return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), smoothstep(0.0, 1.0, value)); // Blue → Cyan
        }
        else if (map == 4.0) {
            // Diverging
            if (value < 0.5) {
                return mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), smoothstep(0.0, 0.5, value)); // Red → White
            }
            return mix(vec3(1.0, 1.0, 1.0), vec3(0.0, 0.0, 1.0), smoothstep(0.5, 1.0, value)); // White → Blue
        } 
        else if (map == 5.0) {
            // Inferno
            if (value < 0.5) {
                return mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 0.4, 0.0), smoothstep(0.0, 0.5, value)); // Black → Orange
            }
            return mix(vec3(1.0, 0.4, 0.0), vec3(1.0, 1.0, 0.8), smoothstep(0.5, 1.0, value)); // Orange → Yellow → White
        }
        else if (map == 6.0) {
            // Viridis
            if (value < 0.5) {
                return mix(vec3(0.0, 0.0, 0.3), vec3(0.0, 0.7, 0.2), smoothstep(0.0, 0.5, value)); // Dark Blue → Green
            }
            return mix(vec3(0.0, 0.7, 0.2), vec3(1.0, 1.0, 0.0), smoothstep(0.5, 1.0, value)); // Green → Yellow
        }

        return vec3(1.0); // Default (White)
    }

 
 	void main() {
    
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize( nucleusPosition - vPosition );

        float diffuse = max( 0.0, dot( normal, lightDir ) );

        float dist = length(vPosition - nucleusPosition);
        float attenuation = 1.0 / (1.0 + 0.1 * dist * dist);

        float ambient = 0.4;

        vec3 viewDir = normalize(camPos - vPosition);
        vec3 reflectDir = reflect(-lightDir, normal);
        float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

        float intensity = ambient + (diffuse + specular) * attenuation;
        intensity = clamp(intensity, 0.2, 1.0); // Prevent extreme dark/light areas

        float scaledProbability = clamp(exp(-vProbability * 1.4), 0.0, 1.0);

        vec3 colour = getColourmap(scaledProbability, colourMap);
        colour *= intensity;

        float rim = 1.0 - max(dot(normalize(vNormal), normalize(vPosition)), 0.0);
        vec3 rimColor = colour * 0.6 * pow(rim, 20.0); // Adjust for intensity
        colour += rimColor;

        //float smoothColourChange = sin(length(vPosition.xyz) * 5.0 - time * 3.0) * 0.5 + 0.5;
        //colour += vec3(1.0, 1.0, 1.0) * smoothColourChange * 0.2;

        if (vPosition.z > 0.0 && vPosition.y > 0.0 && showInside) discard;

	    gl_FragColor = vec4(colour, 1.0);
	}
`;

export { vertShader, fragShader }