import os
from openai import OpenAI

class LLMClient:
    def __init__(self):
        self.api_key = os.getenv("GITHUB_TOKEN") or os.getenv("OPENAI_API_KEY")
        self.base_url = "https://models.inference.ai.azure.com" if os.getenv("GITHUB_TOKEN") else None
        
        if self.api_key:
            self.client = OpenAI(
                base_url=self.base_url,
                api_key=self.api_key,
            )
        else:
            self.client = None

    def query(self, system_prompt: str, user_prompt: str) -> str:
        if not self.client:
            return "AI engine offline: Missing API key (GITHUB_TOKEN/OPENAI_API_KEY)."
        
        try:
            response = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model="gpt-4o" if not self.base_url else "gpt-4o", # GitHub models compatible
                temperature=0.7,
                max_tokens=500,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Neural link failure: {str(e)}"

# Singleton instance
llm_client = LLMClient()
