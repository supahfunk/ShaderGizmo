import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ArcballControls, TransformControls } from '@react-three/drei'
import { Vector3, Color } from 'three'
import { useControls } from 'leva'
import './styles.css'

const Torus = () => {
	const $material = useRef()
	const $sphere = useRef()

	const { uThresholdMin, uThresholdMax } = useControls({
		uThresholdMin: {
			value: -0.2,
			min: -1,
			max: 1
		},
		uThresholdMax: {
			value: 2,
			min: -1,
			max: 4
		}
	})

	const args = useMemo(
		() => ({
			uniforms: {
				uDirLightPos: { value: new Vector3(2, 3, 3) },
				uDirLightColor: { value: new Color(0xeeeeee) },
				uAmbientLightColor: { value: new Color(0x333333) },
				uBaseColor: { value: new Color(0xff0000) },
				uTime: { value: 0 },
				uRadius: { value: 1 },
				uMorph: { value: new Vector3(0, 0, 0) },
				uThresholdMin: { value: 0.2 },
				uThresholdMax: { value: 2 }
			},

			vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uRadius;
      uniform vec3 uMorph;
			uniform float uThresholdMin;
			uniform float uThresholdMax;
      varying vec3 vNormal;
      varying vec3 vRefract;
      varying float vDist;

			float displace(vec3 point) {
        float d = distance(uMorph, point);
        return smoothstep(uThresholdMin, uThresholdMax, uRadius - d);
      }

			vec3 orthogonal(vec3 v) {
        return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0)
        : vec3(0.0, -v.z, v.y));
      }
			
      void main() {
        vec3 pos = position + normal * displace(position);
				float dist = smoothstep(uThresholdMin, uThresholdMax, 1.-distance(uMorph, pos));
        vDist = dist;

        vec4 worldPosition = modelMatrix * vec4( pos, 1.0 );
        vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
        vec3 worldNormal = normalize ( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
				
				// Thanks to @MarcoFugaro
				float offset = 0.1;
				vec3 tangent = orthogonal(normal);
				vec3 bitangent = normalize(cross(normal, tangent));
				vec3 neighbour1 = position + tangent * offset;
				vec3 neighbour2 = position + bitangent * offset;
				vec3 displacedNeighbour1 = neighbour1 + normal * displace(neighbour1);
				vec3 displacedNeighbour2 = neighbour2 + normal * displace(neighbour2);

				// https://i.ya-webdesign.com/images/vector-normals-tangent-16.png
				vec3 displacedTangent = displacedNeighbour1 - pos;
				vec3 displacedBitangent = displacedNeighbour2 - pos;

				// https://upload.wikimedia.org/wikipedia/commons/d/d2/Right_hand_rule_cross_product.svg
				vec3 displacedNormal = normalize(cross(displacedTangent, displacedBitangent));
				
				vNormal = normalize( normalMatrix * displacedNormal);

        vec3 I = worldPosition.xyz - cameraPosition;
        vRefract = refract( normalize( I ), worldNormal, 1.02 );
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
			fragmentShader: /* glsl */ `
        uniform vec3 uBaseColor;
        uniform vec3 uDirLightPos;
        uniform vec3 uDirLightColor;
        uniform vec3 uAmbientLightColor;
        varying float vDist;
        varying vec3 vNormal;
        varying vec3 vRefract;
        
        void main() {
          float directionalLightWeighting = max( dot( normalize( vNormal ), uDirLightPos ), 0.0);
          vec3 lightWeighting = uAmbientLightColor + uDirLightColor * directionalLightWeighting;
          float intensity = smoothstep( - 0.5, 1.0, pow( length(lightWeighting), 20.0 ) );
          intensity += length(lightWeighting) * 0.2;
          intensity = intensity * 0.2 + 0.3 + 0.4 * vDist;
          vec3 color = mix(uBaseColor, vec3(1., 1., 0.), smoothstep(0., 0.6, vDist));
          gl_FragColor = vec4( 1.0 - 2.0 * ( 1.0 - intensity ) * ( 1.0 - color ), 1.0 );
        }
      `
		}),
		[]
	)

	useEffect(() => {
		if ($material.current) {
			$material.current.uniforms.uThresholdMin.value = uThresholdMin
			$material.current.uniforms.uThresholdMax.value = uThresholdMax
		}
	}, [uThresholdMin, uThresholdMax])

	useFrame(({ clock }) => {
		if ($material.current) {
			// $material.current.uniforms.uTime.value = clock.getElapsedTime()
			$material.current.uniforms.uMorph.value = $sphere.current.parent.position
		}
	})

	useEffect(() => {}, [])

	return (
		<>
			<TransformControls position={[-1, 0.4, 0.4]}>
				<mesh ref={$sphere}>
					<sphereGeometry args={[0.01, 32, 32]} />
					<meshBasicMaterial />
				</mesh>
			</TransformControls>
			<mesh>
				<torusGeometry args={[1, 0.25, 120, 120]} />
				<shaderMaterial ref={$material} args={[args]} />
			</mesh>
		</>
	)
}

export default function App() {
	const [orbitEnabled, setOrbitEnabled] = useState(true)
	useEffect(() => {
		setTimeout(() => {
			setOrbitEnabled(false)
		}, 200)
	}, [])

	const handleKeyDown = (e) => {
		if (e.key === 'r') {
			setOrbitEnabled(true)
		}
	}

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown)
		window.addEventListener('keyup', () => {
			setOrbitEnabled(false)
		})
	}, [])

	return (
		<>
			<Canvas
				className="canvas"
				camera={{
					position: [0, -4, 5]
				}}
			>
				<ArcballControls
					enableRotate={orbitEnabled}
					dampingFactor={0.01}
					enablePan={false}
				/>
				<Torus />
			</Canvas>
			<div className="hint">Press R to rotate</div>
		</>
	)
}
