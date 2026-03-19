'use client'

import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function GlobeMesh({ rotating }: { rotating: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame(() => {
    if (!rotating) return
    meshRef.current.rotation.y += 0.004
    meshRef.current.rotation.x += 0.0008
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.5, 36, 36]} />
      <meshBasicMaterial
        color="#2BBDD4"
        wireframe
        transparent
        opacity={0.18}
      />
    </mesh>
  )
}

interface GlobeHeroProps {
  rotating?: boolean
}

export function GlobeHero({ rotating = true }: GlobeHeroProps) {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className="absolute inset-0 pointer-events-none"
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <GlobeMesh rotating={rotating} />
        </Suspense>
      </Canvas>
    </div>
  )
}
