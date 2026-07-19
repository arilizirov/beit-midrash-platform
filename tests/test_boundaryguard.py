import re

from _kit import boundary_guard

bg = boundary_guard()


def _manifest(**over):
    raw = {
        "source_root": "src",
        "modules": {
            "billing": {"path": "domains/billing", "public": ["index"]},
            "users": {"path": "domains/users", "public": ["index"]},
            "platform": {"path": "platform", "public": ["db"]},
        },
        "allow": {"billing": ["platform"], "users": ["platform"], "platform": []},
        "shared_kernel": {"path": "shared_kernel", "public": ["index"]},
        "enforce_public_surface": True,
        "python": {"root_package": "app"},
    }
    raw.update(over)
    return bg.Manifest(raw)


def test_manifest_parses_modules_and_allow():
    m = _manifest()
    assert set(m.names()) == {"billing", "users", "platform"}
    assert m.allow["billing"] == {"platform"}
    assert m.shared_name == "shared_kernel"


def test_depcruise_denies_unlisted_allows_listed():
    rules = {r["name"] for r in bg.gen_depcruise(_manifest())["forbidden"]}
    assert "billing-cannot-import-users" in rules          # not allowed -> forbidden
    assert "billing-cannot-import-platform" not in rules    # allowed -> not forbidden
    assert "no-circular" in rules
    assert "billing-public-surface" in rules


def test_shared_kernel_must_import_nothing():
    rules = {r["name"] for r in bg.gen_depcruise(_manifest())["forbidden"]}
    assert "shared-kernel-cannot-import-billing" in rules


def test_importlinter_requires_root_package():
    m = _manifest(python={})
    try:
        bg.gen_importlinter(m)
        assert False, "expected SystemExit without python.root_package"
    except SystemExit:
        pass


def test_python_adapters_reject_hyphen_paths():
    m = _manifest(shared_kernel={"path": "shared-kernel", "public": ["index"]})
    for fn in (bg.gen_importlinter, bg.gen_tach):
        try:
            fn(m)
            assert False, "expected SystemExit on hyphenated python path"
        except SystemExit:
            pass


def test_public_surface_regex_matches_index_not_internal():
    m = _manifest()
    rx = re.compile(m.public_re(m.modules["billing"]))
    assert rx.search("src/domains/billing/index.ts")
    assert rx.search("src/domains/billing/index/index.ts")
    assert not rx.search("src/domains/billing/internal.ts")


def test_importlinter_output_has_root_and_contract():
    out = bg.gen_importlinter(_manifest())
    assert "root_package = app" in out
    assert "type = forbidden" in out


def _rule(rules, name):
    return next(r for r in rules if r["name"] == name)


def test_generated_rules_would_catch_a_real_violation():
    """Behavioral check: apply the generated dependency-cruiser regexes to concrete
    import paths and confirm a violation WOULD be flagged. (The real validator runs
    on real code in CI via boundaries.yml; this proves the policy logic offline.)"""
    rules = bg.gen_depcruise(_manifest())["forbidden"]

    # 1. billing -> users is not allowed: the allowlist rule must match this import.
    r = _rule(rules, "billing-cannot-import-users")
    assert re.search(r["from"]["path"], "src/domains/billing/service.ts")
    assert re.search(r["to"]["path"], "src/domains/users/index.ts")

    # 2. deep import into billing internals from outside is banned by public-surface.
    ps = _rule(rules, "billing-public-surface")
    outside_src = "src/domains/users/service.ts"   # not inside billing -> rule applies
    internal_tgt = "src/domains/billing/secret.ts"  # internal, not the public index
    assert re.search(ps["from"]["pathNot"], outside_src) is None          # source not in billing
    assert re.search(ps["to"]["path"], internal_tgt) is not None          # target is in billing
    assert re.search(ps["to"]["pathNot"], internal_tgt) is None           # but NOT public -> forbidden

    # 3. negative control: a LEGAL import (billing -> platform) has no forbidding rule.
    names = {x["name"] for x in rules}
    assert "billing-cannot-import-platform" not in names
