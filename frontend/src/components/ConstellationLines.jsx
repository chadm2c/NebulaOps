import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

function ConstellationLines({ containers, clusters }) {
  const { lines, labels } = useMemo(() => {
    const linePoints = []
    const clusterLabels = []
    
    if (!clusters || !containers) return { lines: [], labels: [] }
    
    const containerMap = {}
    containers.forEach(c => {
      if (c.position) containerMap[c.id] = c.position
    })
    
    clusters.forEach(cluster => {
      const clusterPositions = cluster.containers
        .map(id => containerMap[id])
        .filter(pos => !!pos)
      
      if (clusterPositions.length >= 2) {
        // Create a central point for the constellation label
        let avgX = 0, avgY = 0, avgZ = 0
        
        for (let i = 0; i < clusterPositions.length; i++) {
          const p1 = clusterPositions[i]
          const p2 = clusterPositions[(i + 1) % clusterPositions.length]
          
          linePoints.push(new THREE.Vector3(p1.x, p1.y, p1.z))
          linePoints.push(new THREE.Vector3(p2.x, p2.y, p2.z))
          
          avgX += p1.x
          avgY += p1.y
          avgZ += p1.z
        }
        
        clusterLabels.push({
          id: cluster.cluster_id,
          name: cluster.name,
          position: [
            avgX / clusterPositions.length,
            avgY / clusterPositions.length + 2,
            avgZ / clusterPositions.length
          ]
        })
      }
    })
    
    return { lines: linePoints, labels: clusterLabels }
  }, [containers, clusters])

  return (
    <group>
      {/* Constellation Lines */}
      {lines.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={lines.length}
              array={new Float32Array(lines.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#8a2be2" transparent opacity={0.3} />
        </lineSegments>
      )}

      {/* Constellation Labels */}
      {labels.map(label => (
        <Html
          key={label.id}
          position={label.position}
          center
          distanceFactor={15}
          zIndexRange={[100, 0]}
        >
          <div style={{
            color: '#8a2be2',
            fontSize: '9px',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textShadow: '0 0 5px rgba(138, 43, 226, 0.5)',
            opacity: 0.6
          }}>
            {label.name}
          </div>
        </Html>
      ))}
    </group>
  )
}

export default ConstellationLines
