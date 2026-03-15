import asyncio
import math
import random
import time
import threading
import socket
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

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
                'cpu_percent': round(float(cpu_percent), 2),
                'memory_percent': round(float(mem_percent), 2),
                'memory_usage': mem_usage,
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
        await websocket.close()
        return

    try:
        # Try to find a working shell
        shells = ["bash", "sh"]
        exec_id = None
        
        for shell in shells:
            try:
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
                print(f"Failed to create exec for {shell}: {e}")
                continue
        
        if not exec_id:
            await websocket.send_text("Error: Could not find a suitable shell (bash/sh)")
            print(f"FAILED to find shell for container {container_id}")
            await websocket.close()
            return
        
        print(f"Successfully created exec {exec_id} for container {container_id}")
        
        # Start the exec instance and get a socket-like object
        sock = client.api.exec_start(exec_id, detach=False, tty=True, socket=True)
        print(f"Socket obtained for {container_id}: {type(sock)}")
        
        stop_event = threading.Event()
        socket_closed = False
        
        # Get the running event loop for thread-to-async communication
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()

        def socket_to_ws():
            nonlocal socket_closed
            try:
                # Set a timeout if possible to allow checking stop_event
                if hasattr(sock, 'settimeout'):
                    sock.settimeout(0.5)
                elif hasattr(sock, '_sock') and hasattr(sock._sock, 'settimeout'):
                    sock._sock.settimeout(0.5)
                
                while not stop_event.is_set():
                    try:
                        # Some docker-py versions use .recv, others .read or ._sock.recv
                        data = None
                        if hasattr(sock, 'recv'):
                            data = sock.recv(4096)
                        elif hasattr(sock, 'read'):
                            data = sock.read(4096)
                        elif hasattr(sock, '_sock') and hasattr(sock._sock, 'recv'):
                            data = sock._sock.recv(4096)
                            
                        if data:
                            # print(f"DEBUG: Read {len(data)} bytes from container {container_id}")
                            pass
                        else:
                            if stop_event.is_set(): break
                            print(f"Container {container_id} PTY stream ended (no data)")
                            break
                            
                        asyncio.run_coroutine_threadsafe(
                            websocket.send_bytes(data), 
                            loop
                        )
                    except (socket.timeout, TimeoutError):
                        continue
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
            if hasattr(sock, 'send'):
                sock.send(b"\n")
            elif hasattr(sock, 'write'):
                sock.write(b"\n")
            elif hasattr(sock, '_sock') and hasattr(sock._sock, 'send'):
                sock._sock.send(b"\n")
        except:
            pass

        thread = threading.Thread(target=socket_to_ws, daemon=True)
        thread.start()

        try:
            while True:
                # Use more robust receive methods
                try:
                    data = await websocket.receive_text()
                    payload = data.encode()
                except RuntimeError:
                    # Might be binary or disconnect
                    try:
                        payload = await websocket.receive_bytes()
                    except:
                        break
                except:
                    break

                if not socket_closed:
                    try:
                        print(f"DEBUG: Forwarding {len(payload)} bytes to container {container_id}")
                        # Prioritize direct send if it's a socket-like object (NpipeSocket/etc)
                        sent = False
                        for method in ['send', 'write']:
                            if hasattr(sock, method):
                                getattr(sock, method)(payload)
                                sent = True
                                break
                        
                        if not sent and hasattr(sock, '_sock') and hasattr(sock._sock, 'send'):
                            sock._sock.send(payload)
                            sent = True
                        
                        if not sent:
                            print(f"WARNING: Failed to find send method for socket on {container_id}")
                    except Exception as e:
                        print(f"Socket send error for {container_id}: {e}")
        except WebSocketDisconnect:
            print(f"Terminal WebSocket disconnected for {container_id}")
        finally:
            stop_event.set()
            if not socket_closed:
                try:
                    sock.close()
                    socket_closed = True
                except:
                    pass
            thread.join(timeout=0.5)
            
    except Exception as e:
        print(f"Terminal WebSocket error: {e}")
        try:
            await websocket.send_text(f"Error: {str(e)}")
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            real_containers = get_real_containers()
            containers = real_containers if real_containers is not None else get_demo_containers()
            await websocket.send_json({
                'type': 'containers',
                'data': containers
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
