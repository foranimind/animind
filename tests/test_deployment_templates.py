from pathlib import Path
import unittest


class TestDeploymentTemplates(unittest.TestCase):
    def test_required_templates_exist(self):
        required = [
            Path("deploy/nginx/animind.conf.example"),
            Path("deploy/systemd/animind-orchestrator.service"),
            Path("deploy/systemd/animind-relay.service"),
            Path("deploy/env/animind.orchestrator.env.example"),
            Path("deploy/env/animind.relay.env.example"),
            Path("deploy/scripts/deploy-orchestrator.sh"),
            Path("deploy/scripts/deploy-relay.sh"),
            Path("docs/deployment/cloud-relay-runbook.md"),
            Path("apps/web/.env.production.example"),
            Path("tools/smoke/smoke_cloud_job.py"),
            Path("tools/smoke/smoke_relay_task.py"),
        ]
        missing = [str(path) for path in required if not path.is_file()]
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
