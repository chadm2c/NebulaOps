from typing import List, Dict, Any
from .llm_client import llm_client

class InfrastructureExplainer:
    def __init__(self):
        self.system_prompt = """
        You are NebulaAI's architect module. 
        Explain the overall infrastructure topology clearly for an executive report.
        Describe the relationships between service clusters and evaluate global cluster health.
        Use futuristic, high-tech terminology like "constellations", "neural pathways", and "system equilibrium".
        """

    def explain(self, containers: List[Dict[str, Any]], clusters: List[Dict[str, Any]]) -> str:
        """
        Generates a global overview of the entire infrastructure using LLM.
        """
        if not containers:
            return "The celestial void is empty. No infrastructure detected."

        infra_data = {
            "node_count": len(containers),
            "cluster_count": len(clusters),
            "clusters": [
                {
                    "name": cl.get('name'),
                    "members": len(cl.get('containers', [])),
                    "image": cl.get('image_pattern')
                } for cl in clusters
            ],
            "global_vitals": {
                "avg_cpu": sum(c.get('cpu_percent', 0) for c in containers) / len(containers),
                "avg_mem": sum(c.get('memory_percent', 0) for c in containers) / len(containers)
            }
        }

        user_prompt = f"Analyze and explain this infrastructure topology:\n{infra_data}"
        
        return llm_client.query(self.system_prompt, user_prompt)
