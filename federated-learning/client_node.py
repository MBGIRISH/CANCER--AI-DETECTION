import os
import time
import random
import hashlib
import httpx
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("federated_client")

COORDINATOR_URL = os.getenv("COORDINATOR_URL", "http://localhost:8004")
NODE_ID = os.getenv("NODE_ID", f"node-{random.randint(1000, 9999)}")
NODE_NAME = os.getenv("NODE_NAME", f"Hospital Node {NODE_ID.split('-')[1]}")
HOSPITAL_LOCATION = os.getenv("HOSPITAL_LOCATION", "Regional Medical Hub")
IP_ADDRESS = os.getenv("IP_ADDRESS", "192.168.10.12")

def simulate_local_training():
    epochs = 5
    logger.info(f"Starting local training simulation for {NODE_NAME}...")
    
    # Simulate training loop
    loss = 0.5 + random.random() * 0.1
    accuracy = 0.7 + random.random() * 0.1
    
    for epoch in range(1, epochs + 1):
        time.sleep(1.0)  # Simulate computing time
        loss -= random.random() * 0.05
        accuracy += random.random() * 0.03
        loss = max(0.01, loss)
        accuracy = min(0.99, accuracy)
        logger.info(f"Epoch {epoch}/{epochs} - loss: {loss:.4f} - accuracy: {accuracy:.4f}")
        
    logger.info("Local training simulation complete.")
    return accuracy, loss

def run_client():
    logger.info(f"Initializing Federated Node: {NODE_NAME} from {HOSPITAL_LOCATION}")
    
    client = httpx.Client(timeout=10.0)
    
    # 1. Register with coordinator
    registered = False
    while not registered:
        try:
            reg_payload = {
                "node_id": NODE_ID,
                "node_name": NODE_NAME,
                "hospital_location": HOSPITAL_LOCATION,
                "ip_address": IP_ADDRESS
            }
            response = client.post(f"{COORDINATOR_URL}/api/federated/register", json=reg_payload)
            if response.status_code == 200:
                logger.info(f"Successfully registered with coordinator at {COORDINATOR_URL}")
                registered = True
            else:
                logger.error(f"Registration rejected: {response.text}")
                time.sleep(5)
        except Exception as e:
            logger.error(f"Waiting to connect to coordinator at {COORDINATOR_URL}... Error: {e}")
            time.sleep(5)
            
    # 2. Main synchronization loop
    last_completed_round = 0
    while True:
        try:
            # Query coordinator status
            status_response = client.get(f"{COORDINATOR_URL}/api/federated/status")
            if status_response.status_code != 200:
                logger.error(f"Failed to fetch status: {status_response.text}")
                time.sleep(10)
                continue
                
            status_data = status_response.json()
            current_round = status_data["current_round"]
            
            if current_round > last_completed_round:
                logger.info(f"New round {current_round} detected by coordinator. Initiating local update...")
                
                # Run local training
                accuracy, loss = simulate_local_training()
                
                # Generate weights delta (simulated 10-dimensional parameter weights vector)
                weights_delta = [random.uniform(-0.1, 0.1) for _ in range(10)]
                weights_hash = hashlib.sha256(str(weights_delta).encode()).hexdigest()
                
                submit_payload = {
                    "node_id": NODE_ID,
                    "round": current_round,
                    "local_samples": random.randint(100, 500),
                    "local_accuracy": accuracy,
                    "local_loss": loss,
                    "weights_summary_hash": weights_hash,
                    "weights_delta": weights_delta
                }
                
                # Submit updates
                submit_response = client.post(f"{COORDINATOR_URL}/api/federated/submit-weights", json=submit_payload)
                if submit_response.status_code == 200:
                    logger.info(f"Submitted weights for round {current_round} to coordinator.")
                    last_completed_round = current_round
                else:
                    logger.error(f"Failed to submit weights: {submit_response.text}")
                    
            else:
                logger.info(f"Coordinator round {current_round} already processed. Sleeping...")
                time.sleep(10)
                
        except Exception as e:
            logger.error(f"Error in synch loop: {e}")
            time.sleep(10)

if __name__ == "__main__":
    run_client()
