import docker
import sys

try:
    client = docker.from_env()
    print("SUCCESS: Connection established.")
    print("Containers alive:", len(client.containers.list()))
    for c in client.containers.list():
        print(f" - {c.name} ({c.status})")
except Exception as e:
    print(f"FAILURE: {e}")
    sys.exit(1)
