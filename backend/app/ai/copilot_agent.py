from typing import List, Dict, Any
from .llm_client import llm_client

class CopilotAgent:
    def __init__(self):
        self.system_prompt = """
        You are NebulaAI, a DevOps Copilot for a 3D Docker Infrastructure Visualizer.
        Your goal is to provide high-level architectural insights and operational recommendations.
        Be concise, professional, and slightly futuristic.
        Analyze the infrastructure state (containers, clusters, incidents) and suggest optimizations or warn of risks.
        """

    def analyze_infrastructure(self, containers: List[Dict[str, Any]], clusters: List[Dict[str, Any]], incidents: List[Dict[str, Any]]) -> str:
        if not containers:
            return "The galaxy is empty. Deploy services to begin architectural analysis."

        # Simplify data for the prompt
        cluster_info = []
        for c in containers:
            cluster_info.append({
                "name": c.get('name'),
                "image": c.get('image'),
                "status": c.get('status'),
                "cpu": f"{c.get('cpu_percent', 0)}%",
                "mem": f"{c.get('memory_percent', 0)}%"
            })

        user_prompt = f"""
        Infrastructure State Snapshot:
        - Total Containers: {len(containers)}
        - Logical Constellations (Clusters): {len(clusters)}
        - Active Incidents: {len(incidents)}
        
        Container Details:
        {cluster_info}
        
        Provide one core architectural insight and one proactive action item based on this data.
        """
        
        return llm_client.query(self.system_prompt, user_prompt)

    def get_action_recommendation(self, container: Dict[str, Any]) -> str:
        """
        Provides specific advice for a selected container using LLM.
        """
        system_prompt = "You are an expert DevOps engineer. Provide a 1-sentence action recommendation for the given container state."
        user_prompt = f"Container: {container.get('name')}\nImage: {container.get('image')}\nStatus: {container.get('status')}\nCPU: {container.get('cpu_percent') or 0}%\nMEM: {container.get('memory_percent') or 0}%"
        
        return llm_client.query(system_prompt, user_prompt)

    def chat(self, user_message: str, history: List[Dict[str, str]], context: Dict[str, Any]) -> str:
        """
        Engages in a conversation with the user, using the current infrastructure state as context.
        """
        containers = context.get('containers', [])
        clusters = context.get('clusters', [])
        incidents = context.get('incidents', [])

        context_prompt = f"""
        Current Infrastructure Context:
        - Active Containers: {len(containers)}
        - Logical Clusters: {len(clusters)}
        - Detected Incidents: {len(incidents)}
        
        Quick Snapshot:
        {[{'name': c.get('name'), 'status': c.get('status')} for c in containers[:10]]}
        """

        full_system_prompt = self.system_prompt + "\n" + context_prompt + "\nAnswer user questions about the infrastructure or DevOps in general. Be helpful and technically precise."
        
        # In a real app we'd pass the history to the LLM client, but here we'll simplify for the query method
        # and just prepend history to the user prompt if needed, or update LLMClient to handle messages.
        # Since LLMClient.query takes system and user prompts, let's format history into the user prompt.
        
        history_text = ""
        for msg in history[-5:]: # Keep last 5 messages for brevity
            role = "User" if msg['role'] == 'user' else "NebulaAI"
            history_text += f"{role}: {msg['content']}\n"
        
        final_user_prompt = f"Previous conversation history:\n{history_text}\nCurrent User Question: {user_message}"
        
        return llm_client.query(full_system_prompt, final_user_prompt)
