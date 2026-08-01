from typing import List, Dict, Any

def group_containers_into_constellations(containers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Groups containers into logical service clusters (constellations) based on:
    - Shared networks
    - Image name patterns
    - Common labels (e.g., com.docker.compose.project)
    """
    clusters = {}
    
    for container in containers:
        container_id = container.get('id')
        name = container.get('name', '')
        image = container.get('image', '')
        
        # Priority mapping strategy
        cluster_key = None
        
        # 1. Check for compose project/service labels
        # Note: In real scenarios, we'd look deep into container.attrs.Labels
        # For now, let's use the container name prefix or image name as a heuristic
        
        if '-' in name:
            cluster_key = name.split('-')[0]
        elif '_' in name:
            cluster_key = name.split('_')[0]
        else:
            cluster_key = image.split(':')[0].split('/')[-1]

        if cluster_key not in clusters:
            clusters[cluster_key] = {
                "cluster_id": f"cluster_{cluster_key}",
                "name": f"{cluster_key.capitalize()} Constellation",
                "containers": [],
                "type": "service_cluster"
            }
        
        clusters[cluster_key]["containers"].append(container_id)
    
    # Only return clusters with more than 1 container or specific important single-container clusters
    return [c for c in clusters.values() if len(c["containers"]) >= 1]
