import os
import json
import asyncio
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import math
import random
import time
import threading
import socket
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.ai.constellation_mapper import group_containers_into_constellations
from app.ai.incident_detector import detect_incidents
from app.ai.copilot_agent import CopilotAgent
from app.ai.log_summarizer import LogSummarizer
from app.ai.infrastructure_explainer import InfrastructureExplainer

copilot = CopilotAgent()
log_summarizer = LogSummarizer()
explainer = InfrastructureExplainer()

DOCKER_CLIENT = None
DOCKER_AVAILABLE = False

def get_docker_client():
    global DOCKER_CLIENT, DOCKER_AVAILABLE
    if DOCKER_CLIENT:
        try:
            DOCKER_CLIENT.ping()
            return DOCKER_CLIENT
        except:
            DOCKER_CLIENT = None
    try:
        import docker
        DOCKER_CLIENT = docker.from_env()
        DOCKER_CLIENT.ping()
        DOCKER_AVAILABLE = True
        print("Successfully connected to Docker engine.")
        return DOCKER_CLIENT
    except Exception as e:
        print(f"Docker connection error: {e}")
        DOCKER_CLIENT = None
        DOCKER_AVAILABLE = False
        return None

async def _safe_close(websocket: WebSocket):
    try:
        from starlette.websockets import WebSocketState
        if websocket.client_state in (WebSocketState.CONNECTING, WebSocketState.CONNECTED):
            await websocket.close()
    except Exception:
        pass

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()

demo_containers_config = [
    {'name': 'api-gateway', 'image': 'nginx:latest', 'network': 'app-network'},
    {'name': 'auth-service', 'image': 'node:18-alpine', 'network': 'app-network'},
    {'name': 'user-service', 'image': 'node:18-alpine', 'network': 'app-network'},
    {'name': 'postgres-db', 'image': 'postgres:15', 'network': 'app-network'},
    {'name': 'redis-cache', 'image': 'redis:alpine', 'network': 'app-network'},
    {'name': 'monitoring', 'image': 'prometheus:latest', 'network': None},
    {'name': 'grafana', 'image': 'grafana:latest', 'network': None},
    {'name': 'elasticsearch', 'image': 'elasticsearch:8', 'network': None},
    {'name': 'kibana', 'image': 'kibana:8', 'network': None},
    {'name': 'rabbitmq', 'image': 'rabbitmq:3', 'network': None},
    {'name': 'jenkins', 'image': 'jenkins:latest', 'network': None},
    {'name': 'minio', 'image': 'minio:latest', 'network': None},
]

def distribute_containers(num_containers: int) -> List[Dict[str, Any]]:
    positions = []
    if num_containers == 0:
        return positions
    
    if num_containers == 1:
        positions.append({'x': 0, 'y': 0, 'z': 0})
        return positions
    
    layers = []
    layer_size = 1
    remaining = num_containers
    
    while remaining > 0:
        count = min(layer_size * 6, remaining)
        layers.append(count)
        remaining = int(remaining - count)
        layer_size += 1
    
    layer_radius = 4
    
    for layer_idx, count_in_layer in enumerate(layers):
        y = layer_idx * 3 - (len(layers) * 3) / 2
        
        for i in range(count_in_layer):
            angle = (i / count_in_layer) * 2 * math.pi
            x = layer_radius * math.cos(angle)
            z = layer_radius * math.sin(angle)
            
            jitter_x = random.uniform(-0.5, 0.5)
            jitter_y = random.uniform(-0.5, 0.5)
            jitter_z = random.uniform(-0.5, 0.5)
            
            positions.append({
                'x': round(float(x + jitter_x), 2),
                'y': round(float(y + jitter_y), 2),
                'z': round(float(z + jitter_z), 2)
            })
        
        layer_radius += 4
    
    return positions

