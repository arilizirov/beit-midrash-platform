from _kit import verify

v = verify()


def test_discover_cov_source_explicit_wins(tmp_path):
    assert v.discover_cov_source(tmp_path, ["pkg"]) == ["pkg"]


def test_discover_cov_source_from_manifest(tmp_path):
    (tmp_path / "boundaries.yaml").write_text("python:\n  root_package: myapp\n")
    assert v.discover_cov_source(tmp_path, None) == ["myapp"]


def test_discover_cov_source_src_fallback(tmp_path):
    (tmp_path / "src").mkdir()
    assert v.discover_cov_source(tmp_path, None) == ["src"]


def test_discover_cov_source_last_resort_cwd(tmp_path):
    assert v.discover_cov_source(tmp_path, None) == ["."]


def test_npm_script_exists(tmp_path):
    (tmp_path / "package.json").write_text('{"scripts":{"test":"vitest","lint":"eslint ."}}')
    assert v.npm_script_exists(tmp_path, "test")
    assert v.npm_script_exists(tmp_path, "lint")
    assert not v.npm_script_exists(tmp_path, "typecheck")


def test_npm_script_exists_no_package_json(tmp_path):
    assert not v.npm_script_exists(tmp_path, "test")
