import os
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from services.orchestrator.src.adapters import animationgpt


def _write(path: Path, content: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class TestAnimationGPTRuntimeResolution(unittest.TestCase):
    def test_resolve_runtime_paths_accepts_root_level_agpt_config(self) -> None:
        with TemporaryDirectory() as temp_dir:
            animation_root = Path(temp_dir) / "AnimationGPT"
            motion_root = animation_root / "algorithm" / "MotionGPT"
            _write(motion_root / "demo.py", "print('demo')\n")
            _write(
                animation_root / "config_AGPT.yaml",
                "TEST:\n  CHECKPOINTS: mGPT.ckpt\n",
            )
            _write(motion_root / "mGPT.ckpt", "checkpoint")
            _write(
                animation_root / "tools" / "npy2bvh" / "joints2bvh.py",
                "class Joint2BVHConvertor: ...\n",
            )

            with patch.dict(
                os.environ,
                {
                    "ANIMATIONGPT_ROOT": str(animation_root),
                    "MOTIONGPT_ROOT": str(motion_root),
                },
                clear=False,
            ):
                runtime = animationgpt._resolve_runtime_paths()

            self.assertEqual(runtime.animationgpt_root, animation_root)
            self.assertEqual(runtime.motiongpt_root, motion_root)
            self.assertEqual(runtime.config_path, animation_root / "config_AGPT.yaml")
            self.assertEqual(runtime.checkpoint_path, motion_root / "mGPT.ckpt")
            self.assertEqual(animationgpt._missing_dependencies(runtime), [])

    def test_prepare_demo_cfg_rewrites_checkpoint_to_absolute_path(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            animation_root = temp_root / "AnimationGPT"
            motion_root = animation_root / "algorithm" / "MotionGPT"
            cfg_path = animation_root / "config_AGPT.yaml"
            external_ckpt = temp_root / "model-cache" / "mGPT.ckpt"
            output_dir = temp_root / "runtime" / "motion"

            _write(motion_root / "demo.py", "print('demo')\n")
            _write(cfg_path, "TEST:\n  CHECKPOINTS: mGPT.ckpt\n")
            _write(external_ckpt, "checkpoint")
            _write(
                animation_root / "tools" / "npy2bvh" / "joints2bvh.py",
                "class Joint2BVHConvertor: ...\n",
            )

            runtime = animationgpt._AnimationGPTRuntime(
                animationgpt_root=animation_root,
                motiongpt_root=motion_root,
                demo_script=motion_root / "demo.py",
                config_path=cfg_path,
                assets_config_path=motion_root / "configs" / "assets.yaml",
                checkpoint_path=external_ckpt,
                npy_to_bvh_dir=animation_root / "tools" / "npy2bvh",
                joints2bvh_path=animation_root / "tools" / "npy2bvh" / "joints2bvh.py",
            )

            resolved_cfg = animationgpt._prepare_demo_cfg(
                runtime, output_dir, use_wsl=False
            )

            self.assertNotEqual(resolved_cfg, cfg_path)
            self.assertTrue(resolved_cfg.exists())
            self.assertIn(str(external_ckpt), resolved_cfg.read_text(encoding="utf-8"))

    def test_prepare_assets_cfg_remaps_nested_local_asset_layout(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            animation_root = temp_root / "AnimationGPT"
            motion_root = animation_root / "algorithm" / "MotionGPT"
            assets_cfg_path = motion_root / "configs" / "assets.yaml"
            output_dir = temp_root / "runtime" / "motion"

            _write(
                assets_cfg_path,
                "\n".join(
                    [
                        "DATASET:",
                        "  WORD_VERTILIZER_PATH: deps/glove/",
                        "  KIT:",
                        "    MEAN_STD_PATH: deps/t2m/",
                        "  HUMANML3D:",
                        "    MEAN_STD_PATH: deps/t2m/",
                        "METRIC:",
                        "  TM2T:",
                        "    t2m_path: deps/t2m/",
                        "",
                    ]
                ),
            )
            _write(
                motion_root
                / "deps"
                / "t2m"
                / "glove"
                / "our_vab_words.pkl",
                "glove",
            )
            _write(
                motion_root
                / "deps"
                / "t2m"
                / "t2m"
                / "t2m"
                / "VQVAEV3_CB1024_CMT_H1024_NRES3"
                / "meta"
                / "mean.npy",
                "mean",
            )

            runtime = animationgpt._AnimationGPTRuntime(
                animationgpt_root=animation_root,
                motiongpt_root=motion_root,
                demo_script=motion_root / "demo.py",
                config_path=animation_root / "config_AGPT.yaml",
                assets_config_path=assets_cfg_path,
                checkpoint_path=motion_root / "mGPT.ckpt",
                npy_to_bvh_dir=animation_root / "tools" / "npy2bvh",
                joints2bvh_path=animation_root / "tools" / "npy2bvh" / "joints2bvh.py",
            )

            resolved_assets = animationgpt._prepare_assets_cfg(runtime, output_dir)

            self.assertNotEqual(resolved_assets, assets_cfg_path)
            content = resolved_assets.read_text(encoding="utf-8")
            self.assertIn("WORD_VERTILIZER_PATH: deps/t2m/glove/", content)
            self.assertIn("MEAN_STD_PATH: deps/t2m/t2m/", content)
            self.assertIn("t2m_path: deps/t2m/t2m/", content)

    def test_prepare_demo_cfg_uses_wsl_checkpoint_path_when_requested(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            animation_root = temp_root / "AnimationGPT"
            motion_root = animation_root / "algorithm" / "MotionGPT"
            cfg_path = animation_root / "config_AGPT.yaml"
            output_dir = temp_root / "runtime" / "motion"
            checkpoint_path = Path("E:/models/mGPT.ckpt")

            _write(cfg_path, "TEST:\n  CHECKPOINTS: mGPT.ckpt\n")

            runtime = animationgpt._AnimationGPTRuntime(
                animationgpt_root=animation_root,
                motiongpt_root=motion_root,
                demo_script=motion_root / "demo.py",
                config_path=cfg_path,
                assets_config_path=motion_root / "configs" / "assets.yaml",
                checkpoint_path=checkpoint_path,
                npy_to_bvh_dir=animation_root / "tools" / "npy2bvh",
                joints2bvh_path=animation_root / "tools" / "npy2bvh" / "joints2bvh.py",
            )

            resolved_cfg = animationgpt._prepare_demo_cfg(
                runtime, output_dir, use_wsl=True
            )

            self.assertIn("/mnt/e/models/mGPT.ckpt", resolved_cfg.read_text(encoding="utf-8"))

    def test_build_demo_env_disables_weights_only_load_by_default(self) -> None:
        runtime = animationgpt._AnimationGPTRuntime(
            animationgpt_root=Path("/tmp/AnimationGPT"),
            motiongpt_root=Path("/tmp/AnimationGPT/algorithm/MotionGPT"),
            demo_script=Path("/tmp/AnimationGPT/algorithm/MotionGPT/demo.py"),
            config_path=Path("/tmp/AnimationGPT/config_AGPT.yaml"),
            assets_config_path=Path(
                "/tmp/AnimationGPT/algorithm/MotionGPT/configs/assets.yaml"
            ),
            checkpoint_path=Path("/tmp/AnimationGPT/algorithm/MotionGPT/mGPT.ckpt"),
            npy_to_bvh_dir=Path("/tmp/AnimationGPT/tools/npy2bvh"),
            joints2bvh_path=Path("/tmp/AnimationGPT/tools/npy2bvh/joints2bvh.py"),
        )

        with patch.dict(
            os.environ,
            {
                "PYTHONPATH": "/existing/path",
            },
            clear=True,
        ):
            env = animationgpt._build_demo_env({}, runtime, use_wsl=True)

        self.assertEqual(env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"], "1")
        self.assertNotIn("TORCH_FORCE_WEIGHTS_ONLY_LOAD", env)

    def test_build_demo_cmd_resolves_runtime_files_for_wsl(self) -> None:
        runtime = animationgpt._AnimationGPTRuntime(
            animationgpt_root=Path("E:/repo/third_party/AnimationGPT"),
            motiongpt_root=Path("E:/repo/third_party/AnimationGPT/algorithm/MotionGPT"),
            demo_script=Path("E:/repo/third_party/AnimationGPT/algorithm/MotionGPT/demo.py"),
            config_path=Path("E:/repo/third_party/AnimationGPT/config_AGPT.yaml"),
            assets_config_path=Path(
                "E:/repo/third_party/AnimationGPT/algorithm/MotionGPT/configs/assets.yaml"
            ),
            checkpoint_path=Path(
                "E:/repo/third_party/AnimationGPT/algorithm/MotionGPT/mGPT.ckpt"
            ),
            npy_to_bvh_dir=Path("E:/repo/third_party/AnimationGPT/tools/npy2bvh"),
            joints2bvh_path=Path(
                "E:/repo/third_party/AnimationGPT/tools/npy2bvh/joints2bvh.py"
            ),
        )

        cmd = animationgpt._build_demo_cmd(
            "/home/zhou/miniconda3/envs/mgpt/bin/python",
            Path("runtime/assets/job/motion/motion_prompt.txt"),
            runtime,
            Path("runtime/assets/job/motion/config_AGPT.runtime.yaml"),
            Path("runtime/assets/job/motion/assets.runtime.yaml"),
            use_wsl=True,
        )

        self.assertEqual(cmd[0], "/home/zhou/miniconda3/envs/mgpt/bin/python")
        self.assertEqual(
            cmd[1],
            "/mnt/e/repo/third_party/AnimationGPT/algorithm/MotionGPT/demo.py",
        )
        self.assertTrue(cmd[3].startswith("/mnt/"))
        self.assertTrue(cmd[5].startswith("/mnt/"))
        self.assertTrue(cmd[7].startswith("/mnt/"))

    def test_convert_npy_to_bvh_uses_absolute_output_path(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            npy_path = temp_root / "motion_out.npy"
            runtime = animationgpt._AnimationGPTRuntime(
                animationgpt_root=temp_root / "AnimationGPT",
                motiongpt_root=temp_root / "AnimationGPT" / "algorithm" / "MotionGPT",
                demo_script=temp_root / "AnimationGPT" / "algorithm" / "MotionGPT" / "demo.py",
                config_path=temp_root / "AnimationGPT" / "config_AGPT.yaml",
                assets_config_path=temp_root
                / "AnimationGPT"
                / "algorithm"
                / "MotionGPT"
                / "configs"
                / "assets.yaml",
                checkpoint_path=temp_root
                / "AnimationGPT"
                / "algorithm"
                / "MotionGPT"
                / "mGPT.ckpt",
                npy_to_bvh_dir=temp_root / "AnimationGPT" / "tools" / "npy2bvh",
                joints2bvh_path=temp_root
                / "AnimationGPT"
                / "tools"
                / "npy2bvh"
                / "joints2bvh.py",
            )
            runtime.npy_to_bvh_dir.mkdir(parents=True, exist_ok=True)

            import numpy as np

            np.save(npy_path, np.zeros((1, 22, 3), dtype=float))
            save_calls = {}

            class FakeConverter:
                def convert(self, joints, filename, iterations=10, foot_ik=True):
                    return SimpleNamespace(names=["Hips"]), None

            fake_module = SimpleNamespace(
                Joint2BVHConvertor=lambda: FakeConverter(),
                BVH=SimpleNamespace(
                    save=lambda path, anim, **kwargs: save_calls.setdefault("path", path)
                ),
            )

            with patch.object(
                animationgpt, "_load_joints2bvh_module", return_value=fake_module
            ):
                frames = animationgpt._convert_npy_to_bvh(
                    npy_path=npy_path,
                    bvh_path=Path("runtime/assets/job/motion/motion.bvh"),
                    fps=30,
                    quality="standard",
                    quality_settings={},
                    runtime=runtime,
                    log_handle=StringIO(),
                )

        self.assertEqual(frames, 1)
        self.assertEqual(
            save_calls["path"],
            str(Path("runtime/assets/job/motion/motion.bvh").resolve()),
        )


if __name__ == "__main__":
    unittest.main()
