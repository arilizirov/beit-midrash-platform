import importlib.util
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent


def _debt():
    spec = importlib.util.spec_from_file_location("bg_debt", KIT / "bigbrainQA" / "debt_report.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


dbt = _debt()


def test_collect_counts_markers_and_lines(tmp_path):
    src = tmp_path / "src" / "features" / "billing"
    src.mkdir(parents=True)
    (src / "service.ts").write_text("export const x=1;\n// TODO fix\n// FIXME edge\n")
    d = dbt.collect(tmp_path, since=50)
    assert d["files"] == 1
    assert d["total_markers"] == 2  # TODO + FIXME
    assert d["total_lines"] == 3


def test_collect_counts_yagni_simplification_marker(tmp_path):
    src = tmp_path / "src"
    src.mkdir(parents=True)
    (src / "ui.tsx").write_text(
        "export const f=1;\n"
        "// YAGNI: native <input type=date>, not a dep -- revisit if locale needed\n"
    )
    d = dbt.collect(tmp_path, since=50)
    assert d["total_markers"] == 1  # deliberate simplification harvested like other markers


def test_collect_skips_the_kit_and_node_modules(tmp_path):
    (tmp_path / "bigbrainQA").mkdir()
    (tmp_path / "bigbrainQA" / "tool.py").write_text("# TODO not my debt\n")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "dep.js").write_text("// FIXME vendor\n")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.ts").write_text("export const y=1;\n")
    d = dbt.collect(tmp_path, since=50)
    assert d["files"] == 1                 # only src/app.ts
    assert d["total_markers"] == 0          # kit + vendor markers excluded