def get_real_containers() -> List[Dict[str, Any]] | None:
    client = get_docker_client()
    if not client:
        return None
    
    try:
        containers = client.containers.list()
        result = []
        
        positions = distribute_containers(len(containers))
        
        for i, container in enumerate(containers):
            stats = container.stats(stream=False)
            
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
            system_cpu_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
            num_cpus = stats['cpu_stats'].get('online_cpus', len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [1])))
            
            cpu_percent = 0.0
            if system_cpu_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_cpu_delta) * num_cpus * 100.0
            
            mem_usage = stats['memory_stats'].get('usage', 0)
            mem_limit = stats['memory_stats'].get('limit', 1)
            mem_percent = (mem_usage / mem_limit) * 100.0
            
            network_rx = 0
            network_tx = 0
            networks = stats.get('networks', {})
            for net in networks.values():
                network_rx += net.get('rx_bytes', 0)
                network_tx += net.get('tx_bytes', 0)
            
            pos = positions[i] if i < len(positions) else {'x': 0, 'y': 0, 'z': 0}
            
            result.append({
                'id': container.id[:12],
                'name': container.name,
                'image': container.image.tags[0] if container.image.tags else container.image.short_id,
                'status': container.status,
                "cpu_percent": round(cpu_percent, 2),
                "memory_percent": round(mem_percent, 2),
                "memory_usage": round(mem_usage, 2),
                'network_rx': network_rx,
                'network_tx': network_tx,
                'created': container.attrs.get('Created', time.time()),
                'state': container.attrs.get('State', {}),
                'position': pos
            })
        
        return result
    except Exception as e:
        import traceback
        print(f"Error fetching containers: {e}")
        traceback.print_exc()
        return None

def get_demo_containers() -> List[Dict[str, Any]]:
    positions = distribute_containers(len(demo_containers_config))
    
    result = []
    for i, c in enumerate(demo_containers_config):
        pos = positions[i] if i < len(positions) else {'x': 0, 'y': 0, 'z': 0}
        
        result.append({
            'id': f"demo-{i+1}",
            'name': c['name'],
            'image': c['image'],
            'status': 'running',
            'network': c.get('network', None),
            'cpu_percent': round(float(random.uniform(1, 45)), 2),
            'memory_percent': round(float(random.uniform(10, 80)), 2),
            'memory_usage': random.randint(50000000, 500000000),
            'network_rx': random.randint(1000, 100000),
            'network_tx': random.randint(1000, 100000),
            'created': time.time() - random.randint(3600, 86400 * 7),
            'state': {'Running': True, 'Paused': False},
            'position': pos
        })
    
    return result

@app.on_event("startup")
async def startup_event():
    print("Startup: Checking Docker connection...")
    get_docker_client()

    if not os.getenv("GITHUB_TOKEN") and not os.getenv("OPENAI_API_KEY"):
        print("=" * 50)
        print("NebulaAI Copilot is offline.")
        print("To enable AI features, create a file named '.env'")
        print("in the project root (next to docker-compose.yml):")
        print("")
        print("  GITHUB_TOKEN=ghp_your_github_token")
        print("")
        print("Then run: docker compose down && docker compose up")
        print("See backend/.env.example for details.")
        print("=" * 50)

@app.get("/api/containers")
async def get_containers():
    real_containers = get_real_containers()
    if real_containers is not None:
        return real_containers
    return get_demo_containers()

@app.get("/api/docker-status")
async def docker_status():
    return {"available": DOCKER_AVAILABLE}

@app.get("/api/debug-docker")
async def debug_docker():
    client = get_docker_client()
    status = "Connected" if client else "Failed"
    return {
        "status": status,
        "available": DOCKER_AVAILABLE,
        "client_info": str(client) if client else "None"
    }

@app.post("/api/containers/{container_id}/start")
async def start_container(container_id: str):
    client = get_docker_client()
    if not client:
        return {"success": False, "error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        container.start()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/containers/{container_id}/stop")
