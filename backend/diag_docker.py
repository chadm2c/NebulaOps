import docker
import os

print("Testing Docker Connection Methods...")

methods = [
    ("from_env", lambda: docker.from_env()),
    ("named_pipe", lambda: docker.DockerClient(base_url='npipe:////./pipe/docker_engine')),
    ("localhost", lambda: docker.DockerClient(base_url='tcp://localhost:2375')),
]

for name, method in methods:
    print(f"\n--- Method: {name} ---")
    try:
        client = method()
        version = client.version()
        print(f"SUCCESS: Connected! Docker Version: {version.get('Version')}")
        print(f"Containers: {len(client.containers.list())}")
    except Exception as e:
        print(f"FAILED: {e}")

print("\n--- Environment Variables ---")
for key, value in os.environ.items():
    if "DOCKER" in key:
        print(f"{key}: {value}")
