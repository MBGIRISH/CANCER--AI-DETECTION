import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("federated_coordinator")

app = FastAPI(title="SynaptoMed Federated Learning Coordinator", version="2.0.0")

# Global state in memory (production setups would use Redis/DB)
nodes: Dict[str, Dict[str, Any]] = {}
current_round: int = 1
min_nodes_required: int = 3
received_updates: Dict[str, Dict[str, Any]] = {}
aggregated_metrics: Dict[str, Any] = {
    "global_accuracy": 0.85,
    "global_loss": 0.32,
    "active_nodes_count": 0,
    "history": []
}

class RegisterNodeRequest(BaseModel):
    node_id: str
    node_name: str
    hospital_location: str
    ip_address: str

class SubmitWeightsRequest(BaseModel):
    node_id: str
    round: int
    local_samples: int
    local_accuracy: float
    local_loss: float
    weights_summary_hash: str  # Simulated weights verification hash
    weights_delta: List[float]  # Simulated weights changes for aggregation

@app.post("/api/federated/register")
def register_node(req: RegisterNodeRequest):
    nodes[req.node_id] = {
        "node_id": req.node_id,
        "name": req.node_name,
        "location": req.hospital_location,
        "ip": req.ip_address,
        "status": "connected",
        "last_seen": np.datetime64('now').astype(str)
    }
    logger.info(f"Node registered: {req.node_name} ({req.node_id}) from {req.hospital_location}")
    return {"message": "Node successfully registered with coordinator.", "round": current_round}

@app.post("/api/federated/submit-weights")
def submit_weights(req: SubmitWeightsRequest):
    if req.round != current_round:
        raise HTTPException(status_code=400, detail=f"Stale update. Current coordinator round is {current_round}")
    
    if req.node_id not in nodes:
        raise HTTPException(status_code=403, detail="Node not registered.")

    received_updates[req.node_id] = {
        "local_samples": req.local_samples,
        "local_accuracy": req.local_accuracy,
        "local_loss": req.local_loss,
        "weights_delta": req.weights_delta,
        "weights_summary_hash": req.weights_summary_hash
    }
    
    logger.info(f"Received updates from Node {req.node_id} for round {req.round}. Accuracy: {req.local_accuracy:.4f}, Loss: {req.local_loss:.4f}")
    
    # Trigger aggregation if we have sufficient updates
    if len(received_updates) >= min_nodes_required:
        aggregate_weights()

    return {"message": "Update received.", "active_round": current_round}

def aggregate_weights():
    global current_round, received_updates, aggregated_metrics
    logger.info(f"Aggregating updates for Round {current_round} using FedAvg...")

    total_samples = sum(u["local_samples"] for u in received_updates.values())
    if total_samples == 0:
        return

    # Federated Averaging (FedAvg) calculation
    weighted_acc = 0.0
    weighted_loss = 0.0
    
    # We will average the delta vectors weighted by their sample counts
    all_deltas = [np.array(u["weights_delta"]) for u in received_updates.values()]
    samples_weights = [u["local_samples"] / total_samples for u in received_updates.values()]
    
    global_delta = np.zeros_like(all_deltas[0])
    for delta, w in zip(all_deltas, samples_weights):
        global_delta += delta * w
        
    for u in received_updates.values():
        weight = u["local_samples"] / total_samples
        weighted_acc += u["local_accuracy"] * weight
        weighted_loss += u["local_loss"] * weight

    # Update global metrics
    aggregated_metrics["global_accuracy"] = float(weighted_acc)
    aggregated_metrics["global_loss"] = float(weighted_loss)
    aggregated_metrics["active_nodes_count"] = len(nodes)
    
    aggregated_metrics["history"].append({
        "round": current_round,
        "nodes_participated": len(received_updates),
        "accuracy": float(weighted_acc),
        "loss": float(weighted_loss)
    })
    
    logger.info(f"Round {current_round} completed. Aggregated Accuracy: {weighted_acc:.4f}, Aggregated Loss: {weighted_loss:.4f}")
    
    # Advance round
    current_round += 1
    received_updates = {}

@app.get("/api/federated/status")
def get_status():
    return {
        "current_round": current_round,
        "registered_nodes": list(nodes.values()),
        "updates_count": len(received_updates),
        "min_nodes_required": min_nodes_required,
        "global_metrics": aggregated_metrics
    }

@app.post("/api/federated/trigger-round")
def trigger_round():
    global current_round
    if len(nodes) < min_nodes_required:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot force aggregation. Only {len(nodes)}/{min_nodes_required} nodes registered."
        )
    aggregate_weights()
    return {"message": "Aggregation round triggered manually.", "new_round": current_round}

@app.get("/health")
def health():
    return {"status": "healthy"}
