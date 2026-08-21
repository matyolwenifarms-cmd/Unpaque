# Fixtures

Two kinds of file live here and they prove different things. Keeping them
separate is the point.

## `openalex-synthetic.json` — hand-written, permanent

Built from OpenAlex's documented response shape by someone who could not reach
the API: this repository is developed behind a proxy that allows npm and
nothing else.

It exists to exercise the adapter's branches exactly — a peer-reviewed article,
a paywalled one, a preprint, a retracted work, one with no DOI, one with
neither title nor id. Every row is deliberate, so the tests can assert precise
outcomes.

It is **not** evidence that the adapter matches the real API. A field renamed,
nested one level deeper, or typed differently would pass every test against
this file and fail on the first live query. The DOIs use the `10.1000` test
prefix on purpose: a fixture full of real-looking citations is a fixture
somebody eventually copies into a bibliography.

## `openalex-recorded.json` — real, produced by you

```bash
npm run research:record
```

OpenAlex needs no key and costs nothing. The script runs a real search plus
targeted queries for a retracted work and a preprint, and writes what comes
back.

The tests against this file assert **invariants rather than specific rows** —
that no retracted work is ever presented as full text, that every reference
carries a resolvable identifier, that nothing was dropped silently — because
the contents change every time it is recorded and a test pinned to a particular
paper would break for the wrong reason.

Those tests **skip** when the file is absent, and say so. A skipped test is not
a passing one: until you have run the recorder, the adapter has never met the
real API.

If recording breaks something, that break is the entire value of the exercise —
it is the adapter being wrong, found by a test instead of by a researcher.
