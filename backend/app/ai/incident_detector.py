from typing import List, Dict, Any

def detect_incidents(containers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scans containers for resource anomalies and generates incident events.
    """
    incidents = []
    
    for container in containers:
        cpu = container.get('cpu_percent', 0)
        mem = container.get('memory_percent', 0)
        name = container.get('name', 'unknown')
        container_id = container.get('id')
        
        # Critical resource threshold
        if cpu > 80:
            incidents.append({
                "incident_type": "resource_spike",
                "container_id": container_id,
                "container_name": name,
                "severity": "critical",
                "metrics": {"cpu": cpu},
                "explanation": f"High CPU usage ({cpu}%) detected. Potential processing bottleneck."
            })
            
        if mem > 90:
            incidents.append({
                "incident_type": "memory_saturation",
                "container_id": container_id,
                "container_name": name,
                "severity": "critical",
                "metrics": {"memory": mem},
                "explanation": f"Memory saturation ({mem}%) detected. Risk of OOM kill."
            })

    return incidents
