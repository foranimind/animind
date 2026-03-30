# Relay Service

Local relay service for Animind. It accepts task requests from the cloud orchestrator, runs the existing local model adapters, and uploads generated artifacts back to the orchestrator's `/api/jobs/{job_id}/relay-upload` endpoint.
