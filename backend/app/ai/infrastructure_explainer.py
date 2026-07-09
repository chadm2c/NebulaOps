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

    def explain(self, containers: List[Dict[str, Any]], clusters: List[Dict[str, Any]]) -> dict:
        """
        Generates a global overview of the entire infrastructure using LLM.
        Returns {"explanation": str, "metrics": dict} with structured data.
        """
        if not containers:
            return {
                "explanation": "The celestial void is empty. No infrastructure detected.",
                "metrics": {"node_count": 0, "cluster_count": 0, "avg_cpu": 0, "avg_mem": 0, "clusters": [], "health": "empty"}
            }

        health = "healthy"
        cluster_details = []
        for cl in clusters:
            member_ids = cl.get('containers', [])
            member_containers = [c for c in containers if c.get('id') in member_ids or c.get('name') in member_ids]
            avg_cpu = sum(c.get('cpu_percent', 0) for c in member_containers) / len(member_containers) if member_containers else 0
            avg_mem = sum(c.get('memory_percent', 0) for c in member_containers) / len(member_containers) if member_containers else 0
            cluster_details.append({
                "name": cl.get('name', 'unknown'),
                "members": len(member_containers),
                "avg_cpu": round(avg_cpu, 1),
                "avg_mem": round(avg_mem, 1)
            })

        avg_cpu = sum(c.get('cpu_percent', 0) for c in containers) / len(containers)
        avg_mem = sum(c.get('memory_percent', 0) for c in containers) / len(containers)

        if avg_cpu > 80 or avg_mem > 90:
            health = "critical"
        elif avg_cpu > 50 or avg_mem > 70:
            health = "degraded"

        infra_data = {
            "node_count": len(containers),
            "cluster_count": len(clusters),
            "clusters": cluster_details,
            "avg_cpu": round(avg_cpu, 1),
            "avg_mem": round(avg_mem, 1),
            "health": health
        }

        user_prompt = f"Analyze and explain this infrastructure topology:\n{infra_data}"
        explanation = llm_client.query(self.system_prompt, user_prompt)

        return {
            "explanation": explanation,
            "metrics": infra_data
        }