async def stop_container(container_id: str):
    client = get_docker_client()
    if not client:
        return {"success": False, "error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        container.stop()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/containers/{container_id}/kill")
async def kill_container(container_id: str):
    client = get_docker_client()
    if not client:
        return {"success": False, "error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        container.kill()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/containers/{container_id}/restart")
async def restart_container(container_id: str):
    client = get_docker_client()
    if not client:
        return {"success": False, "error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        container.restart()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/containers/{container_id}/pause")
async def pause_container(container_id: str):
    client = get_docker_client()
    if not client:
        return {"success": False, "error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        container.pause()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/containers/{container_id}/unpause")
async def unpause_container(container_id: str):
    client = get_docker_client()
    if not client:
        return {"success": False, "error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        container.unpause()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/containers/{container_id}/ai-logs")
async def get_container_ai_logs(container_id: str):
    if not DOCKER_AVAILABLE:
        return {"summary": "AI Summarization unavailable: Docker connection failed."}
    try:
        container = DOCKER_CLIENT.containers.get(container_id)
        raw_logs = container.logs(tail=100).decode('utf-8')
        summary = log_summarizer.summarize(raw_logs)
        return {"summary": summary}
    except Exception as e:
        return {"summary": f"AI Summarization error: {str(e)}"}

@app.get("/api/ai/explain")
async def explain_infrastructure():
    if not DOCKER_AVAILABLE:
        return {"explanation": "Temporal analysis unavailable: Docker engine offline.", "metrics": None}
    try:
        containers = [
            {
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image and c.image.tags else "unknown",
                "network": list(c.attrs.get('NetworkSettings', {}).get('Networks', {}).keys())[0] if c.attrs.get('NetworkSettings', {}).get('Networks') else "none"
            } for c in DOCKER_CLIENT.containers.list()
        ]
        clusters = group_containers_into_constellations(containers)
        result = explainer.explain(containers, clusters)
        return result
    except Exception as e:
        return {"explanation": f"AI Analysis failed: {str(e)}", "metrics": None}

@app.get("/api/containers/{container_id}/logs")
async def get_container_logs(container_id: str, tail: int = 100):
    client = get_docker_client()
    if not client:
        return {"logs": []}
    try:
        container = client.containers.get(container_id)
        logs = container.logs(tail=tail, timestamps=True).decode('utf-8').split('\n')
        return {"logs": [log for log in logs if log]}
    except Exception as e:
        return {"logs": [], "error": str(e)}

