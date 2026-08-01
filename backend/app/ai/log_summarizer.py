from .llm_client import llm_client

class LogSummarizer:
    def __init__(self):
        self.system_prompt = """
        You are an expert SRE / DevOps engineer. 
        Summarize the provided container logs into a concise "Situation Report".
        Identify the root cause of any errors or warnings.
        Keep the summary under 3 sentences.
        If the logs are nominal, state that clearly.
        """

    def summarize(self, logs: str) -> str:
        """
        Summarizes container logs into a concise AI report using LLM.
        """
        if not logs or logs.strip() == "":
            return "No log stream detected. Container may be in an idle or silent state."
            
        return llm_client.query(self.system_prompt, f"Logs to summarize:\n{logs}")
