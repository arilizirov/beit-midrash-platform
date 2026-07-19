import yaml

from _kit import generator

gen = generator()

SAMPLE = (
    "modules:\n"
    "  billing:\n"
    "    path: domains/billing\n"
    "    public: [index]\n"
    "allow:\n"
    "  billing: [platform]\n"
)


def test_register_inserts_and_still_parses(tmp_path):
    mf = tmp_path / "boundaries.yaml"
    mf.write_text(SAMPLE)
    gen.register_in_manifest(mf, "orders", "domains/orders", ["platform"])
    d = yaml.safe_load(mf.read_text())
    assert d["modules"]["orders"]["path"] == "domains/orders"
    assert d["allow"]["orders"] == ["platform"]
    # existing module preserved
    assert "billing" in d["modules"]


def test_register_is_idempotent(tmp_path):
    mf = tmp_path / "boundaries.yaml"
    mf.write_text(SAMPLE)
    gen.register_in_manifest(mf, "orders", "domains/orders", ["platform"])
    c1 = mf.read_text().count("orders:")
    gen.register_in_manifest(mf, "orders", "domains/orders", ["platform"])
    c2 = mf.read_text().count("orders:")
    assert c1 == c2  # second call must not duplicate


def test_register_tolerates_inline_comment_anchor(tmp_path):
    mf = tmp_path / "boundaries.yaml"
    mf.write_text("modules:   # my domains\n  billing:\n    path: domains/billing\n    public: [index]\nallow:  # deny by default\n  billing: [platform]\n")
    gen.register_in_manifest(mf, "orders", "domains/orders", ["platform"])
    d = yaml.safe_load(mf.read_text())
    assert "orders" in d["modules"]
    assert "orders" in d["allow"]


def test_detect_test_framework(tmp_path):
    (tmp_path / "package.json").write_text('{"devDependencies":{"vitest":"^1"}}')
    assert gen.detect_test_framework(tmp_path) == "vitest"
    (tmp_path / "package.json").write_text('{"dependencies":{"jest":"^29"}}')
    assert gen.detect_test_framework(tmp_path) == "jest"
    (tmp_path / "package.json").unlink()
    assert gen.detect_test_framework(tmp_path) == "vitest"  # default


def test_stamp_ts_writes_failing_red_test(tmp_path):
    gen.stamp_ts(tmp_path, "orders", "vitest")
    test = (tmp_path / "orders.test.ts").read_text()
    assert "vitest" in test
    assert "expect(false).toBe(true)" in test  # red first
    assert (tmp_path / "index.ts").exists()


def test_resolve_layout_explicit_wins(tmp_path):
    assert gen.resolve_layout(tmp_path, "features") == "features"


def test_resolve_layout_from_manifest(tmp_path):
    (tmp_path / "boundaries.yaml").write_text("layout: features\nmodules: {}\n")
    assert gen.resolve_layout(tmp_path, None) == "features"


def test_resolve_layout_default_domains(tmp_path):
    assert gen.resolve_layout(tmp_path, None) == "domains"
    (tmp_path / "boundaries.yaml").write_text("modules: {}\n")  # no layout key
    assert gen.resolve_layout(tmp_path, None) == "domains"