@app.get("/api/containers/{container_id}/stats")
async def get_container_stats(container_id: str):
    client = get_docker_client()
    if not client:
        return {"error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        stats = container.stats(stream=False)
        
        cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
        system_cpu_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
        num_cpus = stats['cpu_stats'].get('online_cpus', 1)
        
        cpu_percent = 0.0
        if system_cpu_delta > 0 and cpu_delta > 0:
            cpu_percent = (cpu_delta / system_cpu_delta) * num_cpus * 100.0
        
        mem_usage = stats['memory_stats'].get('usage', 0)
        mem_limit = stats['memory_stats'].get('limit', 1)
        mem_percent = (mem_usage / mem_limit) * 100.0
        
        network_rx = 0
        network_tx = 0
        networks = stats.get('networks', {})
        for net in networks.values():
            network_rx += net.get('rx_bytes', 0)
            network_tx += net.get('tx_bytes', 0)
        
        block_read = 0
        block_write = 0
        blkio_stats = stats.get('blkio_stats', {}).get('io_service_bytes_recursive', [])
        for blk in blkio_stats:
            if blk['op'] == 'read' or blk['op'] == 'Read':
                block_read = int(block_read + blk['value'])
            elif blk['op'] == 'write' or blk['op'] == 'Write':
                block_write = int(block_write + blk['value'])
        
        return {
            "cpu_percent": round(float(cpu_percent), 2),
            "memory_percent": round(float(mem_percent), 2),
            "memory_usage": mem_usage,
            "network_rx": network_rx,
            "network_tx": network_tx,
            "block_read": block_read,
            "block_write": block_write
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/containers/{container_id}/inspect")
async def inspect_container(container_id: str):
    client = get_docker_client()
    if not client:
        return {"error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        return container.attrs
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/containers/{container_id}/volumes")
async def get_container_volumes(container_id: str):
    client = get_docker_client()
    if not client:
        return {"volumes": []}
    try:
        container = client.containers.get(container_id)
        mounts = container.attrs.get('Mounts', [])
        volumes = []
        for mount in mounts:
            volumes.append({
                "Source": mount.get('Source', ''),
                "Destination": mount.get('Destination', ''),
                "Mode": mount.get('Mode', ''),
                "Type": mount.get('Type', '')
            })
        return {"volumes": volumes}
    except Exception as e:
        return {"volumes": [], "error": str(e)}

@app.post("/api/containers/{container_id}/exec")
async def exec_container(container_id: str, request: dict):
    client = get_docker_client()
    if not client:
        return {"error": "Docker not available"}
    try:
        container = client.containers.get(container_id)
        cmd = request.get('cmd', 'ls')
        result = container.exec_run(cmd)
        return {
            "output": result.output.decode('utf-8'),
            "exit_code": result.exit_code
        }
    except Exception as e:
        return {"error": str(e)}

@app.websocket("/ws/terminal/{container_id}")
async def terminal_websocket(websocket: WebSocket, container_id: str):
    await websocket.accept()
    client = get_docker_client()
    if not client:
        await websocket.send_text("Error: Docker not available")
        await _safe_close(websocket)
        return

    try:
        # Probe shells in order of likelihood: /bin/sh exists on virtually
        # every Linux image; bash is the most common interactive shell.
        # A "which <shell>" exec is run inside the container to verify the
        # binary exists before committing — docker exec_create succeeds even
        # when the binary is missing, so the probe prevents silent PTY death.
        shells = ["sh", "bash", "ash", "zsh", "powershell", "cmd"]
        exec_id = None

        for shell in shells:
            try:
                container_obj = client.containers.get(container_id)
                exit_code, output = container_obj.exec_run(f"which {shell}", stderr=False)
                if exit_code == 0 and output.strip():
                    print(f"Shell probe: {shell} exists in container {container_id}")
                else:
                    continue
                exec_instance = client.api.exec_create(
                    container_id,
                    shell,
                    stdin=True,
                    stdout=True,
                    stderr=True,
                    tty=True
                )
                exec_id = exec_instance['Id']
                break
            except Exception as e:
                print(f"Shell probe failed for {shell} in {container_id}: {type(e).__name__}: {e}")
                continue

        if not exec_id:
            # Last resort: try sh directly without probe (handles containers
            # where which itself is missing, e.g. distroless with sh only).
            try:
                exec_instance = client.api.exec_create(
                    container_id,
                    "sh",
                    stdin=True,
                    stdout=True,
                    stderr=True,
                    tty=True
                )
                exec_id = exec_instance['Id']
                print(f"Fallback: sh accepted for container {container_id}")
            except Exception as e:
                await websocket.send_text(
                    "Error: No supported shell found in container "
                    "(tried sh, bash, ash, zsh, powershell, cmd)"
                )
                print(f"FAILED to find shell for container {container_id}")
                await _safe_close(websocket)
                return
        
        print(f"Successfully created exec {exec_id} for container {container_id}")
        
        # Start the exec instance and get a socket-like object
        sock = client.api.exec_start(exec_id, detach=False, tty=True, socket=True)
        print(f"Socket obtained for {container_id}: {type(sock)}")

        # Apply a sane default PTY size immediately after exec_start so the PTY
        # is sized before any client resize races in. A "not started" 400 here
        # is non-fatal and handled silently — the exec process is in fact
        # running; only the resize call lags.
        try:
            client.api.exec_resize(exec_id, height=24, width=80)
        except Exception as e:
            print(f"Initial exec_resize skipped for {container_id}: {type(e).__name__}: {e}")

        # Cache socket read/write methods once (blocking reads — no timeout)
        if hasattr(sock, 'recv'):
            sock_read = sock.recv
        elif hasattr(sock, 'read'):
            sock_read = sock.read
        elif hasattr(sock, '_sock') and hasattr(sock._sock, 'recv'):
            sock_read = sock._sock.recv
        else:
            await websocket.send_text("Error: Cannot determine socket read method")
            await _safe_close(websocket)
            return

        if hasattr(sock, 'send'):
            sock_write = sock.send
        elif hasattr(sock, 'write'):
            sock_write = sock.write
        elif hasattr(sock, '_sock') and hasattr(sock._sock, 'send'):
            sock_write = sock._sock.send
        else:
            await websocket.send_text("Error: Cannot determine socket write method")
            await _safe_close(websocket)
            return
        
        # Disable Nagle's algorithm on the Docker exec socket when the
        # underlying transport exposes a raw IP socket. Some SDK return a
        # SocketIO wrapper that does not support setsockopt — log and move on.
        raw_sock = sock if hasattr(sock, 'setsockopt') else getattr(sock, '_sock', None)
        if raw_sock:
            try:
                raw_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            except Exception as e:
                print(f"Could not set TCP_NODELAY for {container_id}: {type(e).__name__}: {e}")
        
        stop_event = threading.Event()
        socket_closed = False
        
        # Get the running event loop for thread-to-async communication
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()

        # Env-gated terminal debug logger — set TERMINAL_DEBUG=1 to enable
        _terminal_debug = os.environ.get("TERMINAL_DEBUG") == "1"
        _td_window_start = [time.monotonic()]
        _td_frame_count = [0]
        _td_byte_count = [0]

        def _td_log_frame(byte_len):
            if not _terminal_debug:
                return
            now = time.monotonic()
            _td_frame_count[0] += 1
            _td_byte_count[0] += byte_len
            elapsed = now - _td_window_start[0]
            if elapsed >= 1.0:
                kbps = _td_byte_count[0] / 1024.0
                mean_gap = (elapsed * 1000.0 / _td_frame_count[0]) if _td_frame_count[0] else 0
                print(f"[terminal:{container_id}] {_td_frame_count[0]} frames, "
                      f"{kbps:.2f} KB/s, mean gap {mean_gap:.2f}ms")
                _td_window_start[0] = now
                _td_frame_count[0] = 0
                _td_byte_count[0] = 0

        def socket_to_ws():
            nonlocal socket_closed
            try:
                while not stop_event.is_set():
                    try:
                        t_recv = time.monotonic() if _terminal_debug else 0
                        data = sock_read(4096)

                        if data:
                            pass
                        else:
                            if stop_event.is_set(): break
                            print(f"Container {container_id} PTY stream ended (no data)")
                            break

                        if _terminal_debug:
                            _td_log_frame(len(data) if isinstance(data, (bytes, bytearray)) else 0)

                        asyncio.run_coroutine_threadsafe(
                            websocket.send_bytes(data),
                            loop
                        )
                    except Exception as e:
                        if not stop_event.is_set():
                            print(f"Socket read error for {container_id}: {e}")
                        break
            finally:
                if not socket_closed:
                    try:
                        sock.close()
                        socket_closed = True
                    except:
                        pass

        # Send an initial newline to trigger a prompt
        try:
            sock_write(b"\n")
        except:
            pass

        thread = threading.Thread(target=socket_to_ws, daemon=True)
        thread.start()

        async def heartbeat():
            try:
                while True:
                    await asyncio.sleep(30)
                    await websocket.send_json({"type": "ping"})
            except asyncio.CancelledError:
                pass

        heartbeat_task = asyncio.create_task(heartbeat())

        try:
            while True:
                t_in_recv = time.monotonic() if _terminal_debug else 0
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "resize":
                        cols = msg.get("cols", 80)
                        rows = msg.get("rows", 24)
                        try:
                            client.api.exec_resize(exec_id, height=rows, width=cols)
                        except Exception as e:
                            # Non-fatal: a resize on a not-yet-started or
                            # recently-ended exec is harmless; the default
                            # size was applied right after exec_start.
                            msg_text = str(e).lower()
                            if "not started" in msg_text or "no such exec" in msg_text:
                                pass
                            else:
                                print(f"exec_resize error for {container_id}: {type(e).__name__}: {e}")
                        continue
                    payload = msg.get("data", "").encode()
                except json.JSONDecodeError:
                    # Fallback: treat raw text as literal input
                    payload = raw.encode()

                if _terminal_debug and payload:
                    lat_ms = (time.monotonic() - t_in_recv) * 1000.0
                    print(f"[terminal:{container_id}] input {len(payload)}B, "
                          f"parse+decode {lat_ms:.2f}ms")

                if not socket_closed:
                    try:
                        sock_write(payload)
                    except Exception as e:
                        print(f"Socket send error for {container_id}: {e}")
                        socket_closed = True
                        stop_event.set()
                        break
        except WebSocketDisconnect:
            print(f"Terminal WebSocket disconnected for {container_id}")
        finally:
            stop_event.set()
            heartbeat_task.cancel()
            if not socket_closed:
                try:
                    sock.close()
                    socket_closed = True
                except:
                    pass
            thread.join(timeout=0.5)
            
    except Exception as e:
        print(f"Terminal WebSocket error: {type(e).__name__}: {e}")
        try:
            await websocket.send_text(f"Error: {str(e)}")
        except:
            pass
    finally:
        await _safe_close(websocket)

@app.websocket("/ws/logs/{container_id}")
async def logs_websocket(websocket: WebSocket, container_id: str):
    await websocket.accept()
    client = get_docker_client()
    if not client:
        try:
            await websocket.send_text("Error: Docker not available")
        except:
            pass
        await _safe_close(websocket)
        return
    try:
        container = await asyncio.to_thread(client.containers.get, container_id)
    except Exception as e:
        print(f"Logs WebSocket: container lookup failed for {container_id}: {type(e).__name__}: {e}")
        try:
            await websocket.send_text(f"Error: Container not found: {str(e)}")
        except:
            pass
        await _safe_close(websocket)
        return

    async def heartbeat():
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                return

    hb_task = asyncio.create_task(heartbeat())
    try:
        log_stream = await asyncio.to_thread(
            lambda: container.logs(stream=True, follow=True, timestamps=True)
        )
        loop = asyncio.get_event_loop()
        while True:
            try:
                chunk = await loop.run_in_executor(None, next, log_stream)
            except StopIteration:
                break
            chunk = chunk.decode('utf-8', errors='replace') if isinstance(chunk, bytes) else chunk
            for line in chunk.splitlines():
                if not line:
                    continue
                try:
                    await websocket.send_json({"line": line})
                except (WebSocketDisconnect, RuntimeError, ConnectionResetError, BrokenPipeError):
                    raise WebSocketDisconnect()
    except WebSocketDisconnect:
        print(f"Logs WebSocket disconnected for {container_id}")
    except asyncio.CancelledError:
        raise
    except (RuntimeError, ConnectionResetError, BrokenPipeError) as e:
        print(f"Logs WebSocket: client gone for {container_id}: {type(e).__name__}")
    except Exception as e:
        print(f"Logs WebSocket error for {container_id}: {type(e).__name__}: {e}")
    finally:
        hb_task.cancel()
        await _safe_close(websocket)

@app.websocket("/ws/stats/{container_id}")
async def stats_websocket(websocket: WebSocket, container_id: str):
    await websocket.accept()
    client = get_docker_client()
    if not client:
        try:
            await websocket.send_text("Error: Docker not available")
        except:
            pass
        await _safe_close(websocket)
        return
    try:
        container = await asyncio.to_thread(client.containers.get, container_id)
    except Exception as e:
        print(f"Stats WebSocket: container lookup failed for {container_id}: {type(e).__name__}: {e}")
        try:
            await websocket.send_text(f"Error: Container not found: {str(e)}")
        except:
            pass
        await _safe_close(websocket)
        return

    async def heartbeat():
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                return

    hb_task = asyncio.create_task(heartbeat())
    try:
        while True:
            try:
                stats = await asyncio.to_thread(container.stats, stream=False)
            except Exception as e:
                print(f"Stats WebSocket: docker stats call failed for {container_id}: {type(e).__name__}: {e}")
                break

            try:
                cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
                system_cpu_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
                num_cpus = stats['cpu_stats'].get('online_cpus', 1)

                cpu_percent = 0.0
                if system_cpu_delta > 0 and cpu_delta > 0:
                    cpu_percent = (cpu_delta / system_cpu_delta) * num_cpus * 100.0

                mem_usage = stats['memory_stats'].get('usage', 0)
                mem_limit = stats['memory_stats'].get('limit', 1)
                mem_percent = (mem_usage / mem_limit) * 100.0 if mem_limit else 0.0

                network_rx = 0
                network_tx = 0
                networks = stats.get('networks', {})
                for net in networks.values():
                    network_rx += net.get('rx_bytes', 0)
                    network_tx += net.get('tx_bytes', 0)

                block_read = 0
                block_write = 0
                blkio_stats = stats.get('blkio_stats', {}).get('io_service_bytes_recursive', [])
                for blk in blkio_stats:
                    if blk.get('op') in ('read', 'Read'):
                        block_read = int(block_read + blk['value'])
                    elif blk.get('op') in ('write', 'Write'):
                        block_write = int(block_write + blk['value'])

                await websocket.send_json({
                    "cpu_percent": round(float(cpu_percent), 2),
                    "memory_percent": round(float(mem_percent), 2),
                    "memory_usage": mem_usage,
                    "network_rx": network_rx,
                    "network_tx": network_tx,
                    "block_read": block_read,
                    "block_write": block_write
                })
            except (WebSocketDisconnect, RuntimeError, ConnectionResetError, BrokenPipeError):
                raise WebSocketDisconnect()
            except KeyError as e:
                print(f"Stats WebSocket: malformed stats payload for {container_id}: missing key {e}")
                break

            await asyncio.sleep(2)
    except WebSocketDisconnect:
        print(f"Stats WebSocket disconnected for {container_id}")
    except asyncio.CancelledError:
        raise
    except (RuntimeError, ConnectionResetError, BrokenPipeError) as e:
        print(f"Stats WebSocket: client gone for {container_id}: {type(e).__name__}")
    except Exception as e:
        print(f"Stats WebSocket error for {container_id}: {type(e).__name__}: {e}")
    finally:
        hb_task.cancel()
        await _safe_close(websocket)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            real_containers = get_real_containers()
            containers = real_containers if real_containers is not None else get_demo_containers()
            
            # AI Intelligence Layers
            clusters = group_containers_into_constellations(containers)
            incidents = detect_incidents(containers)
            insight = copilot.analyze_infrastructure(containers, clusters, incidents)
            
            await websocket.send_json({
                'type': 'containers',
                'data': containers,
                'clusters': clusters,
                'incidents': incidents,
                'ai_insight': insight,
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []

@app.post("/api/ai/chat")
async def ai_chat(request: ChatRequest):
    real_containers = get_real_containers()
    containers = real_containers if real_containers is not None else get_demo_containers()
    clusters = group_containers_into_constellations(containers)
    incidents = detect_incidents(containers)
    
    context = {
        "containers": containers,
        "clusters": clusters,
        "incidents": incidents
    }
    
    response = copilot.chat(request.message, request.history, context)
    return {"message": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
